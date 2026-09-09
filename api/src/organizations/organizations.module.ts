import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { StorageModule } from '../upload/storage.module';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';

@Module({
  // AuthModule chỉ để lấy AuthJwtService cho JwtAuthGuard — module này không biết gì về
  // luồng đăng nhập. StorageModule để dọn ảnh QR trên S3 khi đổi/xoá tổ chức.
  imports: [AuthModule, DatabaseModule, StorageModule],
  controllers: [OrganizationsController],
  providers: [OrganizationsService],
})
export class OrganizationsModule {}
