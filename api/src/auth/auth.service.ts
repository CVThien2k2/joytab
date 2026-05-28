import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { ERROR_CODES } from '../common/constants/error-codes.constant';
import { AppException } from '../common/exceptions/app.exception';
import { GoogleUser } from '../common/utils/types';
import { DatabaseService } from '../database/database.service';
import { REFRESH_TOKEN_TTL_MS } from './auth.utils';
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

type GoogleLoginCodeCacheValue = {
  email: string;
  changeTokenHash: string;
};

@Injectable()
export class AuthService {
  private static readonly CACHE_AUTH_CODE_PREFIX = 'auth:google:code:';
  private static readonly CACHE_REFRESH_HASH_PREFIX = 'auth:refresh:hash:';

  /**
   * Input: DatabaseService thao tác bảng users, Cache manager lưu code/hash tạm thời, TokenService tạo/băm token.
   * Output: Khởi tạo service xử lý nghiệp vụ đăng nhập Google.
   */
  constructor(
    private readonly databaseService: DatabaseService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly tokenService: TokenService,
  ) {}

  /**
   * Input: Dữ liệu profile Google đã chuẩn hóa từ strategy.
   * Output: Tạo/cập nhật user đăng nhập Google và trả cặp { code, changeToken } cho callback FE.
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
   * Input: Callback code từ FE và change token raw lấy từ cookie HttpOnly.
   * Output: Validate one-time code + hash change token, sau đó trả access token + refresh token + Google user.
   */
  async exchangeGoogleLoginCode(code: string, changeToken: string): Promise<GoogleLoginExchangeArtifacts> {
    const normalizedCode = code.trim();
    if (!normalizedCode) {
      throw new AppException(ERROR_CODES.AUTH_003);
    }

    const cacheKey = this.getAuthCodeCacheKey(normalizedCode);
    const rawCache = await this.cacheManager.get<string>(cacheKey);
    if (!rawCache) {
      throw new AppException(ERROR_CODES.AUTH_003);
    }

    const cachedValue = this.parseGoogleLoginCodeCacheValue(rawCache);
    if (!cachedValue) {
      throw new AppException(ERROR_CODES.AUTH_003);
    }

    const incomingHash = this.tokenService.hashToken(changeToken);
    if (!this.tokenService.safeCompareHash(incomingHash, cachedValue.changeTokenHash)) {
      throw new AppException(ERROR_CODES.AUTH_003);
    }

    await this.cacheManager.del(cacheKey);

    const user = await this.databaseService.user.findUnique({
      where: { email: cachedValue.email },
    });
    if (!user) {
      throw new AppException(ERROR_CODES.AUTH_003);
    }

    const accessToken = this.tokenService.createAccessToken(user.id, cachedValue.email);
    const { raw: refreshTokenRaw, hash: refreshTokenHash } = this.tokenService.createRefreshToken();
    await this.cacheManager.set(this.getRefreshHashCacheKey(refreshTokenHash), user.id, REFRESH_TOKEN_TTL_MS);

    const nowMs = Date.now();
    const accessTokenExpiresAt = new Date(nowMs + this.tokenService.getAccessTokenTtlSeconds() * 1000).toISOString();
    const refreshTokenExpiresAt = new Date(nowMs + this.tokenService.getRefreshTokenTtlSeconds() * 1000).toISOString();

    return {
      accessToken,
      refreshToken: refreshTokenRaw,
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
   * Input: Refresh token raw (lấy từ cookie httpOnly khi user logout).
   * Output: Xoá hash trong Redis để token không thể dùng refresh nữa; không ném lỗi nếu hash đã hết.
   */
  async revokeRefreshToken(rawRefreshToken: string): Promise<void> {
    const trimmed = rawRefreshToken.trim();
    if (!trimmed) {
      return;
    }
    const hash = this.tokenService.hashToken(trimmed);
    await this.cacheManager.del(this.getRefreshHashCacheKey(hash));
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

  /**
   * Input: SHA-256 hash hex của refresh token.
   * Output: Trả key cache chuẩn cho hash refresh token.
   */
  private getRefreshHashCacheKey(hash: string): string {
    return `${AuthService.CACHE_REFRESH_HASH_PREFIX}${hash}`;
  }

  /**
   * Input: Chuỗi JSON đọc từ Redis cho key auth code.
   * Output: Trả object { email, changeTokenHash } nếu hợp lệ, null nếu sai cấu trúc.
   */
  private parseGoogleLoginCodeCacheValue(rawCache: string): GoogleLoginCodeCacheValue | null {
    try {
      const parsed = JSON.parse(rawCache) as Partial<GoogleLoginCodeCacheValue>;
      if (typeof parsed.email !== 'string' || typeof parsed.changeTokenHash !== 'string') {
        return null;
      }
      const email = parsed.email.trim().toLowerCase();
      const changeTokenHash = parsed.changeTokenHash.trim().toLowerCase();
      if (!email || !changeTokenHash) {
        return null;
      }
      return { email, changeTokenHash };
    } catch {
      return null;
    }
  }
}
