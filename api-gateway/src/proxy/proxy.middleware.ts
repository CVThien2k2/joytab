import { Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createProxyMiddleware, RequestHandler } from 'http-proxy-middleware';
import { NextFunction, Request, Response } from 'express';
import { ServerResponse } from 'http';
import { Logger } from 'nestjs-pino';
import { ERROR_CODES } from '../common/constants/error-codes.constant';

const PROXY_TIMEOUT_MS = Number(process.env.PROXY_TIMEOUT_MS) || 30_000;

@Injectable()
export class ProxyMiddleware implements NestMiddleware {
  private readonly proxy: RequestHandler;

  /**
   * Input: ConfigService (CORE_URL) + Logger (pino).
   * Output: Khởi tạo proxy sang core kèm timeout + xử lý lỗi upstream trả envelope chuẩn.
   */
  constructor(
    private readonly configService: ConfigService,
    private readonly logger: Logger,
  ) {
    const target =
      this.configService.get<string>('CORE_URL') ?? 'http://localhost:8001';
    this.proxy = createProxyMiddleware({
      target,
      changeOrigin: false,
      xfwd: true,
      proxyTimeout: PROXY_TIMEOUT_MS,
      on: {
        error: (err, req, res) => {
          const errCode = (err as NodeJS.ErrnoException).code;
          // proxyTimeout của httpxy KHÔNG surface là ETIMEDOUT mà huỷ socket →
          // err.code = 'ECONNRESET', message = 'socket hang up' (đã kiểm chứng thực tế).
          // → coi ECONNRESET / socket hang up (cùng ETIMEDOUT/ECONNABORTED) là TIMEOUT → SYS_504.
          // Connect thất bại thật (ECONNREFUSED/ENOTFOUND/EHOSTUNREACH) là UNREACHABLE → SYS_502.
          const isTimeout =
            errCode === 'ETIMEDOUT' ||
            errCode === 'ECONNABORTED' ||
            errCode === 'ECONNRESET' ||
            err.message === 'socket hang up';
          const item = isTimeout ? ERROR_CODES.SYS_504 : ERROR_CODES.SYS_502;
          const reqId =
            (req as { id?: string | number }).id ?? req.headers['x-request-id'];
          this.logger.error(
            { reqId, url: req.url, errCode },
            `Proxy → core lỗi: ${err.message}`,
          );
          if (res instanceof ServerResponse) {
            if (!res.headersSent) {
              res.writeHead(isTimeout ? 504 : 502, {
                'Content-Type': 'application/json',
              });
              res.end(
                JSON.stringify({
                  success: false,
                  code: item.code,
                  message: item.message,
                }),
              );
            } else {
              res.end();
            }
          } else {
            res.destroy();
          }
        },
      },
    });
  }

  /**
   * Input: request/response/next.
   * Output: Đẩy request xuống core (đã strip /api + forward x-request-id).
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
