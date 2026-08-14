import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { InvitesController, OrganizationInvitesController } from './invites.controller';
import { InvitesService } from './invites.service';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';

@Module({
  // AuthModule để lấy AuthJwtService cho JwtAuthGuard.
  imports: [DatabaseModule, AuthModule],
  controllers: [OrganizationsController, OrganizationInvitesController, InvitesController],
  providers: [OrganizationsService, InvitesService],
})
export class OrganizationsModule {}
