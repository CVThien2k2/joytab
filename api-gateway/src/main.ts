import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
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
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    bodyParser: false,
  });
  app.useLogger(app.get(Logger));
  app.use(helmet({ contentSecurityPolicy: false }));
  // Allowlist origin (CORS_ALLOWED_ORIGINS, fallback FRONTEND_ORIGIN) — dùng chung với CSRF middleware.
  // Hỗ trợ wildcard subdomain (https://*.example.com) cho core cross-subdomain.
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
      // Origin lạ: KHÔNG ném Error (sẽ thành 500), chỉ không set CORS header → request đi tiếp
      // không kèm Access-Control-Allow-Origin (trình duyệt tự chặn đọc), và CSRF middleware trả 403 cho mutation.
      callback(null, false);
    },
    credentials: true,
  });
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 8000);
}
bootstrap().catch((err) => {
  console.error('Fatal error during gateway bootstrap:', err);
  process.exit(1);
});
