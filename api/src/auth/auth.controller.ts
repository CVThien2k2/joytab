import { Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { GoogleAuthGuard } from '../common/guards/google-auth.guard';
import { isProductionEnvironment } from '../common/utils/functions';
import { AuthService } from './auth.service';
import {
  buildGoogleLoginCallbackRedirectUrl,
  buildGoogleLoginFailedRedirectUrl,
  GOOGLE_CALLBACK_EXCHANGE_TTL_MS,
  GOOGLE_CHANGE_TOKEN_COOKIE_NAME,
} from './auth.utils';

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
  @Get('google')
  @UseGuards(GoogleAuthGuard)
  loginWithGoogle(): void {}

  /**
   * Input: Request callback từ Google chứa user profile đã được strategy validate.
   * Output: Đồng bộ user rồi redirect cố định về FE `/login/callback?code=...`.
   */
  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleCallback(@Req() request: Request, @Res() response: Response): Promise<void> {
    const frontendOrigin = this.configService.get<string>('FRONTEND_ORIGIN');
    const loginPageUrl = buildGoogleLoginFailedRedirectUrl(frontendOrigin);
    try {
      const googleUser = request.user;
      if (!googleUser) {
        response.redirect(302, loginPageUrl);
        return;
      }

      const { code, changeToken } = await this.authService.loginWithGoogle(googleUser);
      response.cookie(GOOGLE_CHANGE_TOKEN_COOKIE_NAME, changeToken, this.buildGoogleChangeTokenCookieOptions());
      response.redirect(302, buildGoogleLoginCallbackRedirectUrl(frontendOrigin, code));
    } catch {
      response.redirect(302, loginPageUrl);
    }
  }

  /**
   * Input: Mã code một lần được FE gửi sau redirect callback Google.
   * Output: Trả cặp token + user nếu code còn hiệu lực.
   */
  @Post('google/exchange')
  exchangeGoogleCode() {
    // try {
    //   return await this.authService.exchangeGoogleLoginCode(body.code, changeToken);
    // } finally {
    //   response.clearCookie(GOOGLE_CHANGE_TOKEN_COOKIE_NAME, cookieOptions);
    // }
  }

  /**
   * Input: NODE_ENV từ env để xác định chính sách secure/sameSite cho cookie tạm.
   * Output: Trả cookie options dùng chung cho set/clear change token ở luồng Google callback.
   */
  private buildGoogleChangeTokenCookieOptions() {
    const isProduction = isProductionEnvironment(this.configService);
    return {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? ('none' as const) : ('lax' as const),
      path: '/auth/google/exchange',
      maxAge: GOOGLE_CALLBACK_EXCHANGE_TTL_MS,
    };
  }
}
