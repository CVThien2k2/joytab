import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { ERROR_CODES } from '../constants/error-codes.constant';
import { AppException } from '../exceptions/app.exception';

/**
 * Input: Request đã qua JwtAuthGuard.
 * Output: userId của người gọi. Ném AUTH_001 nếu handler quên gắn JwtAuthGuard — thà lỗi
 *         500-hoá-401 rõ ràng còn hơn để `undefined` chảy xuống query và lọt dữ liệu.
 */
export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): string => {
  const request = context.switchToHttp().getRequest<Request>();
  if (!request.userId) throw new AppException(ERROR_CODES.AUTH_001);

  return request.userId;
});
