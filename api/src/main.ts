import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { HttpExceptionFilter } from './common/exceptions/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { AppLogger } from './common/loggers/app.logger';
import { isOriginAllowed, resolveOriginAllowlist } from './common/utils/origin.util';
import { AppModule } from './app.module';

/**
 * Input: Không có tham số đầu vào.
 * Output: Khởi tạo ứng dụng NestJS và bật shutdown hooks để đóng tài nguyên đúng cách.
 */
async function bootstrap() {
  // Không dùng bufferLogs: buffer chỉ được flush khi app listen THÀNH CÔNG (hoặc khi
  // có exception đồng bộ lúc tạo instance). Nếu init bị treo — vd connectWithRetry
  // không kết nối được DB và lặp vô hạn — thì app.listen() không bao giờ tới bước flush,
  // nên mọi log bootstrap kẹt trong buffer và màn hình trống trơn. In trực tiếp để luôn
  // thấy tiến trình khởi động kể cả khi kết nối lỗi.
  const app = await NestFactory.create(AppModule);
  app.useLogger(app.get(AppLogger));
  app.use(helmet({ contentSecurityPolicy: false }));
  // Allowlist origin (CORS_ALLOWED_ORIGINS, fallback FRONTEND_ORIGIN) — dùng chung với CsrfGuard.
  // Hỗ trợ wildcard subdomain (https://*.example.com) cho SSO cross-subdomain.
  const allowlist = resolveOriginAllowlist((key) => process.env[key]);
  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // origin undefined: same-origin hoặc client non-browser (curl) → cho qua, CSRF guard chặn mutation.
      if (!origin || isOriginAllowed(origin, allowlist)) {
        callback(null, true);
        return;
      }
      callback(new Error(`Origin not allowed by CORS: ${origin}`), false);
    },
    credentials: true,
  });
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap().catch((err) => {
  // Dùng console trực tiếp (đồng bộ) thay vì AppLogger: lúc này logger có thể chưa sẵn
  // sàng hoặc queue async chưa kịp drain trước khi process thoát, dễ nuốt mất lỗi.
  console.error('Fatal error during bootstrap:', err);
  process.exit(1);
});
