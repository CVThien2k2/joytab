import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiSuccessResponse } from '../utils/types';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  /**
   * Input: Execution context và luồng dữ liệu response từ handler hiện tại.
   * Output: Chuẩn hóa success response về format chung nếu handler chưa tự wrap.
   */
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((data: unknown) => {
        if (this.isWrappedApiResponse(data)) {
          return data;
        }

        return {
          success: true,
          message: 'ok',
          data,
        } satisfies ApiSuccessResponse<unknown>;
      }),
    );
  }

  /**
   * Input: Payload trả về từ controller/service.
   * Output: Xác định payload đã ở format API chuẩn để tránh wrap lặp lần hai.
   */
  private isWrappedApiResponse(data: unknown): boolean {
    if (typeof data !== 'object' || data === null) {
      return false;
    }

    const response = data as Partial<ApiSuccessResponse<unknown>>;
    return response.success === true && typeof response.message === 'string';
  }
}
