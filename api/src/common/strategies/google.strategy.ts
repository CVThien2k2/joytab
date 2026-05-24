import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy } from 'passport-google-oauth20';
import { ERROR_CODES } from '../constants/error-codes.constant';
import { AppException } from '../exceptions/app.exception';
import { getRequiredConfig } from '../utils/functions';
import { GoogleUser } from '../utils/types';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  /**
   * Input: ConfigService chứa GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL.
   * Output: Khởi tạo Google OAuth strategy cho Passport trong NestJS.
   */
  constructor(configService: ConfigService) {
    super({
      clientID: getRequiredConfig(configService, 'GOOGLE_CLIENT_ID', ERROR_CODES.SYS_002),
      clientSecret: getRequiredConfig(configService, 'GOOGLE_CLIENT_SECRET', ERROR_CODES.SYS_003),
      callbackURL: getRequiredConfig(configService, 'GOOGLE_CALLBACK_URL', ERROR_CODES.SYS_004),
      scope: ['email', 'profile'],
    });
  }

  /**
   * Input: Hồ sơ người dùng từ Google sau khi xác thực OAuth thành công.
   * Output: Chuẩn hóa profile Google thành dữ liệu user nội bộ để lưu vào DB.
   */
  validate(_accessToken: string, _refreshToken: string, profile: Profile): GoogleUser {
    const primaryEmail = profile.emails?.[0]?.value;
    if (!primaryEmail) throw new AppException(ERROR_CODES.AUTH_002);

    const fullName = profile.displayName?.trim() || null;
    const avatarUrl = profile.photos?.[0]?.value ?? null;
    return {
      provider: 'google',
      providerUserId: profile.id,
      email: primaryEmail.toLowerCase(),
      emailVerified: true,
      fullName,
      avatarUrl,
    };
  }
}
