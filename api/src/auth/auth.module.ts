import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { GoogleStrategy } from '../common/strategies/google.strategy';
import { DatabaseModule } from '../database/database.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { DeviceService } from './device.service';
import { SessionService } from './session.service';
import { TokenService } from './token.service';

@Module({
  imports: [PassportModule.register({ session: false }), DatabaseModule],
  controllers: [AuthController],
  providers: [AuthService, GoogleStrategy, TokenService, SessionService, DeviceService],
  exports: [SessionService],
})
export class AuthModule {}
