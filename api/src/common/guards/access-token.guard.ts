import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { ERROR_CODES } from '../constants/error-codes.constant';
import { AppException } from '../exceptions/app.exception';
import { TokenService } from '../../auth/token.service';

@Injectable()
export class AccessTokenGuard implements CanActivate {
  /**
   * Input: TokenService để verify JWT access token.
   * Output: Guard chặn request thiếu/không hợp lệ access token.
   */
  constructor(private readonly tokenService: TokenService) {}

  /**
   * Input: ExecutionContext của request HTTP.
   * Output: true nếu Bearer token hợp lệ (gán req.userId/req.userEmail); ném AUTH_001 nếu không.
   */
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & { userId?: string; userEmail?: string }>();
    const header = request.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw new AppException(ERROR_CODES.AUTH_001);
    }
    const token = header.slice('Bearer '.length).trim();
    const payload = this.tokenService.verifyAccessToken(token);
    request.userId = payload.sub;
    request.userEmail = payload.email;
    return true;
  }
}
