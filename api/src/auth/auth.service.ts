import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { GoogleUser } from '../common/utils/types';
import { DatabaseService } from '../database/database.service';
import { TokenService } from './token.service';

type GoogleLoginCallbackArtifacts = {
  code: string;
  changeToken: string;
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
    console.log(changeToken);
    await this.cacheManager.set(this.getAuthCodeCacheKey(code), normalizedEmail, AuthService.GOOGLE_LOGIN_CODE_TTL_MS);
    return { code, changeToken };
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
