import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { OrganizationBillingController, PaymentsController } from './billing.controller';
import { PaymentsService } from './payments.service';
import { SettlementsService } from './settlements.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [OrganizationBillingController, PaymentsController],
  providers: [SettlementsService, PaymentsService],
  // Chỉ SettlementsService lộ ra ngoài — module `events` gọi nó lúc finalize/reopen.
  // Chiều ngược lại không tồn tại: billing không bao giờ import EventsModule.
  exports: [SettlementsService],
})
export class BillingModule {}
