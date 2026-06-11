import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { ERROR_CODES } from '../constants/error-codes.constant';
import { AppException } from '../exceptions/app.exception';
import { DEVICE_COOKIE_NAME, SESSION_COOKIE_NAME } from '../../auth/auth.constants';
import { isUuid, readCookieValue } from '../../auth/auth.utils';
import { SessionService } from '../../auth/session.service';

@Injectable()
export class SessionGuard implements CanActivate {
  /**
   * Input: SessionService để xác thực session cookie.
   * Output: Guard chặn request thiếu/không hợp lệ session cookie.
   */
  constructor(private readonly sessionService: SessionService) {}

  /**
   * Input: ExecutionContext của request HTTP.
   * Output: true nếu cookie session_id + device_id hợp lệ (gán req.userId/req.userEmail); ném AUTH_001 nếu không.
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { userId?: string; userEmail?: string }>();
    const sessionToken = readCookieValue(request.headers.cookie, SESSION_COOKIE_NAME);
    const deviceId = readCookieValue(request.headers.cookie, DEVICE_COOKIE_NAME);
    if (!sessionToken || !isUuid(deviceId)) {
      throw new AppException(ERROR_CODES.AUTH_001);
    }
    const result = await this.sessionService.validateSession(sessionToken, deviceId);
    request.userId = result.userId;
    request.userEmail = result.email;
    return true;
  }
}
