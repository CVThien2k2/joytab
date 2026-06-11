import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Logger } from 'nestjs-pino';
import { AppException } from './app.exception';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  /**
   * Input: nestjs-pino Logger (qua DI) để ghi log lỗi chuẩn.
   * Output: Filter toàn cục chuẩn hoá envelope + log.
   */
  constructor(private readonly logger: Logger) {}

  /**
   * Input: Exception bất kỳ + host.
   * Output: JSON lỗi chuẩn { success, code, message } (đồng bộ core/FE); log 5xx kèm reqId/method/url.
   */
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { id?: string | number }>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const code = HttpExceptionFilter.resolveCode(exception, status);
    const message =
      exception instanceof HttpException
        ? exception.message
        : 'Internal server error';

    if (status >= 500) {
      this.logger.error(
        {
          reqId: request.id,
          method: request.method,
          url: request.originalUrl,
          status,
          code,
          err: exception,
        },
        `Gateway error ${status} ${code}`,
      );
    }
    if (!response.headersSent) {
      response.status(status).json({ success: false, code, message });
    }
  }

  /**
   * Input: exception + HTTP status.
   * Output: mã lỗi chuẩn — AppException dùng code của nó; HttpException khác suy theo status; còn lại SYS_001.
   */
  private static resolveCode(exception: unknown, status: HttpStatus): string {
    if (exception instanceof AppException) return exception.code;
    switch (status) {
      case HttpStatus.UNAUTHORIZED:
        return 'AUTH_001';
      case HttpStatus.FORBIDDEN:
        return 'AUTH_006';
      case HttpStatus.NOT_FOUND:
        return 'SYS_404';
      case HttpStatus.BAD_GATEWAY:
        return 'SYS_502';
      case HttpStatus.SERVICE_UNAVAILABLE:
        return 'SYS_503';
      case HttpStatus.GATEWAY_TIMEOUT:
        return 'SYS_504';
      default:
        return 'SYS_001';
    }
  }
}
