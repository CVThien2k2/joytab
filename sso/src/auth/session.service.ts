import { Injectable } from '@nestjs/common';
import { ERROR_CODES } from '../common/constants/error-codes.constant';
import { AppException } from '../common/exceptions/app.exception';
import { DatabaseService } from '../database/database.service';
import { Prisma } from '../generated/prisma/client';
import { TokenService } from './token.service';

export type PrismaTx = Prisma.TransactionClient;

type RevokeReason = 'logout' | 'revoked_remote';

@Injectable()
export class SessionService {
  /**
   * Input: DatabaseService (query ngoài transaction), TokenService (sinh/băm token).
   * Output: Service quản lý vòng đời UserSession theo session-cookie.
   */
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly tokenService: TokenService,
  ) {}

  /**
   * Input: userId, deviceId, transaction client.
   * Output: Tạo session mới với token_hash + expires_at = now + TTL; trả { sessionId, sessionTokenRaw }.
   */
  async createSession(
    params: { userId: string; deviceId: string },
    tx: PrismaTx,
  ): Promise<{ sessionId: string; sessionTokenRaw: string }> {
    const { raw, hash } = this.tokenService.createSessionToken();
    const session = await tx.userSession.create({
      data: {
        user_id: params.userId,
        device_id: params.deviceId,
        token_hash: hash,
        expires_at: new Date(Date.now() + this.tokenService.getSessionTtlMs()),
        last_used_at: new Date(),
      },
    });
    return { sessionId: session.id, sessionTokenRaw: raw };
  }

  /**
   * Input: userId, deviceId, transaction client.
   * Output: Login/add-account — có phiên sống thì cấp token mới cho phiên đó, chưa có thì tạo mới. Trả raw token.
   */
  async createOrRefreshSession(params: { userId: string; deviceId: string }, tx: PrismaTx): Promise<string> {
    const existing = await tx.userSession.findFirst({
      where: { user_id: params.userId, device_id: params.deviceId, is_revoked: false, expires_at: { gt: new Date() } },
      orderBy: { created_at: 'desc' },
    });
    if (existing) {
      const { raw, hash } = this.tokenService.createSessionToken();
      await tx.userSession.update({
        where: { id: existing.id },
        data: {
          token_hash: hash,
          last_used_at: new Date(),
          expires_at: new Date(Date.now() + this.tokenService.getSessionTtlMs()),
        },
      });
      return raw;
    }
    const created = await this.createSession(params, tx);
    return created.sessionTokenRaw;
  }

  /**
   * Input: raw session token từ cookie + deviceId từ cookie.
   * Output: { userId, email, sessionId } nếu hợp lệ. Sai token/khác device → AUTH_001; revoked → AUTH_004; hết hạn → AUTH_005.
   *         Sliding renew: chỉ ghi DB khi thời gian còn lại dưới ngưỡng (mặc định <1 ngày).
   */
  async validateSession(
    rawToken: string,
    deviceId: string,
  ): Promise<{ userId: string; email: string; sessionId: string }> {
    const hash = this.tokenService.hashToken(rawToken);
    const session = await this.databaseService.userSession.findUnique({
      where: { token_hash: hash },
      include: { user: true },
    });
    const now = Date.now();
    if (!session || session.device_id !== deviceId) {
      throw new AppException(ERROR_CODES.AUTH_001);
    }
    if (session.is_revoked) {
      throw new AppException(ERROR_CODES.AUTH_004);
    }
    if (session.expires_at.getTime() <= now) {
      throw new AppException(ERROR_CODES.AUTH_005);
    }
    if (session.expires_at.getTime() - now < this.tokenService.getSessionRenewThresholdMs()) {
      await this.databaseService.userSession.update({
        where: { id: session.id },
        data: { last_used_at: new Date(), expires_at: new Date(now + this.tokenService.getSessionTtlMs()) },
      });
    }
    return { userId: session.user_id, email: session.user.email, sessionId: session.id };
  }

  /**
   * Input: deviceId (từ cookie), userId đích, transaction client.
   * Output: Account đã link + còn phiên sống → cấp token mới cho phiên đó, trả raw. Ngược lại AUTH_001 (cần login lại).
   */
  async switchActiveSession(params: { deviceId: string; userId: string }, tx: PrismaTx): Promise<string> {
    const link = await tx.deviceUser.findUnique({
      where: { device_id_user_id: { device_id: params.deviceId, user_id: params.userId } },
    });
    if (!link) throw new AppException(ERROR_CODES.AUTH_001);
    const session = await tx.userSession.findFirst({
      where: { user_id: params.userId, device_id: params.deviceId, is_revoked: false, expires_at: { gt: new Date() } },
      orderBy: { created_at: 'desc' },
    });
    if (!session) throw new AppException(ERROR_CODES.AUTH_001);
    const { raw, hash } = this.tokenService.createSessionToken();
    await tx.userSession.update({
      where: { id: session.id },
      data: {
        token_hash: hash,
        last_used_at: new Date(),
        expires_at: new Date(Date.now() + this.tokenService.getSessionTtlMs()),
      },
    });
    return raw;
  }

  /**
   * Input: raw session token, transaction client.
   * Output: Revoke session sở hữu token (reason 'logout'). Bỏ qua nếu không khớp.
   */
  async revokeByRawToken(rawToken: string, tx: PrismaTx): Promise<void> {
    const hash = this.tokenService.hashToken(rawToken);
    const session = await tx.userSession.findUnique({ where: { token_hash: hash } });
    if (!session) return;
    await this.revokeSession(session.id, 'logout', tx);
  }

  /**
   * Input: sessionId, userId chủ sở hữu, transaction client.
   * Output: Revoke session (reason 'revoked_remote') nếu thuộc user; AUTH_001 nếu không sở hữu.
   */
  async revokeSessionOwnedByUser(sessionId: string, userId: string, tx: PrismaTx): Promise<void> {
    const session = await tx.userSession.findFirst({ where: { id: sessionId, user_id: userId } });
    if (!session) throw new AppException(ERROR_CODES.AUTH_001);
    await this.revokeSession(sessionId, 'revoked_remote', tx);
  }

  /**
   * Input: userId.
   * Output: Danh sách session sống kèm device cho màn "thiết bị đang đăng nhập".
   */
  async listByUser(userId: string) {
    return this.databaseService.userSession.findMany({
      where: { user_id: userId, is_revoked: false, expires_at: { gt: new Date() } },
      include: { device: true },
      orderBy: { last_used_at: 'desc' },
    });
  }

  /**
   * Input: deviceId.
   * Output: user_id (distinct) của các account còn phiên sống trên device — để đánh dấu account cần login lại.
   */
  async listLiveUserIdsForDevice(deviceId: string): Promise<string[]> {
    const sessions = await this.databaseService.userSession.findMany({
      where: { device_id: deviceId, is_revoked: false, expires_at: { gt: new Date() } },
      select: { user_id: true },
    });
    return [...new Set(sessions.map((s) => s.user_id))];
  }

  /**
   * Input: sessionId, lý do revoke, transaction client.
   * Output: Đánh dấu session revoked.
   */
  private async revokeSession(sessionId: string, reason: RevokeReason, tx: PrismaTx): Promise<void> {
    await tx.userSession.update({
      where: { id: sessionId },
      data: { is_revoked: true, revoked_at: new Date(), revoke_reason: reason },
    });
  }
}
