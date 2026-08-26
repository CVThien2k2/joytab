import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { createRequestContext, runWithRequestContext } from '../logging/request-context';

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  /**
   * Input: Request/Response của Express.
   * Output: Mở context cho request rồi log đúng MỘT dòng khi response kết thúc:
   *         `GET /auth/me 200 12ms`. Không log ip / user-agent / origin / referer / body —
   *         chỗ nào cần điều tra sâu thì đọc log của handler, không phải access log.
   *
   *         Chỉ log path, CẮT query string: `/auth/google/callback?code=...` mang
   *         authorization code của Google, không được rơi vào file log.
   */
  use(request: Request, response: Response, next: NextFunction): void {
    const context = createRequestContext();
    const startTime = Date.now();
    const path = request.originalUrl.split('?')[0];
    const method = request.method;

    // Chạy lại trong context: listener 'finish' của EventEmitter không chắc còn giữ được
    // AsyncLocalStorage, mà tag dòng log này do AppLogger chèn nên nó phải thấy context.
    response.on('finish', () => {
      runWithRequestContext(context, () => {
        const duration = Date.now() - startTime;
        const message = `${method} ${path} ${response.statusCode} ${duration}ms`;
        if (response.statusCode >= 500) this.logger.error(message);
        else if (response.statusCode >= 400) this.logger.warn(message);
        else this.logger.log(message);
      });
    });

    runWithRequestContext(context, () => next());
  }
}
