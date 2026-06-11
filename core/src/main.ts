import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import helmet from 'helmet';
import { HttpExceptionFilter } from './common/exceptions/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { CORE_TCP_PORT_DEFAULT } from './auth/auth.constants';

/**
 * Input: Không có tham số đầu vào.
 * Output: Khởi tạo ứng dụng NestJS và bật shutdown hooks để đóng tài nguyên đúng cách.
 */
async function bootstrap() {
  // Không dùng bufferLogs: buffer chỉ được flush khi app listen THÀNH CÔNG (hoặc khi
  // có exception đồng bộ lúc tạo instance). Nếu init bị treo — vd connectWithRetry
  // không kết nối được DB và lặp vô hạn — thì app.listen() không bao giờ tới bước flush,
  // nên mọi log bootstrap kẹt trong buffer và màn hình trống trơn. Để pino (nestjs-pino)
  // in trực tiếp ra stdout để luôn thấy tiến trình khởi động kể cả khi kết nối lỗi.
  const app = await NestFactory.create(AppModule);
  app.useLogger(app.get(Logger));
  app.use(helmet({ contentSecurityPolicy: false }));
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  // Microservice TCP cho gateway gọi introspect khi Redis miss (cache-aside fallback).
  // KHÔNG truyền inheritAppConfig: pipeline RPC tách khỏi enhancer HTTP (HttpExceptionFilter
  // switchToHttp() sẽ vỡ trong context RPC, ResponseInterceptor wrap thừa) — AuthRpcController
  // tự ném RpcException kèm code và trả raw payload.
  const tcpPort = Number(process.env.CORE_TCP_PORT) || CORE_TCP_PORT_DEFAULT;
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.TCP,
    options: { host: '0.0.0.0', port: tcpPort },
  });
  await app.startAllMicroservices();

  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap().catch((err) => {
  // Dùng console trực tiếp (đồng bộ) thay vì pino logger: lúc này logger có thể chưa sẵn
  // sàng hoặc queue async chưa kịp drain trước khi process thoát, dễ nuốt mất lỗi.
  console.error('Fatal error during bootstrap:', err);
  process.exit(1);
});
