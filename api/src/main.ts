import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { HttpExceptionFilter } from './common/exceptions/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { AppLogger } from './common/loggers/app.logger';
import { AppModule } from './app.module';

/**
 * Input: Ứng dụng NestJS đã khởi tạo và sẵn sàng đăng ký middleware/route.
 * Output: Khởi tạo tài liệu Swagger/OpenAPI tại endpoint `/swagger` cho toàn bộ API.
 */
function setupSwagger(app: INestApplication) {
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Joytab API')
    .setDescription('Swagger/OpenAPI docs for Joytab backend services.')
    .setVersion('1.0.0')
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('swagger', app, swaggerDocument);
}

/**
 * Input: Không có tham số đầu vào.
 * Output: Khởi tạo ứng dụng NestJS và bật shutdown hooks để đóng tài nguyên đúng cách.
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: new AppLogger(),
  });
  setupSwagger(app);
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
