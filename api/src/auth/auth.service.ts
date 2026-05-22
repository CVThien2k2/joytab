import { Injectable } from '@nestjs/common';
import {
  ApiSuccessResponse,
  GoogleUser,
} from '../common/utils/types';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class AuthService {
  /**
   * Input: DatabaseService để thao tác bảng users.
   * Output: Khởi tạo service xử lý nghiệp vụ đăng nhập Google.
   */
  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Input: Dữ liệu profile Google đã chuẩn hóa từ strategy.
   * Output: Tạo/cập nhật user đăng nhập Google và trả dữ liệu phiên đăng nhập cơ bản.
   */
  async loginWithGoogle(googleUser: GoogleUser): Promise<
    ApiSuccessResponse<{
      userId: string;
      email: string;
      fullName: string | null;
      avatarUrl: string | null;
      provider: string;
      providerUserId: string;
      lastLoginAt: Date | null;
    }>
  > {
    const user = await this.upsertGoogleUser(googleUser);

    return {
      success: true,
      message: 'Google login initialized successfully',
      data: {
        userId: user.id,
        email: user.email,
        fullName: user.full_name,
        avatarUrl: user.avatar_url,
        provider: user.provider,
        providerUserId: user.provider_user_id,
        lastLoginAt: user.last_login_at,
      },
    };
  }

  /**
   * Input: Dữ liệu Google user đã validate từ provider.
   * Output: Đồng bộ bản ghi users theo provider_user_id hoặc email và trả user mới nhất.
   */
  private async upsertGoogleUser(googleUser: GoogleUser) {
    const now = new Date();
    const existingByProvider = await this.databaseService.user.findUnique({
      where: { provider_user_id: googleUser.providerUserId },
    });

    if (existingByProvider) {
      return this.databaseService.user.update({
        where: { id: existingByProvider.id },
        data: {
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
      });
    }

    const existingByEmail = await this.databaseService.user.findUnique({
      where: { email: googleUser.email },
    });

    if (existingByEmail) {
      return this.databaseService.user.update({
        where: { id: existingByEmail.id },
        data: {
          provider: googleUser.provider,
          provider_user_id: googleUser.providerUserId,
          email_verified: googleUser.emailVerified,
          full_name: googleUser.fullName,
          avatar_url: googleUser.avatarUrl,
          status: 'active',
          last_login_at: now,
          is_deleted: false,
          deleted_by: null,
          deleted_at: null,
        },
      });
    }

    return this.databaseService.user.create({
      data: {
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
