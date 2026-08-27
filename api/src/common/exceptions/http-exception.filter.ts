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
  429: ERROR_CODES.SYS_429.code,
};

/**
 * Tra message theo mã lỗi. Toàn bộ message trả cho client đều lấy từ bảng này, KHÔNG lấy
 * `exception.message` của Nest: những chuỗi đó là tiếng Anh ("Bad Request Exception",
 * "Cannot GET /x", "Too Many Requests") và người dùng cuối là người đọc chúng.
 */
const MESSAGE_BY_CODE: Record<string, string> = Object.fromEntries(
  Object.values(ERROR_CODES).map((item) => [item.code, item.message]),
);

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
      message: this.resolveMessage(code, status),
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
   * Input: Mã lỗi đã xác định và HTTP status.
   * Output: Message tiếng Việt tương ứng với mã đó.
   *
   *         Lỗi 5xx luôn dùng message chuẩn để không lộ chi tiết nội bộ; chi tiết thật đã
   *         nằm trong log. Mã lạ (không có trong bảng) cũng rơi về đó.
   *
   *         Riêng lỗi validate: message ở đây chỉ nói chung chung, còn field nào sai nằm ở
   *         `details` do ValidationPipe sinh — các message đó đã viết tiếng Việt trong DTO.
   */
  private resolveMessage(code: ErrorCodeValue, status: number): string {
    if (status >= 500) return ERROR_CODES.SYS_001.message;

    return MESSAGE_BY_CODE[code] ?? ERROR_CODES.SYS_001.message;
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
   *         Chỉ log path, CẮT query string — `/auth/google/callback?code=...` mang
   *         authorization code của Google, không được rơi vào file log.
   */
  private logError(request: Request, status: number, code: string, exception: unknown): void {
    const isProduction = process.env.NODE_ENV?.trim().toLowerCase() === 'production';
    const detail =
      exception instanceof Error
        ? ((isProduction ? exception.message : exception.stack) ?? exception.message)
        : String(exception);

    const path = request.originalUrl.split('?')[0];
    this.logger.error(`${request.method} ${path} -> ${status} ${code}: ${detail}`);
  }
}
