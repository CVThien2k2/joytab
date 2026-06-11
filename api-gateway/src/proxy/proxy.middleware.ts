import { Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createProxyMiddleware, RequestHandler } from 'http-proxy-middleware';
import { NextFunction, Request, Response } from 'express';

@Injectable()
export class ProxyMiddleware implements NestMiddleware {
  private readonly proxy: RequestHandler;

  /**
   * Input: ConfigService chứa CORE_URL.
   * Output: Khởi tạo proxy stream sang core, giữ nguyên path, forward cookie + Set-Cookie + redirect 302.
   */
  constructor(private readonly configService: ConfigService) {
    const target =
      this.configService.get<string>('CORE_URL') ?? 'http://localhost:8001';
    this.proxy = createProxyMiddleware({
      target,
      changeOrigin: false,
      xfwd: true,
    });
  }

  /**
   * Input: request/response/next.
   * Output: Đẩy request xuống core.
   */
  use(req: Request, res: Response, next: NextFunction): void {
    // Gateway expose dưới /api; bỏ tiền tố /api rồi forward phần còn lại (/v1/...) xuống core.
    req.url = req.originalUrl.replace(/^\/api/, '');
    // Đảm bảo X-Request-Id được forward xuống core kể cả khi thứ tự middleware đổi.
    // req.id do pino-http (genReqId) gán; no-op khi header đã có sẵn.
    const reqId = (req as { id?: string | number }).id;
    if (!req.headers['x-request-id'] && reqId) {
      req.headers['x-request-id'] = String(reqId);
    }
    void this.proxy(req, res, next);
  }
}
