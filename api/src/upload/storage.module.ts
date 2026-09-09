import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { UploadService } from './upload.service';

/**
 * Chỉ chứa UploadService, KHÔNG có controller — nên không cần JwtAuthGuard, nên không cần
 * AuthModule.
 *
 * Tách khỏi UploadModule để phá vòng phụ thuộc: AuthService cần UploadService (dọn ảnh cũ khi
 * user đổi avatar), mà UploadModule lại cần AuthModule cho guard. AuthModule → StorageModule
 * là một chiều, hết vòng.
 *
 * Nhập DatabaseModule vì UploadService giờ tự kiểm membership (folder gắn tổ chức) trước khi
 * cấp presign — trước đây service này không chạm DB.
 */
@Module({
  imports: [DatabaseModule],
  providers: [UploadService],
  exports: [UploadService],
})
export class StorageModule {}
