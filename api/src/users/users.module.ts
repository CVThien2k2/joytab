import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UsersController } from './users.controller';

/**
 * [DEMO] Module cho route /users — import AuthModule để SessionGuard dùng được SessionService.
 */
@Module({
  imports: [AuthModule],
  controllers: [UsersController],
})
export class UsersModule {}
