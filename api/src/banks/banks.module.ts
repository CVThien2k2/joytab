import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BanksController } from './banks.controller';
import { BanksService } from './banks.service';

/**
 * Xuất `BanksService` ra ngoài: module tổ chức cần nó để VALIDATE bin owner gửi lên, và module
 * thanh toán cần tên ngân hàng để hiện cạnh mã QR.
 */
@Module({
  // AuthModule chỉ để JwtAuthGuard lấy được AuthJwtService.
  imports: [AuthModule],
  controllers: [BanksController],
  providers: [BanksService],
  exports: [BanksService],
})
export class BanksModule {}
