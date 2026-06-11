import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { ERROR_CODES } from '../constants/error-codes.constant';
import { AppException } from '../exceptions/app.exception';

@Injectable()
export class GatewayUserGuard implements CanActivate {
  /**
   * Input: ExecutionContext của request đã qua gateway.
   * Output: true nếu có header X-User-Id (gán req.userId/req.userEmail); ném AUTH_001 nếu thiếu.
   *         An toàn vì SSO chỉ gateway gọi tới; gateway đã strip header giả mạo từ client.
   */
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & { userId?: string; userEmail?: string }>();
    const userId = request.headers['x-user-id'];
    if (typeof userId !== 'string' || userId.length === 0) {
      throw new AppException(ERROR_CODES.AUTH_001);
    }
    request.userId = userId;
    const email = request.headers['x-user-email'];
    if (typeof email === 'string') request.userEmail = email;
    return true;
  }
}
