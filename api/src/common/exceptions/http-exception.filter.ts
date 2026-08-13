import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { ERROR_CODES } from '../constants/error-codes.constant';
import { ApiErrorResponse, ErrorCodeValue } from '../utils/types';
import { AppException } from './app.exception';

/** Mã lỗi mặc định suy từ HTTP status khi exception không phải AppException. */
const CODE_BY_STATUS: Record<number, ErrorCodeValue> = {
  400: ERROR_CODES.VALIDATION_001.code,
  401: ERROR_CODES.AUTH_001.code,
  404: ERROR_CODES.SYS_404.code,
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpExceptionFilter');

  /**
   * Input: Exception phát sinh trong pipeline HTTP và context request/response hiện tại.
   * Output: Trả JSON lỗi chuẩn { success, code, message, details? } và log mọi lỗi 5xx.
   */
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException ? exception.getStatus() : ERROR_CODES.SYS_001.status;
    const code = this.resolveCode(exception, status);

    if (status >= 500) {
      this.logError(request, status, code, exception);
    }

    // Lỗi xảy ra sau khi handler đã bắt đầu ghi response (vd redirect OAuth) thì không
    // ghi đè được nữa — chỉ log rồi thôi, tránh ném tiếp "headers already sent".
    if (response.headersSent) return;

    const payload: ApiErrorResponse = {
      success: false,
      code,
      message: this.resolveMessage(exception, status),
    };
    const details = isHttpException ? this.extractValidationDetails(exception) : undefined;
    if (details !== undefined) payload.details = details;

    response.status(status).json(payload);
  }

  /**
   * Input: Exception bất kỳ và HTTP status đã xác định.
   * Output: AppException dùng chính `code` của nó; còn lại suy theo status, mặc định SYS_001.
   */
  private resolveCode(exception: unknown, status: number): ErrorCodeValue {
    if (exception instanceof AppException) return exception.code;

    return CODE_BY_STATUS[status] ?? ERROR_CODES.SYS_001.code;
  }

  /**
   * Input: Exception bất kỳ và HTTP status đã xác định.
   * Output: Message an toàn để trả client — lỗi 5xx luôn dùng message chuẩn, không lộ nội bộ.
   */
  private resolveMessage(exception: unknown, status: number): string {
    if (status >= 500) return ERROR_CODES.SYS_001.message;
    if (exception instanceof HttpException) return exception.message;

    return ERROR_CODES.SYS_001.message;
  }

  /**
   * Input: HttpException do ValidationPipe ném (response.message là mảng message).
   * Output: Trả mảng message đó làm `details`; các exception khác trả undefined.
   */
  private extractValidationDetails(exception: HttpException): unknown {
    const response = exception.getResponse();
    if (response && typeof response === 'object' && 'message' in response) {
      const message = response.message;
      if (Array.isArray(message) && message.length > 0) return message;
    }

    return undefined;
  }

  /**
   * Input: Request gốc, status/code đã xác định và exception thực tế.
   * Output: Ghi log lỗi 5xx; dev in stack, production chỉ in message.
   */
  private logError(request: Request, status: number, code: string, exception: unknown): void {
    const isProduction = process.env.NODE_ENV?.trim().toLowerCase() === 'production';
    const detail =
      exception instanceof Error
        ? ((isProduction ? exception.message : exception.stack) ?? exception.message)
        : String(exception);

    this.logger.error(`${request.method} ${request.originalUrl} -> ${status} ${code}: ${detail}`);
  }
}
