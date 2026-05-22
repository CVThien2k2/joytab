import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import { Response } from 'express';
import { ERROR_CODES } from '../constants/error-codes.constant';
import { AppException } from './app.exception';
import { ApiErrorResponse } from '../utils/types';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  /**
   * Input: Exception phát sinh trong pipeline HTTP và context request/response hiện tại.
   * Output: Trả JSON lỗi chuẩn hóa theo format success/code/message (details optional).
   */
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const status = this.getStatusCode(exception);
    const errorPayload = this.buildErrorPayload(exception);
    response.status(status).json(errorPayload);
  }

  /**
   * Input: Exception bất kỳ trong NestJS handler.
   * Output: Trả HTTP status tương ứng hoặc 500 nếu không xác định được.
   */
  private getStatusCode(exception: unknown): number {
    if (exception instanceof HttpException) {
      return exception.getStatus();
    }

    return 500;
  }

  /**
   * Input: Exception, HTTP status và request path hiện tại.
   * Output: Tạo payload lỗi đồng nhất để trả về cho client.
   */
  private buildErrorPayload(exception: unknown): ApiErrorResponse {
    if (exception instanceof AppException) {
      return {
        success: false,
        code: exception.code,
        message: exception.message,
      };
    }

    return {
      success: false,
      code: ERROR_CODES.UNKNOWN_001.code,
      message: this.extractThrownMessage(exception),
    };
  }

  /**
   * Input: Exception bất kỳ đã được throw trong pipeline request.
   * Output: Trả message gốc của exception; fallback message UNKNOWN khi không có.
   */
  private extractThrownMessage(exception: unknown): string {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      if (typeof response === 'string' && response.trim()) {
        return response;
      }

      if (
        typeof response === 'object' &&
        response !== null &&
        'message' in response
      ) {
        const message = (response as { message?: unknown }).message;
        if (Array.isArray(message) && message.length > 0) {
          return String(message[0]);
        }

        if (typeof message === 'string' && message.trim()) {
          return message;
        }
      }

      return exception.message;
    }

    if (exception instanceof Error && exception.message.trim()) {
      return exception.message;
    }

    if (typeof exception === 'string' && exception.trim()) {
      return exception;
    }

    return ERROR_CODES.UNKNOWN_001.message;
  }
}
