import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { MatchesController, OrganizationMatchesController } from './matches.controller';
import { MatchesService } from './matches.service';

@Module({
  // AuthModule chỉ để lấy AuthJwtService cho JwtAuthGuard.
  imports: [AuthModule, DatabaseModule],
  controllers: [OrganizationMatchesController, MatchesController],
  providers: [MatchesService],
})
export class MatchesModule {}
