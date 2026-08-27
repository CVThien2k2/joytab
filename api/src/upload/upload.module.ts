import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from './storage.module';
import { UploadController } from './upload.controller';

/**
 * Tầng HTTP của luồng upload: cấp presigned POST và xoá ảnh mồ côi.
 *
 * AuthModule chỉ để lấy AuthJwtService cho JwtAuthGuard — module này không biết gì về luồng
 * đăng nhập. Service nằm ở StorageModule để AuthModule dùng được mà không tạo vòng.
 */
@Module({
  imports: [AuthModule, StorageModule],
  controllers: [UploadController],
})
export class UploadModule {}
