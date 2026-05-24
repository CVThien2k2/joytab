import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { JwtPayload, sign, verify } from 'jsonwebtoken';
import { ERROR_CODES } from '../common/constants/error-codes.constant';
import { AppException } from '../common/exceptions/app.exception';
import { getRequiredConfig } from '../common/utils/functions';

type GoogleChangeTokenPayload = JwtPayload & {
  email?: unknown;
  type?: unknown;
};

@Injectable()
export class TokenService {
  private static readonly ACCESS_TOKEN_TTL_SECONDS = 3600;
  private static readonly REFRESH_TOKEN_TTL_SECONDS = 604800;
  private static readonly GOOGLE_LOGIN_CODE_BYTES = 24;
  private static readonly GOOGLE_CHANGE_TOKEN_TTL_SECONDS = 60;
  private static readonly GOOGLE_CHANGE_TOKEN_ISSUER = 'joytab-api';
  private static readonly GOOGLE_CHANGE_TOKEN_AUDIENCE = 'joytab-google-exchange';
  private static readonly ACCESS_TOKEN_ISSUER = 'joytab-api';
  private static readonly ACCESS_TOKEN_AUDIENCE = 'joytab-access';
  private static readonly REFRESH_TOKEN_ISSUER = 'joytab-api';
  private static readonly REFRESH_TOKEN_AUDIENCE = 'joytab-refresh';

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

  /**
   * Input: User ID và email đã xác thực ở bước exchange code.
   * Output: JWT access token phục vụ xác thực các API nghiệp vụ.
   */
  createAccessToken(userId: string, email: string): string {
    return sign(
      {
        sub: userId.trim(),
        email: email.trim().toLowerCase(),
        type: 'access',
      },
      this.getAccessTokenSecret(),
      {
        algorithm: 'HS256',
        expiresIn: TokenService.ACCESS_TOKEN_TTL_SECONDS,
        issuer: TokenService.ACCESS_TOKEN_ISSUER,
        audience: TokenService.ACCESS_TOKEN_AUDIENCE,
      },
    );
  }

  /**
   * Input: User ID và email đã xác thực ở bước exchange code.
   * Output: JWT refresh token để backend cấp lại access token ở các lần sau.
   */
  createRefreshToken(userId: string, email: string): string {
    return sign(
      {
        sub: userId.trim(),
        email: email.trim().toLowerCase(),
        type: 'refresh',
      },
      this.getRefreshTokenSecret(),
      {
        algorithm: 'HS256',
        expiresIn: TokenService.REFRESH_TOKEN_TTL_SECONDS,
        issuer: TokenService.REFRESH_TOKEN_ISSUER,
        audience: TokenService.REFRESH_TOKEN_AUDIENCE,
      },
    );
  }

  /**
   * Input: JWT change token từ cookie HttpOnly ở callback Google.
   * Output: Trả email hợp lệ trong token; token sai/hết hạn sẽ ném AUTH_003.
   */
  parseGoogleChangeToken(changeToken: string): string {
    try {
      const verifiedPayload = verify(changeToken, this.getGoogleChangeTokenSecret(), {
        algorithms: ['HS256'],
        issuer: TokenService.GOOGLE_CHANGE_TOKEN_ISSUER,
        audience: TokenService.GOOGLE_CHANGE_TOKEN_AUDIENCE,
      }) as GoogleChangeTokenPayload;

      if (verifiedPayload.type !== 'google_callback_change' || typeof verifiedPayload.email !== 'string') {
        throw new AppException(ERROR_CODES.AUTH_003);
      }

      const normalizedEmail = verifiedPayload.email.trim().toLowerCase();
      if (!normalizedEmail) {
        throw new AppException(ERROR_CODES.AUTH_003);
      }

      return normalizedEmail;
    } catch (error) {
      if (error instanceof AppException) {
        throw error;
      }

      throw new AppException(ERROR_CODES.AUTH_003);
    }
  }

  /**
   * Input: Không nhận tham số.
   * Output: Trả TTL access token (giây) để service/controller tính thời điểm hết hạn.
   */
  getAccessTokenTtlSeconds(): number {
    return TokenService.ACCESS_TOKEN_TTL_SECONDS;
  }

  /**
   * Input: Không nhận tham số.
   * Output: Trả TTL refresh token (giây) để service/controller tính thời điểm hết hạn.
   */
  getRefreshTokenTtlSeconds(): number {
    return TokenService.REFRESH_TOKEN_TTL_SECONDS;
  }

  private getGoogleChangeTokenSecret(): string {
    return getRequiredConfig(this.configService, 'GOOGLE_CALLBACK_JWT_SECRET', ERROR_CODES.SYS_013);
  }

  private getAccessTokenSecret(): string {
    return getRequiredConfig(this.configService, 'ACCESS_TOKEN_JWT_SECRET', ERROR_CODES.SYS_014);
  }

  private getRefreshTokenSecret(): string {
    return getRequiredConfig(this.configService, 'REFRESH_TOKEN_JWT_SECRET', ERROR_CODES.SYS_015);
  }
}
