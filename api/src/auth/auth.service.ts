import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { ERROR_CODES } from '../common/constants/error-codes.constant';
import { AppException } from '../common/exceptions/app.exception';
import { GoogleUser } from '../common/utils/types';
import { DatabaseService } from '../database/database.service';
import { TokenService } from './token.service';

type GoogleLoginCallbackArtifacts = {
  code: string;
  changeToken: string;
};

type GoogleLoginExchangeArtifacts = {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
  user: GoogleUser;
};

@Injectable()
export class AuthService {
  private static readonly GOOGLE_LOGIN_CODE_TTL_MS = 60_000;
  private static readonly CACHE_AUTH_CODE_PREFIX = 'auth:google:code:';

  /**
   * Input: DatabaseService thao tác bảng users, Cache manager lưu code tạm thời, TokenService tạo/parse token payload.
   * Output: Khởi tạo service xử lý nghiệp vụ đăng nhập Google.
   */
  constructor(
    private readonly databaseService: DatabaseService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly tokenService: TokenService,
  ) {}

  /**
   * Input: Dữ liệu profile Google đã chuẩn hóa từ strategy.
   * Output: Tạo/cập nhật user đăng nhập Google và trả cặp code/changeToken cho callback FE.
   */
  async loginWithGoogle(googleUser: GoogleUser): Promise<GoogleLoginCallbackArtifacts> {
    const user = await this.upsertGoogleUser(googleUser);
    const code = this.tokenService.createGoogleLoginCode();
    const normalizedEmail = user.email.trim().toLowerCase();
    const changeToken = this.tokenService.createGoogleChangeToken(normalizedEmail);
    await this.cacheManager.set(this.getAuthCodeCacheKey(code), normalizedEmail, AuthService.GOOGLE_LOGIN_CODE_TTL_MS);
    return { code, changeToken };
  }

  /**
   * Input: Callback code từ FE và change token lấy từ cookie HttpOnly.
   * Output: Validate one-time code rồi trả access token + refresh token + Google user.
   */
  async exchangeGoogleLoginCode(code: string, changeToken: string): Promise<GoogleLoginExchangeArtifacts> {
    const normalizedCode = code.trim();
    if (!normalizedCode) {
      throw new AppException(ERROR_CODES.AUTH_003);
    }

    const normalizedEmailFromToken = this.tokenService.parseGoogleChangeToken(changeToken);
    const authCodeCacheKey = this.getAuthCodeCacheKey(normalizedCode);
    const normalizedEmailFromCode = await this.cacheManager.get<string>(authCodeCacheKey);
    if (!normalizedEmailFromCode || normalizedEmailFromCode !== normalizedEmailFromToken) {
      throw new AppException(ERROR_CODES.AUTH_003);
    }

    await this.cacheManager.del(authCodeCacheKey);
    const user = await this.databaseService.user.findUnique({
      where: { email: normalizedEmailFromToken },
    });
    if (!user) {
      throw new AppException(ERROR_CODES.AUTH_003);
    }

    const accessToken = this.tokenService.createAccessToken(user.id, normalizedEmailFromToken);
    const refreshToken = this.tokenService.createRefreshToken(user.id, normalizedEmailFromToken);
    const nowMs = Date.now();
    const accessTokenExpiresAt = new Date(nowMs + this.tokenService.getAccessTokenTtlSeconds() * 1000).toISOString();
    const refreshTokenExpiresAt = new Date(nowMs + this.tokenService.getRefreshTokenTtlSeconds() * 1000).toISOString();

    return {
      accessToken,
      refreshToken,
      accessTokenExpiresAt,
      refreshTokenExpiresAt,
      user: {
        provider: 'google',
        providerUserId: user.provider_user_id,
        email: user.email,
        emailVerified: user.email_verified,
        fullName: user.full_name,
        avatarUrl: user.avatar_url,
      },
    };
  }

  /**
   * Input: Dữ liệu Google user đã validate từ provider.
   * Output: Đồng bộ bản ghi users theo provider_user_id và trả user mới nhất.
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

  /**
   * Input: Mã code callback Google.
   * Output: Trả key cache chuẩn cho một mã code đăng nhập.
   */
  private getAuthCodeCacheKey(code: string): string {
    return `${AuthService.CACHE_AUTH_CODE_PREFIX}${code}`;
  }
}
