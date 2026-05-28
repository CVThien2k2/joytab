import { Body, Controller, Get, Logger, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { ERROR_CODES } from '../common/constants/error-codes.constant';
import { AppException } from '../common/exceptions/app.exception';
import { GoogleAuthGuard } from '../common/guards/google-auth.guard';
import { isProductionEnvironment } from '../common/utils/functions';
import { AuthService } from './auth.service';
import { ExchangeGoogleCodeDto } from './dto/exchange-google-code.dto';
import {
  buildGoogleLoginCallbackRedirectUrl,
  buildGoogleLoginFailedRedirectUrl,
  GOOGLE_CALLBACK_EXCHANGE_TTL_MS,
  GOOGLE_CHANGE_TOKEN_COOKIE_NAME,
  readCookieValue,
  REFRESH_TOKEN_COOKIE_NAME,
  REFRESH_TOKEN_TTL_MS,
} from './auth.utils';

@Throttle({ global: { ttl: 60000, limit: 10 } })
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

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
        this.logger.warn('Google callback received without user profile, redirecting to login');
        response.redirect(302, loginPageUrl);
        return;
      }

      this.logger.log(`Google callback received for user: email=${googleUser.email} provider=${googleUser.provider}`);
      const { code, changeToken } = await this.authService.loginWithGoogle(googleUser);
      response.cookie(
        GOOGLE_CHANGE_TOKEN_COOKIE_NAME,
        changeToken,
        this.buildCookieOptions('/auth/google/exchange', GOOGLE_CALLBACK_EXCHANGE_TTL_MS),
      );
      this.logger.log(`Login code issued for ${googleUser.email}, redirecting to FE callback`);
      response.redirect(302, buildGoogleLoginCallbackRedirectUrl(frontendOrigin, code));
    } catch (err) {
      this.logger.error(`Google callback failed: ${err instanceof Error ? err.message : String(err)}`);
      response.redirect(302, loginPageUrl);
    }
  }

  /**
   * Input: Mã code một lần được FE gửi sau redirect callback Google.
   * Output: Trả access token + user và set refresh token vào cookie nếu code còn hiệu lực.
   */
  @Post('google/exchange')
  async exchangeGoogleCode(
    @Body() body: ExchangeGoogleCodeDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const changeToken = readCookieValue(request.headers.cookie, GOOGLE_CHANGE_TOKEN_COOKIE_NAME);
    if (!changeToken) {
      throw new AppException(ERROR_CODES.AUTH_003);
    }

    try {
      const exchangeArtifacts = await this.authService.exchangeGoogleLoginCode(body.code, changeToken);
      response.cookie(
        REFRESH_TOKEN_COOKIE_NAME,
        exchangeArtifacts.refreshToken,
        this.buildCookieOptions('/', REFRESH_TOKEN_TTL_MS),
      );
      return {
        accessToken: exchangeArtifacts.accessToken,
        accessTokenExpiresAt: exchangeArtifacts.accessTokenExpiresAt,
        user: exchangeArtifacts.user,
      };
    } finally {
      response.clearCookie(
        GOOGLE_CHANGE_TOKEN_COOKIE_NAME,
        this.buildCookieOptions('/auth/google/exchange', GOOGLE_CALLBACK_EXCHANGE_TTL_MS),
      );
    }
  }

  /**
   * Input: Cookie refresh_token kèm request (nếu có); session FE muốn kết thúc.
   * Output: Xoá hash refresh trong Redis và clear cookie ở browser; trả 204 cho mọi trường hợp idempotent.
   */
  @Post('logout')
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response): Promise<void> {
    const rawRefreshToken = readCookieValue(request.headers.cookie, REFRESH_TOKEN_COOKIE_NAME);
    if (rawRefreshToken) {
      await this.authService.revokeRefreshToken(rawRefreshToken);
    }
    response.clearCookie(REFRESH_TOKEN_COOKIE_NAME, this.buildCookieOptions('/', REFRESH_TOKEN_TTL_MS));
    response.status(204);
  }

  private buildCookieOptions(path: string, maxAge: number) {
    return {
      httpOnly: true,
      secure: isProductionEnvironment(this.configService),
      sameSite: 'lax' as const,
      path,
      maxAge,
    };
  }
}
