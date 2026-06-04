import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { ERROR_CODES } from '../common/constants/error-codes.constant';
import { AppException } from '../common/exceptions/app.exception';
import { GoogleUser } from '../common/utils/types';
import { DatabaseService } from '../database/database.service';
import { DeviceService } from './device.service';
import { SessionService } from './session.service';
import { TokenService } from './token.service';

type GoogleLoginCallbackArtifacts = { code: string; changeToken: string };
type GoogleLoginCodeCacheValue = { email: string; changeTokenHash: string };
type ExchangeContext = {
  deviceFingerprint: string;
  deviceName?: string;
  userAgent?: string;
};
type AuthTokens = {
  userId: string;
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  user: GoogleUser;
};

@Injectable()
export class AuthService {
  private static readonly CACHE_AUTH_CODE_PREFIX = 'auth:google:code:';

  /**
   * Input: DatabaseService, Cache (login code), TokenService, SessionService, DeviceService.
   * Output: Service orchestrate toàn bộ nghiệp vụ đăng nhập/refresh/logout.
   */
  constructor(
    private readonly databaseService: DatabaseService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly tokenService: TokenService,
    private readonly sessionService: SessionService,
    private readonly deviceService: DeviceService,
  ) {}

  /**
   * Input: Profile Google đã chuẩn hóa.
   * Output: Upsert user + trả { code, changeToken } cho callback FE (giữ nguyên hành vi cũ).
   */
  async loginWithGoogle(googleUser: GoogleUser): Promise<GoogleLoginCallbackArtifacts> {
    const user = await this.upsertGoogleUser(googleUser);
    const normalizedEmail = user.email.trim().toLowerCase();
    const code = this.tokenService.createGoogleLoginCode();
    const { raw: changeTokenRaw, hash: changeTokenHash } = this.tokenService.createGoogleChangeToken();
    const cacheValue: GoogleLoginCodeCacheValue = { email: normalizedEmail, changeTokenHash };
    await this.cacheManager.set(
      this.getAuthCodeCacheKey(code),
      JSON.stringify(cacheValue),
      this.tokenService.getGoogleChangeTokenTtlSeconds() * 1000,
    );
    return { code, changeToken: changeTokenRaw };
  }

  /**
   * Input: code callback, change token raw từ cookie, ngữ cảnh thiết bị.
   * Output: Persist Device/DeviceUser/UserSession/RefreshToken trong transaction; trả access + refresh + user.
   */
  async exchangeGoogleLoginCode(code: string, changeToken: string, ctx: ExchangeContext): Promise<AuthTokens> {
    const normalizedCode = code.trim();
    if (!normalizedCode) throw new AppException(ERROR_CODES.AUTH_003);

    const cacheKey = this.getAuthCodeCacheKey(normalizedCode);
    const rawCache = await this.cacheManager.get<string>(cacheKey);
    if (!rawCache) throw new AppException(ERROR_CODES.AUTH_003);

    const cachedValue = this.parseGoogleLoginCodeCacheValue(rawCache);
    if (!cachedValue) throw new AppException(ERROR_CODES.AUTH_003);

    const incomingHash = this.tokenService.hashToken(changeToken);
    if (!this.tokenService.safeCompareHash(incomingHash, cachedValue.changeTokenHash)) {
      throw new AppException(ERROR_CODES.AUTH_003);
    }
    await this.cacheManager.del(cacheKey);

    const user = await this.databaseService.user.findUnique({ where: { email: cachedValue.email } });
    if (!user) throw new AppException(ERROR_CODES.AUTH_003);

    const refreshTokenRaw = await this.databaseService.$transaction(async (tx) => {
      const device = await this.deviceService.upsertDevice(
        { fingerprint: ctx.deviceFingerprint, deviceName: ctx.deviceName, userAgent: ctx.userAgent },
        tx,
      );
      await this.deviceService.linkDeviceUser({ deviceId: device.id, userId: user.id }, tx);
      // Multi-account: account đã có phiên sống thì cấp token mới cho phiên đó, chưa có thì tạo mới.
      // KHÔNG đụng account khác (mỗi account 1 cookie riêng).
      const existingSession = await this.sessionService.findActiveSession(user.id, device.id, tx);
      if (existingSession) {
        return this.sessionService.issueFreshTokenForSession(existingSession, tx);
      }
      const session = await this.sessionService.createSession({ userId: user.id, deviceId: device.id }, tx);
      return session.refreshTokenRaw;
    });

    return this.buildAuthTokens(user.id, cachedValue.email, refreshTokenRaw, this.toGoogleUser(user));
  }

  /**
   * Input: accountId (chủ cookie) + refresh token raw từ cookie rt_<accountId>.
   * Output: Rotate token + access token mới. Ném AUTH_001 nếu token không thuộc accountId.
   */
  async refresh(
    accountId: string,
    rawToken: string,
  ): Promise<{ userId: string; accessToken: string; accessTokenExpiresAt: string; refreshToken: string }> {
    const rotated = await this.databaseService.$transaction(async (tx) => {
      const active = await this.sessionService.validateActiveRawToken(rawToken, tx);
      if (active.userId !== accountId) {
        throw new AppException(ERROR_CODES.AUTH_001);
      }
      return this.sessionService.rotateByRawToken(rawToken, tx);
    });
    const accessToken = this.tokenService.createAccessToken(rotated.userId, rotated.email);
    return {
      userId: rotated.userId,
      accessToken,
      accessTokenExpiresAt: this.accessExpiry(),
      refreshToken: rotated.refreshTokenRaw,
    };
  }

  /**
   * Input: refresh token raw.
   * Output: Revoke session hiện tại (logout). Không ném lỗi nếu token đã không hợp lệ.
   */
  async logout(rawToken: string): Promise<void> {
    await this.databaseService.$transaction((tx) => this.sessionService.revokeByRawToken(rawToken, tx));
  }

  /**
   * Input: refresh token raw active.
   * Output: Danh sách account đã link với device hiện tại (cho UI account switcher).
   */
  async listAccounts(rawToken: string) {
    const active = await this.databaseService.$transaction((tx) =>
      this.sessionService.validateActiveRawToken(rawToken, tx),
    );
    const links = await this.deviceService.listAccountsByDevice(active.deviceId);
    return {
      accounts: links.map((l) => ({
        userId: l.user.id,
        email: l.user.email,
        fullName: l.user.full_name,
        avatarUrl: l.user.avatar_url,
        isActive: l.is_active,
      })),
    };
  }

  /**
   * Input: userId từ access token guard.
   * Output: Thông tin user hiện tại để FE hiển thị sau khi switch account.
   */
  async getMe(userId: string) {
    const user = await this.databaseService.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppException(ERROR_CODES.AUTH_001);
    return {
      userId: user.id,
      user: this.toGoogleUser(user),
    };
  }

  /**
   * Input: userId từ access token guard.
   * Output: Danh sách thiết bị + session của user.
   */
  async listDevices(userId: string) {
    const sessions = await this.sessionService.listByUser(userId);
    return {
      devices: sessions.map((s) => ({
        sessionId: s.id,
        deviceId: s.device_id,
        deviceName: s.device.device_name,
        platform: s.device.platform,
        lastSeenAt: s.device.last_seen_at,
        createdAt: s.created_at,
      })),
    };
  }

  /**
   * Input: sessionId cần revoke + userId chủ sở hữu.
   * Output: Revoke session từ xa nếu thuộc về user.
   */
  async revokeSession(sessionId: string, userId: string): Promise<void> {
    await this.databaseService.$transaction((tx) =>
      this.sessionService.revokeSessionOwnedByUser(sessionId, userId, tx),
    );
  }

  /**
   * Input: userId, email, refresh raw, googleUser.
   * Output: Đóng gói access token + expiry + refresh + user.
   */
  private buildAuthTokens(userId: string, email: string, refreshToken: string, user: GoogleUser): AuthTokens {
    const accessToken = this.tokenService.createAccessToken(userId, email);
    return { userId, accessToken, accessTokenExpiresAt: this.accessExpiry(), refreshToken, user };
  }

  private accessExpiry(): string {
    return new Date(Date.now() + this.tokenService.getAccessTokenTtlSeconds() * 1000).toISOString();
  }

  private toGoogleUser(user: {
    provider_user_id: string;
    email: string;
    email_verified: boolean;
    full_name: string | null;
    avatar_url: string | null;
  }): GoogleUser {
    return {
      provider: 'google',
      providerUserId: user.provider_user_id,
      email: user.email,
      emailVerified: user.email_verified,
      fullName: user.full_name,
      avatarUrl: user.avatar_url,
    };
  }

  /**
   * Input: Dữ liệu Google user đã validate.
   * Output: Upsert bản ghi users theo provider_user_id và trả user mới nhất.
   */
  private async upsertGoogleUser(googleUser: GoogleUser) {
    const now = new Date();
    return this.databaseService.user.upsert({
      where: { provider_user_id: googleUser.providerUserId },
      update: {
        provider: googleUser.provider,
        email: googleUser.email,
        email_verified: googleUser.emailVerified,
        full_name: googleUser.fullName,
        avatar_url: googleUser.avatarUrl,
        status: 'active',
        last_login_at: now,
        is_deleted: false,
        deleted_by: null,
        deleted_at: null,
      },
      create: {
        provider: googleUser.provider,
        provider_user_id: googleUser.providerUserId,
        email: googleUser.email,
        email_verified: googleUser.emailVerified,
        full_name: googleUser.fullName,
        avatar_url: googleUser.avatarUrl,
        status: 'active',
        last_login_at: now,
      },
    });
  }

  private getAuthCodeCacheKey(code: string): string {
    return `${AuthService.CACHE_AUTH_CODE_PREFIX}${code}`;
  }

  private parseGoogleLoginCodeCacheValue(rawCache: string): GoogleLoginCodeCacheValue | null {
    try {
      const parsed = JSON.parse(rawCache) as Partial<GoogleLoginCodeCacheValue>;
      if (typeof parsed.email !== 'string' || typeof parsed.changeTokenHash !== 'string') return null;
      const email = parsed.email.trim().toLowerCase();
      const changeTokenHash = parsed.changeTokenHash.trim().toLowerCase();
      if (!email || !changeTokenHash) return null;
      return { email, changeTokenHash };
    } catch {
      return null;
    }
  }
}
