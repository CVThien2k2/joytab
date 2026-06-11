import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'crypto';
import { SessionStoreModule } from './session/session-store.module';
import { CsrfMiddleware } from './common/middleware/csrf.middleware';
import { GatewayAuthMiddleware } from './auth/gateway-auth.middleware';
import { ProxyMiddleware } from './proxy/proxy.middleware';
import { IntrospectService } from './auth/introspect.service';

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
        autoLogging: true,
        level: process.env.LOG_LEVEL ?? 'info',
        redact: ['req.headers.cookie', 'req.headers.authorization'],
        transport:
          process.env.NODE_ENV === 'production'
            ? undefined
            : { target: 'pino-pretty', options: { singleLine: true } },
      },
    }),
    SessionStoreModule,
  ],
  controllers: [],
  providers: [IntrospectService],
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
