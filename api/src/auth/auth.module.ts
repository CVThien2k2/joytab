import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { GoogleStrategy } from '../common/strategies/google.strategy';
import { DatabaseModule } from '../database/database.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthJwtService } from './jwt.service';
import { RefreshTokenService } from './refresh-token.service';

@Module({
  imports: [
    PassportModule.register({ session: false }),
    // register({}) không cấu hình gì: secret và expiresIn được truyền theo từng lần
    // sign/verify trong AuthJwtService vì AT và RT dùng hai secret khác nhau.
    JwtModule.register({}),
    DatabaseModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, GoogleStrategy, AuthJwtService, RefreshTokenService],
  // Export AuthJwtService cho JwtAuthGuard dùng ở các module nghiệp vụ khác.
  exports: [AuthJwtService],
})
export class AuthModule {}
