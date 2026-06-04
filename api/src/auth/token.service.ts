import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { JwtPayload, sign, verify } from 'jsonwebtoken';
import { AppException } from '../common/exceptions/app.exception';
import { ERROR_CODES } from '../common/constants/error-codes.constant';
import { getRequiredConfig } from '../common/utils/functions';

@Injectable()
export class TokenService {
  private static readonly ACCESS_TOKEN_TTL_SECONDS = 3600;
  private static readonly REFRESH_TOKEN_TTL_SECONDS = 604800;
  private static readonly GOOGLE_CHANGE_TOKEN_TTL_SECONDS = 60;
  private static readonly GOOGLE_LOGIN_CODE_BYTES = 24;
  private static readonly CHANGE_TOKEN_BYTES = 24;
  private static readonly REFRESH_TOKEN_BYTES = 32;
  private static readonly ACCESS_TOKEN_ISSUER = 'joytab-api';
  private static readonly ACCESS_TOKEN_AUDIENCE = 'joytab-access';

  /**
   * Input: ConfigService chứa JWT_SECRET để ký access token.
   * Output: Khởi tạo token service phục vụ toàn bộ luồng auth.
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
   * Input: Không nhận tham số.
   * Output: Trả cặp { raw, hash } cho google change token (raw cho cookie, hash lưu Redis).
   */
  createGoogleChangeToken(): { raw: string; hash: string } {
    const raw = randomBytes(TokenService.CHANGE_TOKEN_BYTES).toString('hex');
    return { raw, hash: this.hashToken(raw) };
  }

  /**
   * Input: Không nhận tham số.
   * Output: Trả cặp { raw, hash } cho refresh token (raw set cookie, hash lưu Redis).
   */
  createRefreshToken(): { raw: string; hash: string } {
    const raw = randomBytes(TokenService.REFRESH_TOKEN_BYTES).toString('hex');
    return { raw, hash: this.hashToken(raw) };
  }

  /**
   * Input: User ID và email đã xác thực ở bước exchange code.
   * Output: JWT access token HS256 phục vụ xác thực các API nghiệp vụ.
   */
  createAccessToken(userId: string, email: string): string {
    return sign(
      {
        sub: userId.trim(),
        email: email.trim().toLowerCase(),
        type: 'access',
      },
      this.getJwtSecret(),
      {
        algorithm: 'HS256',
        expiresIn: TokenService.ACCESS_TOKEN_TTL_SECONDS,
        issuer: TokenService.ACCESS_TOKEN_ISSUER,
        audience: TokenService.ACCESS_TOKEN_AUDIENCE,
      },
    );
  }

  /**
   * Input: Chuỗi token raw cần băm.
   * Output: SHA-256 hex digest dùng để so sánh với hash đã lưu Redis.
   */
  hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  /**
   * Input: Hai chuỗi hash hex (cùng độ dài) cần so sánh.
   * Output: true nếu giống nhau, false nếu khác — so sánh hằng thời gian chống timing attack.
   */
  safeCompareHash(a: string, b: string): boolean {
    if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) {
      return false;
    }
    const bufA = Buffer.from(a, 'hex');
    const bufB = Buffer.from(b, 'hex');
    if (bufA.length !== bufB.length) {
      return false;
    }
    return timingSafeEqual(bufA, bufB);
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

  /**
   * Input: Không nhận tham số.
   * Output: Trả TTL google change token (giây) phục vụ cấu hình cookie/Redis.
   */
  getGoogleChangeTokenTtlSeconds(): number {
    return TokenService.GOOGLE_CHANGE_TOKEN_TTL_SECONDS;
  }

  /**
   * Input: JWT access token cần xác thực.
   * Output: Trả { sub, email } nếu hợp lệ; ném AppException AUTH_001 nếu sai/hết hạn.
   */
  verifyAccessToken(token: string): { sub: string; email: string } {
    try {
      const payload = verify(token, this.getJwtSecret(), {
        algorithms: ['HS256'],
        issuer: TokenService.ACCESS_TOKEN_ISSUER,
        audience: TokenService.ACCESS_TOKEN_AUDIENCE,
      }) as JwtPayload;
      const sub = typeof payload.sub === 'string' ? payload.sub : '';
      const email = typeof payload.email === 'string' ? payload.email : '';
      if (!sub || !email) {
        throw new AppException(ERROR_CODES.AUTH_001);
      }
      return { sub, email };
    } catch (err) {
      if (err instanceof AppException) throw err;
      throw new AppException(ERROR_CODES.AUTH_001);
    }
  }

  /**
   * Input: Không nhận tham số.
   * Output: Trả TTL refresh token theo mili-giây để dựng expires_at.
   */
  getRefreshTokenTtlMs(): number {
    return TokenService.REFRESH_TOKEN_TTL_SECONDS * 1000;
  }

  /**
   * Input: Không nhận tham số.
   * Output: Trả JWT_SECRET từ cấu hình, ném AppException SYS_014 nếu thiếu biến.
   */
  private getJwtSecret(): string {
    return getRequiredConfig(this.configService, 'JWT_SECRET', ERROR_CODES.SYS_014);
  }
}
