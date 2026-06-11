import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SessionStoreModule } from './session/session-store.module';
import { CsrfMiddleware } from './common/middleware/csrf.middleware';
import { GatewayAuthMiddleware } from './auth/gateway-auth.middleware';
import { ProxyMiddleware } from './proxy/proxy.middleware';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), SessionStoreModule],
  controllers: [],
  providers: [],
})
export class AppModule implements NestModule {
  /**
   * Input: MiddlewareConsumer.
   * Output: Áp chuỗi CSRF → auth → proxy cho /auth và /api theo đúng thứ tự.
   */
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(CsrfMiddleware, GatewayAuthMiddleware, ProxyMiddleware)
      .forRoutes('/auth', '/api');
  }
}
