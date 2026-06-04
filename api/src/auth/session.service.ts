import { Injectable } from '@nestjs/common';
import { ERROR_CODES } from '../common/constants/error-codes.constant';
import { AppException } from '../common/exceptions/app.exception';
import { DatabaseService } from '../database/database.service';
import { Prisma } from '../generated/prisma/client';
import { TokenService } from './token.service';

export type PrismaTx = Prisma.TransactionClient;

type ActiveSessionInfo = { sessionId: string; userId: string; deviceId: string };

type RevokeReason = 'logout' | 'reuse_detected' | 'revoked_remote';

@Injectable()
export class SessionService {
  /**
   * Input: DatabaseService cho query ngoài transaction, TokenService để tạo/băm refresh token.
   * Output: Service quản lý vòng đời UserSession + RefreshToken.
   */
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly tokenService: TokenService,
  ) {}

  /**
   * Input: userId, deviceId và transaction client.
   * Output: Tạo session mới + refresh token đầu tiên; trả { sessionId, refreshTokenRaw }.
   */
  async createSession(params: { userId: string; deviceId: string }, tx: PrismaTx) {
    const expiresAt = new Date(Date.now() + this.tokenService.getRefreshTokenTtlMs());
    const session = await tx.userSession.create({
      data: { user_id: params.userId, device_id: params.deviceId, expires_at: expiresAt },
    });
    const { raw, hash } = this.tokenService.createRefreshToken();
    await tx.refreshToken.create({
      data: { session_id: session.id, token_hash: hash, expires_at: expiresAt },
    });
    return { sessionId: session.id, refreshTokenRaw: raw };
  }

  /**
   * Input: refresh token raw từ cookie và transaction client.
   * Output: Rotate token (cấp mới, retire token cũ); trả { refreshTokenRaw, userId, email }.
   *         Phát hiện reuse/expired → revoke cả session và ném AUTH_005; không tìm thấy → AUTH_004.
   */
  async rotateByRawToken(
    rawToken: string,
    tx: PrismaTx,
  ): Promise<{ refreshTokenRaw: string; userId: string; email: string }> {
    const existing = await this.findValidTokenOrFail(rawToken, tx);
    const session = existing.session;
    const { raw, hash } = this.tokenService.createRefreshToken();
    const created = await tx.refreshToken.create({
      data: { session_id: session.id, token_hash: hash, expires_at: session.expires_at },
    });
    await tx.refreshToken.update({
      where: { id: existing.id },
      data: { used_at: new Date(), replaced_by_id: created.id },
    });
    await tx.userSession.update({ where: { id: session.id }, data: { last_used_at: new Date() } });
    return { refreshTokenRaw: raw, userId: session.user_id, email: session.user.email };
  }

  /**
   * Input: refresh token raw active và transaction client.
   * Output: Xác thực token còn hiệu lực (reuse detection như rotate, KHÔNG mutate); trả ids của session.
   */
  async validateActiveRawToken(rawToken: string, tx: PrismaTx): Promise<ActiveSessionInfo> {
    const existing = await this.findValidTokenOrFail(rawToken, tx);
    return { sessionId: existing.session.id, userId: existing.session.user_id, deviceId: existing.session.device_id };
  }

  /**
   * Input: session (id + expires_at) và transaction client.
   * Output: Retire mọi refresh token active của session rồi cấp 1 token mới; trả raw. Dùng khi exchange cấp lại token cho phiên đang tồn tại.
   */
  async issueFreshTokenForSession(session: { id: string; expires_at: Date }, tx: PrismaTx): Promise<string> {
    await tx.refreshToken.updateMany({
      where: { session_id: session.id, used_at: null, is_revoked: false },
      data: { used_at: new Date() },
    });
    const { raw, hash } = this.tokenService.createRefreshToken();
    await tx.refreshToken.create({
      data: { session_id: session.id, token_hash: hash, expires_at: session.expires_at },
    });
    await tx.userSession.update({ where: { id: session.id }, data: { last_used_at: new Date() } });
    return raw;
  }

  /**
   * Input: userId, deviceId và transaction client.
   * Output: Session còn sống (chưa revoke, chưa hết hạn) mới nhất cho cặp user+device, hoặc null.
   */
  async findActiveSession(userId: string, deviceId: string, tx: PrismaTx) {
    return tx.userSession.findFirst({
      where: { user_id: userId, device_id: deviceId, is_revoked: false, expires_at: { gt: new Date() } },
      orderBy: { created_at: 'desc' },
    });
  }

  /**
   * Input: refresh token raw và transaction client.
   * Output: Revoke session sở hữu token (reason 'logout') + mọi refresh token của nó. Bỏ qua nếu token không khớp.
   */
  async revokeByRawToken(rawToken: string, tx: PrismaTx): Promise<void> {
    const hash = this.tokenService.hashToken(rawToken);
    const token = await tx.refreshToken.findUnique({ where: { token_hash: hash }, include: { session: true } });
    if (!token?.session) return;
    await this.revokeSession(token.session.id, 'logout', tx);
  }

  /**
   * Input: sessionId, userId chủ sở hữu và transaction client.
   * Output: Revoke session (reason 'revoked_remote') nếu thuộc về user; ném AUTH_001 nếu không sở hữu.
   */
  async revokeSessionOwnedByUser(sessionId: string, userId: string, tx: PrismaTx): Promise<void> {
    const session = await tx.userSession.findFirst({ where: { id: sessionId, user_id: userId } });
    if (!session) throw new AppException(ERROR_CODES.AUTH_001);
    await this.revokeSession(sessionId, 'revoked_remote', tx);
  }

  /**
   * Input: userId.
   * Output: Danh sách session chưa revoke kèm device để hiển thị "thiết bị đang đăng nhập".
   */
  async listByUser(userId: string) {
    return this.databaseService.userSession.findMany({
      where: { user_id: userId, is_revoked: false, expires_at: { gt: new Date() } },
      include: { device: true },
      orderBy: { last_used_at: 'desc' },
    });
  }

  /**
   * Input: rawToken, tx.
   * Output: RefreshToken active (kèm session+user). Reuse/expired → revoke session + AUTH_005; không thấy → AUTH_004.
   */
  private async findValidTokenOrFail(rawToken: string, tx: PrismaTx) {
    // Giới hạn v1: kiểm tra read-then-write vẫn có cửa sổ TOCTOU nhỏ.
    // Hai request refresh đồng thời với cùng token có thể cùng đi qua bước check.
    // Hướng harden sau này: dùng atomic conditional UPDATE trên used_at/consumed_at.
    const hash = this.tokenService.hashToken(rawToken);
    const existing = await tx.refreshToken.findUnique({
      where: { token_hash: hash },
      include: { session: { include: { user: true } } },
    });
    if (!existing) {
      throw new AppException(ERROR_CODES.AUTH_004);
    }
    const session = existing.session;
    const expired = session.expires_at.getTime() <= Date.now();
    // Session đã chết (bị revoke ở nơi khác hoặc hết hạn): từ chối nhưng không revoke lại,
    // tránh ghi đè revoke_reason gốc phục vụ audit.
    if (session.is_revoked || expired) {
      throw new AppException(ERROR_CODES.AUTH_005);
    }
    // Token đã rotate/revoke nhưng bị dùng lại: revoke toàn bộ session/token family.
    if (existing.used_at || existing.is_revoked) {
      await this.revokeSession(session.id, 'reuse_detected', tx);
      throw new AppException(ERROR_CODES.AUTH_005);
    }
    return existing;
  }

  /**
   * Input: sessionId, lý do revoke, tx.
   * Output: Đánh dấu session revoked + revoke mọi refresh token chưa revoke của session.
   */
  private async revokeSession(sessionId: string, reason: RevokeReason, tx: PrismaTx): Promise<void> {
    await tx.userSession.update({
      where: { id: sessionId },
      data: { is_revoked: true, revoked_at: new Date(), revoke_reason: reason },
    });
    await tx.refreshToken.updateMany({
      where: { session_id: sessionId, is_revoked: false },
      data: { is_revoked: true },
    });
  }
}
