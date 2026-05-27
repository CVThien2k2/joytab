import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

const SENSITIVE_KEYS = new Set([
  'password',
  'pwd',
  'token',
  'accessToken',
  'refreshToken',
  'changeToken',
  'code',
  'secret',
  'apiKey',
  'authorization',
]);

const MAX_BODY_LENGTH = 500;

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(request: Request, response: Response, next: NextFunction): void {
    const startTime = Date.now();
    const { method, originalUrl } = request;
    const ip = request.ip ?? request.socket.remoteAddress ?? '-';
    const userAgent = request.get('user-agent') ?? '-';
    const referer = request.get('referer');
    const origin = request.get('origin');
    const body = RequestLoggerMiddleware.serializeBody(request.body);

    response.on('finish', () => {
      const duration = Date.now() - startTime;
      const { statusCode } = response;
      const contentLength = response.get('content-length') ?? '0';

      const parts = [
        `${method.padEnd(6)} ${originalUrl}`,
        `${statusCode} (${duration}ms) [${contentLength}b]`,
        `ip=${ip}`,
      ];
      if (origin) parts.push(`origin=${origin}`);
      if (referer) parts.push(`referer=${referer}`);
      parts.push(`ua="${userAgent}"`);
      if (body) parts.push(`body=${body}`);

      const message = parts.join(' | ');
      if (statusCode >= 500) this.logger.error(message);
      else if (statusCode >= 400) this.logger.warn(message);
      else this.logger.log(message);
    });

    next();
  }

  private static serializeBody(body: unknown): string | null {
    if (!body || typeof body !== 'object') return null;
    const redacted = RequestLoggerMiddleware.redact(body);
    const serialized = JSON.stringify(redacted);
    if (serialized === '{}') return null;
    return serialized.length > MAX_BODY_LENGTH ? `${serialized.slice(0, MAX_BODY_LENGTH)}...` : serialized;
  }

  private static redact(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((item) => RequestLoggerMiddleware.redact(item));
    if (value && typeof value === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
        result[key] = SENSITIVE_KEYS.has(key) ? '***' : RequestLoggerMiddleware.redact(val);
      }
      return result;
    }
    return value;
  }
}
