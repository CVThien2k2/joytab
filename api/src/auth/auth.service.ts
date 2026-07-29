import { Injectable } from '@nestjs/common';
import { ERROR_CODES } from '../common/constants/error-codes.constant';
import { AppException } from '../common/exceptions/app.exception';
import { GoogleUser } from '../common/utils/types';
import { DatabaseService } from '../database/database.service';

type CurrentUser = { userId: string; user: GoogleUser };

@Injectable()
export class AuthService {
  /**
   * Input: DatabaseService.
   * Output: Service nghiệp vụ user của luồng auth. Việc cấp/xoay token nằm ở AuthJwtService
   *         và RefreshTokenService — service này không biết gì về token.
   */
  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Input: Google profile đã validate.
   * Output: Upsert user theo provider_user_id, trả { userId, user }. Không tạo session,
   *         không ghi nhận thiết bị.
   */
  async loginWithGoogle(googleUser: GoogleUser): Promise<CurrentUser> {
    const user = await this.upsertGoogleUser(googleUser);
    return { userId: user.id, user: this.toGoogleUser(user) };
  }

  /**
   * Input: userId từ JwtAuthGuard hoặc từ claim `sub` của refresh token.
   * Output: Thông tin user hiện tại; AUTH_001 nếu user không còn tồn tại.
   */
  async getMe(userId: string): Promise<CurrentUser> {
    const user = await this.databaseService.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppException(ERROR_CODES.AUTH_001);
    return { userId: user.id, user: this.toGoogleUser(user) };
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
   * Input: Google user đã validate.
   * Output: Upsert bản ghi users theo provider_user_id; trả user mới nhất.
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
}
