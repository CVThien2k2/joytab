import { Injectable } from '@nestjs/common';
import { ERROR_CODES } from '../common/constants/error-codes.constant';
import { AppException } from '../common/exceptions/app.exception';
import { DatabaseService } from '../database/database.service';
import { Prisma } from '../generated/prisma/client';
import { SessionRedisService } from './session-redis.service';
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
    private readonly sessionRedisService: SessionRedisService,
  ) {}

  /**
   * Input: userId, email, deviceId, transaction client.
   * Output: Tạo session mới (Postgres) + ghi Redis key; trả { sessionId, sessionTokenRaw }.
   */
  async createSession(
    params: { userId: string; email: string; deviceId: string },
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
    await this.sessionRedisService.putSession(hash, {
      userId: params.userId,
      email: params.email,
      sessionId: session.id,
      deviceId: params.deviceId,
    });
    return { sessionId: session.id, sessionTokenRaw: raw };
  }

  /**
   * Input: userId, email, deviceId, transaction client.
   * Output: Có phiên sống → cấp token mới + ghi Redis; chưa có → tạo mới. Trả raw token.
   */
  async createOrRefreshSession(params: { userId: string; email: string; deviceId: string }, tx: PrismaTx): Promise<string> {
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
      await this.sessionRedisService.putSession(hash, {
        userId: params.userId,
        email: params.email,
        sessionId: existing.id,
        deviceId: params.deviceId,
      });
      return raw;
    }
    const created = await this.createSession(params, tx);
    return created.sessionTokenRaw;
  }

  /**
   * Input: raw session token + deviceId từ cookie.
   * Output: { userId, email, sessionId, deviceId } nếu hợp lệ; đồng thời rehydrate Redis (warm cache).
   *         Sai token/khác device → AUTH_001; revoked → AUTH_004; hết hạn → AUTH_005. Sliding renew khi gần hết hạn.
   */
  async validateSession(
    rawToken: string,
    deviceId: string,
  ): Promise<{ userId: string; email: string; sessionId: string; deviceId: string }> {
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
    let expiresAtMs = session.expires_at.getTime();
    if (expiresAtMs - now < this.tokenService.getSessionRenewThresholdMs()) {
      expiresAtMs = now + this.tokenService.getSessionTtlMs();
      await this.databaseService.userSession.update({
        where: { id: session.id },
        data: { last_used_at: new Date(), expires_at: new Date(expiresAtMs) },
      });
    }
    // Rehydrate Redis (warm cache) với TTL còn lại — để gateway đọc nhanh lần sau sau khi Redis mất.
    await this.sessionRedisService.putSession(
      hash,
      { userId: session.user_id, email: session.user.email, sessionId: session.id, deviceId: session.device_id },
      expiresAtMs - now,
    );
    return { userId: session.user_id, email: session.user.email, sessionId: session.id, deviceId: session.device_id };
  }

  /**
   * Input: deviceId, userId đích, transaction client.
   * Output: Account còn phiên sống → cấp token mới + ghi Redis; ngược lại AUTH_001.
   */
  async switchActiveSession(params: { deviceId: string; userId: string }, tx: PrismaTx): Promise<string> {
    const link = await tx.deviceUser.findUnique({
      where: { device_id_user_id: { device_id: params.deviceId, user_id: params.userId } },
    });
    if (!link) throw new AppException(ERROR_CODES.AUTH_001);
    const session = await tx.userSession.findFirst({
      where: { user_id: params.userId, device_id: params.deviceId, is_revoked: false, expires_at: { gt: new Date() } },
      include: { user: true },
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
    await this.sessionRedisService.putSession(hash, {
      userId: params.userId,
      email: session.user.email,
      sessionId: session.id,
      deviceId: params.deviceId,
    });
    return raw;
  }

  /**
   * Input: raw session token, transaction client.
   * Output: Revoke session sở hữu token + xóa Redis key. Bỏ qua nếu không khớp.
   */
  async revokeByRawToken(rawToken: string, tx: PrismaTx): Promise<void> {
    const hash = this.tokenService.hashToken(rawToken);
    const session = await tx.userSession.findUnique({ where: { token_hash: hash } });
    if (!session) return;
    await this.revokeSession(session.id, 'logout', tx);
    await this.sessionRedisService.deleteSession(hash);
  }

  /**
   * Input: sessionId, userId chủ sở hữu, transaction client.
   * Output: Revoke session + xóa Redis key nếu thuộc user; AUTH_001 nếu không sở hữu.
   */
  async revokeSessionOwnedByUser(sessionId: string, userId: string, tx: PrismaTx): Promise<void> {
    const session = await tx.userSession.findFirst({ where: { id: sessionId, user_id: userId } });
    if (!session) throw new AppException(ERROR_CODES.AUTH_001);
    await this.revokeSession(sessionId, 'revoked_remote', tx);
    await this.sessionRedisService.deleteSession(session.token_hash);
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
