import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BanksModule } from '../banks/banks.module';
import { DatabaseModule } from '../database/database.module';
import { StorageModule } from '../upload/storage.module';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';

@Module({
  // AuthModule chỉ để lấy AuthJwtService cho JwtAuthGuard — module này không biết gì về
  // luồng đăng nhập. StorageModule để dọn ảnh của tổ chức trên S3 khi xoá tổ chức.
  // BanksModule để validate BIN owner chọn và tra tên ngân hàng trả về cho FE.
  imports: [AuthModule, BanksModule, DatabaseModule, StorageModule],
  controllers: [OrganizationsController],
  providers: [OrganizationsService],
})
export class OrganizationsModule {}
