import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ERROR_CODES } from '../common/constants/error-codes.constant';
import { AppException } from '../common/exceptions/app.exception';
import { getRequiredConfig } from '../common/utils/functions';
import { ACCESS_TOKEN_TTL_SECONDS, ACCESS_TOKEN_TYPE } from './auth.constants';

export type AccessTokenPayload = { sub: string; email: string; typ: typeof ACCESS_TOKEN_TYPE };

/**
 * Bọc JwtService của @nestjs/jwt (đặt tên khác để không trùng) — nơi duy nhất biết về
 * secret, TTL và cách map lỗi JWT sang error code của dự án.
 *
 * CHỈ access token là JWT. Refresh token là chuỗi random opaque, do RefreshTokenService lo.
 */
@Injectable()
export class AuthJwtService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Input: userId + email của user đã xác thực.
   * Output: Access token JWT (HS256, TTL 1 giờ) để set vào cookie `at`.
   */
  async signAccessToken(params: { userId: string; email: string }): Promise<string> {
    return this.jwtService.signAsync(
      { sub: params.userId, email: params.email, typ: ACCESS_TOKEN_TYPE },
      { secret: this.getAccessSecret(), expiresIn: ACCESS_TOKEN_TTL_SECONDS },
    );
  }

  /**
   * Input: Chuỗi access token từ cookie `at`.
   * Output: Payload nếu hợp lệ.
   *         CHỈ khi token hết hạn thì ném AUTH_005 — FE dựa vào đúng mã này để gọi
   *         /auth/refresh. Sai chữ ký / malformed / sai `typ` đều ném AUTH_001 để FE về
   *         thẳng /login, không kéo nhau vào vòng refresh vô nghĩa với token rác.
   */
  async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    let payload: AccessTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token, {
        secret: this.getAccessSecret(),
      });
    } catch (err) {
      // So sánh theo `name` thay vì `instanceof TokenExpiredError`: `jsonwebtoken` là
      // transitive dependency của @nestjs/jwt, pnpm không cho import trực tiếp.
      if (err instanceof Error && err.name === 'TokenExpiredError') {
        throw new AppException(ERROR_CODES.AUTH_005);
      }
      throw new AppException(ERROR_CODES.AUTH_001);
    }
    if (payload.typ !== ACCESS_TOKEN_TYPE || !payload.sub) {
      throw new AppException(ERROR_CODES.AUTH_001);
    }
    return payload;
  }

  private getAccessSecret(): string {
    return getRequiredConfig(this.configService, 'JWT_ACCESS_SECRET', ERROR_CODES.SYS_014);
  }
}
