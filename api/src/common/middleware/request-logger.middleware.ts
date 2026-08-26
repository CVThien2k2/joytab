import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { createRequestContext, runWithRequestContext } from '../logging/request-context';

const NANOSECONDS_PER_MS = 1_000_000;

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  /**
   * Input: Request/Response của Express.
   * Output: Mở context cho request rồi log đúng MỘT dòng khi response kết thúc:
   *         `GET /auth/me status=200 time=2.4ms`. Không log ip / user-agent / origin /
   *         referer / body — chỗ nào cần điều tra sâu thì đọc log của handler.
   *
   *         Chỉ log path, CẮT query string: `/auth/google/callback?code=...` mang
   *         authorization code của Google, không được rơi vào file log.
   */
  use(request: Request, response: Response, next: NextFunction): void {
    const context = createRequestContext();
    // hrtime thay vì Date.now(): đồng hồ đơn điệu (NTP kéo giờ hệ thống không làm sai số đo)
    // và độ phân giải nanosecond — Date.now() chỉ tới ms nên request nhanh đều thành "0ms".
    const startedAt = process.hrtime.bigint();
    const path = request.originalUrl.split('?')[0];
    const method = request.method;

    let logged = false;

    /**
     * Input: `aborted` — client cắt kết nối trước khi response ghi xong.
     * Output: Log đúng một lần. Phải chốt bằng cờ vì cả 'finish' và 'close' đều bắn:
     *         bình thường 'finish' trước rồi 'close', còn khi client bỏ ngang thì
     *         CHỈ có 'close' — nếu chỉ nghe 'finish' thì request bị huỷ không có dòng log nào.
     */
    const logOnce = (aborted: boolean): void => {
      if (logged) return;
      logged = true;

      const elapsedMs = Number(process.hrtime.bigint() - startedAt) / NANOSECONDS_PER_MS;
      // Chạy lại trong context: listener của EventEmitter không chắc còn giữ được
      // AsyncLocalStorage, mà tag dòng log này do AppLogger chèn nên nó phải thấy context.
      runWithRequestContext(context, () => {
        const status = response.statusCode;
        const message = `${method} ${path} status=${status} time=${elapsedMs.toFixed(1)}ms${aborted ? ' aborted=true' : ''}`;
        if (aborted || status >= 500) this.logger.error(message);
        else if (status >= 400) this.logger.warn(message);
        else this.logger.log(message);
      });
    };

    response.on('finish', () => logOnce(false));
    response.on('close', () => logOnce(!response.writableFinished));

    runWithRequestContext(context, () => next());
  }
}
