import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BillingModule } from '../billing/billing.module';
import { DatabaseModule } from '../database/database.module';
import { EventGeneratorService } from './event-generator.service';
import { EventsController, OrganizationEventsController } from './events.controller';
import { EventsService } from './events.service';
import { TemplatesController } from './templates.controller';
import { TemplatesService } from './templates.service';

@Module({
  // BillingModule cho SettlementsService — ranh giới ghi duy nhất từ events sang billing.
  imports: [DatabaseModule, AuthModule, BillingModule],
  controllers: [TemplatesController, OrganizationEventsController, EventsController],
  providers: [TemplatesService, EventsService, EventGeneratorService],
})
export class EventsModule {}
