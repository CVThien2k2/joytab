import { Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createProxyMiddleware, RequestHandler } from 'http-proxy-middleware';
import { NextFunction, Request, Response } from 'express';

@Injectable()
export class ProxyMiddleware implements NestMiddleware {
  private readonly proxy: RequestHandler;

  /**
   * Input: ConfigService chứa SSO_URL.
   * Output: Khởi tạo proxy stream sang SSO, giữ nguyên path, forward cookie + Set-Cookie + redirect 302.
   */
  constructor(private readonly configService: ConfigService) {
    const target =
      this.configService.get<string>('SSO_URL') ?? 'http://localhost:8001';
    this.proxy = createProxyMiddleware({
      target,
      changeOrigin: false,
      xfwd: true,
    });
  }

  /**
   * Input: request/response/next.
   * Output: Đẩy request xuống SSO.
   */
  use(req: Request, res: Response, next: NextFunction): void {
    void this.proxy(req, res, next);
  }
}
