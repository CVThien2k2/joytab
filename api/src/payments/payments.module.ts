import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BanksModule } from '../banks/banks.module';
import { DatabaseModule } from '../database/database.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  // BanksModule để tra tên ngân hàng hiện cạnh mã QR ở màn thanh toán.
  imports: [AuthModule, BanksModule, DatabaseModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}
