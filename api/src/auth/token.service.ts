import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { sign } from 'jsonwebtoken';
import { ERROR_CODES } from '../common/constants/error-codes.constant';
import { getRequiredConfig } from '../common/utils/functions';

@Injectable()
export class TokenService {
  private static readonly ACCESS_TOKEN_TTL_SECONDS = 3600;
  private static readonly REFRESH_TOKEN_TTL_SECONDS = 604800;
  private static readonly GOOGLE_LOGIN_CODE_BYTES = 24;
  private static readonly GOOGLE_CHANGE_TOKEN_TTL_SECONDS = 60;
  private static readonly GOOGLE_CHANGE_TOKEN_ISSUER = 'joytab-api';
  private static readonly GOOGLE_CHANGE_TOKEN_AUDIENCE = 'joytab-google-exchange';

  /**
   * Input: ConfigService chứa secret dùng để ký/xác thực JWT callback Google.
   * Output: Khởi tạo token service cho toàn bộ luồng auth.
   */
  constructor(private readonly configService: ConfigService) {}

  /**
   * Input: Không nhận tham số.
   * Output: Sinh mã code một lần dùng cho bước exchange sau callback OAuth.
   */
  createGoogleLoginCode(): string {
    return randomBytes(TokenService.GOOGLE_LOGIN_CODE_BYTES).toString('hex');
  }

  /**
   * Input: Email user đã xác thực Google ở bước callback.
   * Output: JWT change token ngắn hạn 60 giây để FE gửi kèm ở bước exchange.
   */
  createGoogleChangeToken(email: string): string {
    return sign(
      {
        email: email.trim().toLowerCase(),
        type: 'google_callback_change',
      },
      this.getGoogleChangeTokenSecret(),
      {
        algorithm: 'HS256',
        expiresIn: TokenService.GOOGLE_CHANGE_TOKEN_TTL_SECONDS,
        issuer: TokenService.GOOGLE_CHANGE_TOKEN_ISSUER,
        audience: TokenService.GOOGLE_CHANGE_TOKEN_AUDIENCE,
      },
    );
  }

  private getGoogleChangeTokenSecret(): string {
    return getRequiredConfig(this.configService, 'GOOGLE_CALLBACK_JWT_SECRET', ERROR_CODES.SYS_013);
  }
}
