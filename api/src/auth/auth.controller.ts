import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { ERROR_CODES } from '../common/constants/error-codes.constant';
import { AppException } from '../common/exceptions/app.exception';
import { GoogleAuthGuard } from '../common/guards/google-auth.guard';
import { AuthService } from './auth.service';
import {
  buildGoogleLoginSuccessRedirectUrl,
  resolveGoogleLoginRedirectTarget,
} from './auth.utils';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  /**
   * Input: AuthService xử lý đăng nhập Google và ConfigService đọc FRONTEND_ORIGIN từ env.
   * Output: Khởi tạo controller cho các route xác thực và điều hướng callback về FE.
   */
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Input: Request gọi từ UI vào endpoint khởi tạo OAuth.
   * Output: Chuyển hướng người dùng sang trang đăng nhập Google.
   */
  @ApiOperation({
    summary: 'Khởi tạo đăng nhập Google OAuth',
  })
  @Get('google')
  @UseGuards(GoogleAuthGuard)
  loginWithGoogle(): void {}

  /**
   * Input: Request callback từ Google chứa user profile đã được strategy validate.
   * Output: Đồng bộ user rồi redirect về FE theo state của OAuth callback.
   */
  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleCallback(@Req() request: Request, @Res() response: Response) {
    if (!request.user) throw new AppException(ERROR_CODES.AUTH_002);

    await this.authService.loginWithGoogle(request.user);
    const stateRedirectTo = request.query.state as string;

    const redirectTarget = resolveGoogleLoginRedirectTarget({
      redirectTo: stateRedirectTo,
      frontendOrigin: this.configService.get<string>('FRONTEND_ORIGIN'),
    });

    response.redirect(302, buildGoogleLoginSuccessRedirectUrl(redirectTarget));
  }
}
