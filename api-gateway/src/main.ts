import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { HttpExceptionFilter } from './common/exceptions/http-exception.filter';
import { AppModule } from './app.module';

/**
 * Input: Không có tham số.
 * Output: Khởi tạo gateway NestJS, bật helmet + filter lỗi + shutdown hooks, listen PORT (default 8000).
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(helmet({ contentSecurityPolicy: false }));
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 8000);
}
bootstrap().catch((err) => {
  console.error('Fatal error during gateway bootstrap:', err);
  process.exit(1);
});
