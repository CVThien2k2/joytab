import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'crypto';
import { SessionStoreModule } from './session/session-store.module';
import { CsrfMiddleware } from './common/middleware/csrf.middleware';
import { GatewayAuthMiddleware } from './auth/gateway-auth.middleware';
import { ProxyMiddleware } from './proxy/proxy.middleware';
import { IntrospectService } from './auth/introspect.service';
import {
  CORE_CLIENT,
  CORE_TCP_PORT_DEFAULT,
} from './auth/core-client.constants';
import { HttpExceptionFilter } from './common/exceptions/http-exception.filter';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule.forRoot({
      pinoHttp: {
        // Gateway là cổng vào: sinh X-Request-Id nếu client chưa gửi, GẮN vào req.headers để proxy forward xuống core,
        // và echo ra response header. Core sẽ đọc lại id này → trace 1 request xuyên gateway→core.
        genReqId: (req, res) => {
          const incoming = req.headers['x-request-id'];
          const id = (typeof incoming === 'string' && incoming) || randomUUID();
          req.headers['x-request-id'] = id;
          res.setHeader('x-request-id', id);
          return id;
        },
        customProps: () => ({ service: 'gateway' }),
        // Log gọn: chỉ giữ reqId/method/url + status, bỏ toàn bộ header rác.
        serializers: {
          req: (req: { id: string | number; method: string; url: string }) => ({
            id: req.id,
            method: req.method,
            url: req.url,
          }),
          res: (res: { statusCode: number }) => ({
            statusCode: res.statusCode,
          }),
          err: (err: Error & { code?: string }) => {
            // Bỏ synthetic err pino-http tự tạo cho 5xx ("failed with status code N") — đã có dòng nguyên-nhân riêng.
            if (
              typeof err?.message === 'string' &&
              err.message.startsWith('failed with status code')
            ) {
              return undefined;
            }
            return { type: err.name, message: err.message, code: err.code };
          },
        },
        autoLogging: {
          ignore: (req: { url?: string }) => {
            const url = req.url ?? '';
            return url.startsWith('/.well-known/') || url === '/favicon.ico';
          },
        },
        level: process.env.LOG_LEVEL ?? 'info',
        redact: ['req.headers.cookie', 'req.headers.authorization'],
        transport:
          process.env.NODE_ENV === 'production'
            ? undefined
            : { target: 'pino-pretty', options: { singleLine: true } },
      },
    }),
    SessionStoreModule,
    // Client TCP tới core microservice — introspect khi Redis miss (cache-aside fallback).
    // host/port từ env (CORE_TCP_HOST/CORE_TCP_PORT), default localhost:8101.
    ClientsModule.registerAsync([
      {
        name: CORE_CLIENT,
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.TCP,
          options: {
            host: config.get<string>('CORE_TCP_HOST') ?? 'localhost',
            port:
              Number(config.get<string>('CORE_TCP_PORT')) ||
              CORE_TCP_PORT_DEFAULT,
          },
        }),
      },
    ]),
  ],
  controllers: [HealthController],
  providers: [
    IntrospectService,
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule implements NestModule {
  /**
   * Input: MiddlewareConsumer.
   * Output: Áp chuỗi CSRF → auth → proxy cho /api theo đúng thứ tự.
   */
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(CsrfMiddleware, GatewayAuthMiddleware, ProxyMiddleware)
      .forRoutes('/api');
  }
}
