import { Body, Controller, Delete, Get, Logger, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { CommonParseUuidPipe } from '../common/pipes/parse-uuid.pipe';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { ERROR_CODES } from '../common/constants/error-codes.constant';
import { AppException } from '../common/exceptions/app.exception';
import { GoogleAuthGuard } from '../common/guards/google-auth.guard';
import { isProductionEnvironment } from '../common/utils/functions';
import { AccessTokenGuard } from '../common/guards/access-token.guard';
import { AuthService } from './auth.service';
import { ExchangeGoogleCodeDto } from './dto/exchange-google-code.dto';
import { RefreshDto } from './dto/refresh.dto';
import { LogoutDto } from './dto/logout.dto';
import {
  buildGoogleLoginCallbackRedirectUrl,
  buildGoogleLoginFailedRedirectUrl,
  buildRefreshCookieName,
  GOOGLE_CALLBACK_EXCHANGE_TTL_MS,
  GOOGLE_CHANGE_TOKEN_COOKIE_NAME,
  readCookieValue,
  REFRESH_TOKEN_COOKIE_PATH,
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
   * Output: Trả access token + user và set refresh token vào cookie per-account nếu code còn hiệu lực.
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
      const result = await this.authService.exchangeGoogleLoginCode(body.code, changeToken, {
        deviceFingerprint: body.deviceFingerprint,
        deviceName: body.deviceName,
        userAgent: request.headers['user-agent'],
      });
      response.cookie(
        buildRefreshCookieName(result.userId),
        result.refreshToken,
        this.buildCookieOptions(REFRESH_TOKEN_COOKIE_PATH, REFRESH_TOKEN_TTL_MS),
      );
      return {
        userId: result.userId,
        accessToken: result.accessToken,
        accessTokenExpiresAt: result.accessTokenExpiresAt,
        user: result.user,
      };
    } finally {
      response.clearCookie(
        GOOGLE_CHANGE_TOKEN_COOKIE_NAME,
        this.buildCookieOptions('/auth/google/exchange', GOOGLE_CALLBACK_EXCHANGE_TTL_MS),
      );
    }
  }

  /**
   * Input: accountId (body) + cookie rt_<accountId>.
   * Output: Access token mới + rotate refresh cookie per-account.
   */
  @Post('refresh')
  async refresh(@Body() body: RefreshDto, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const rawToken = readCookieValue(request.headers.cookie, buildRefreshCookieName(body.accountId));
    if (!rawToken) throw new AppException(ERROR_CODES.AUTH_001);
    const result = await this.authService.refresh(body.accountId, rawToken);
    response.cookie(
      buildRefreshCookieName(result.userId),
      result.refreshToken,
      this.buildCookieOptions(REFRESH_TOKEN_COOKIE_PATH, REFRESH_TOKEN_TTL_MS),
    );
    return {
      userId: result.userId,
      accessToken: result.accessToken,
      accessTokenExpiresAt: result.accessTokenExpiresAt,
    };
  }

  /**
   * Input: accountId (body) + cookie rt_<accountId>.
   * Output: Revoke session + xóa cookie per-account.
   */
  @Post('logout')
  async logout(@Body() body: LogoutDto, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const cookieName = buildRefreshCookieName(body.accountId);
    const rawToken = readCookieValue(request.headers.cookie, cookieName);
    if (rawToken) await this.authService.logout(rawToken);
    response.clearCookie(cookieName, this.buildCookieOptions(REFRESH_TOKEN_COOKIE_PATH, REFRESH_TOKEN_TTL_MS));
    return { success: true };
  }

  /**
   * Input: accountId query param + cookie rt_<accountId>.
   * Output: Danh sách account đã link với device hiện tại.
   */
  @Get('accounts')
  async accounts(@Query('accountId', CommonParseUuidPipe) accountId: string, @Req() request: Request) {
    const rawToken = readCookieValue(request.headers.cookie, buildRefreshCookieName(accountId));
    if (!rawToken) throw new AppException(ERROR_CODES.AUTH_001);
    return this.authService.listAccounts(rawToken);
  }

  /**
   * Input: access token (Bearer).
   * Output: Thông tin user hiện tại theo account đang active trên FE.
   */
  @Get('me')
  @UseGuards(AccessTokenGuard)
  async me(@Req() request: Request & { userId: string }) {
    return this.authService.getMe(request.userId);
  }

  /**
   * Input: access token (Bearer).
   * Output: Danh sách thiết bị/phiên của user.
   */
  @Get('devices')
  @UseGuards(AccessTokenGuard)
  async devices(@Req() request: Request & { userId: string }) {
    return this.authService.listDevices(request.userId);
  }

  /**
   * Input: access token (Bearer) + sessionId.
   * Output: Revoke session từ xa nếu thuộc về user.
   */
  @Delete('sessions/:id')
  @UseGuards(AccessTokenGuard)
  async revokeSession(@Param('id') id: string, @Req() request: Request & { userId: string }) {
    await this.authService.revokeSession(id, request.userId);
    return { success: true };
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
