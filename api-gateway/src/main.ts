import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { HttpExceptionFilter } from './common/exceptions/http-exception.filter';
import { AppModule } from './app.module';
import {
  isOriginAllowed,
  resolveOriginAllowlist,
} from './common/utils/origin.util';

/**
 * Input: Không có tham số.
 * Output: Khởi tạo gateway NestJS, bật helmet + filter lỗi + shutdown hooks, listen PORT (default 8000).
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(helmet({ contentSecurityPolicy: false }));
  // Allowlist origin (CORS_ALLOWED_ORIGINS, fallback FRONTEND_ORIGIN) — dùng chung với CSRF middleware.
  // Hỗ trợ wildcard subdomain (https://*.example.com) cho SSO cross-subdomain.
  const allowlist = resolveOriginAllowlist((key) => process.env[key]);
  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      // origin undefined: same-origin hoặc client non-browser (curl) → cho qua, CSRF middleware chặn mutation.
      if (!origin || isOriginAllowed(origin, allowlist)) {
        callback(null, true);
        return;
      }
      callback(new Error(`Origin not allowed by CORS: ${origin}`), false);
    },
    credentials: true,
  });
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 8000);
}
bootstrap().catch((err) => {
  console.error('Fatal error during gateway bootstrap:', err);
  process.exit(1);
});
