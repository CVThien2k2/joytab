import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { ACCESS_COOKIE_NAME } from '../../auth/auth.constants';
import { readCookieValue } from '../../auth/auth.utils';
import { AuthJwtService } from '../../auth/jwt.service';
import { ERROR_CODES } from '../constants/error-codes.constant';
import { AppException } from '../exceptions/app.exception';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  /**
   * Input: AuthJwtService để verify access token.
   * Output: Guard chặn request thiếu/không hợp lệ cookie `at`. Stateless — không chạm DB.
   */
  constructor(private readonly authJwtService: AuthJwtService) {}

  /**
   * Input: ExecutionContext của request HTTP.
   * Output: true nếu cookie `at` hợp lệ (gán req.userId/req.userEmail).
   *         Thiếu cookie → AUTH_001. Token hết hạn → AUTH_005 (FE sẽ refresh).
   *         Token sai chữ ký/sai typ → AUTH_001 (do AuthJwtService quyết định).
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { userId?: string; userEmail?: string }>();
    const accessToken = readCookieValue(request.headers.cookie, ACCESS_COOKIE_NAME);
    if (!accessToken) {
      throw new AppException(ERROR_CODES.AUTH_001);
    }
    const payload = await this.authJwtService.verifyAccessToken(accessToken);
    request.userId = payload.sub;
    request.userEmail = payload.email;
    return true;
  }
}
