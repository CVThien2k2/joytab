import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UsersController } from './users.controller';

/**
 * [DEMO] Module cho route /v1/users — dùng GatewayUserGuard (tin header X-User-Id từ gateway).
 */
@Module({
  imports: [AuthModule],
  controllers: [UsersController],
})
export class UsersModule {}
