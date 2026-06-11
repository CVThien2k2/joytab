import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import { Response } from 'express';
import { AppException } from './app.exception';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  /**
   * Input: Exception trong pipeline + host.
   * Output: JSON lỗi chuẩn { success, code, message } đồng bộ với SSO/FE.
   */
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const status =
      exception instanceof HttpException ? exception.getStatus() : 500;
    const code =
      exception instanceof AppException ? exception.code : 'UNKNOWN_001';
    const message =
      exception instanceof HttpException
        ? exception.message
        : 'Internal server error';
    response.status(status).json({ success: false, code, message });
  }
}
