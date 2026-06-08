import { Body, Controller, Delete, Get, Logger, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { ERROR_CODES } from '../common/constants/error-codes.constant';
import { AppException } from '../common/exceptions/app.exception';
import { GoogleAuthGuard } from '../common/guards/google-auth.guard';
import { SessionGuard } from '../common/guards/session.guard';
import { isProductionEnvironment } from '../common/utils/functions';
import { AuthService } from './auth.service';
import { SwitchAccountDto } from './dto/switch-account.dto';
import { buildGoogleLoginCallbackRedirectUrl, buildGoogleLoginFailedRedirectUrl, readCookieValue } from './auth.utils';
import {
  AUTH_THROTTLE_LIMIT,
  AUTH_THROTTLE_TTL_MS,
  COOKIE_PATH,
  DEVICE_COOKIE_MAX_AGE_MS,
  DEVICE_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  SESSION_TTL_MS,
} from './auth.constants';

@Throttle({ global: { ttl: AUTH_THROTTLE_TTL_MS, limit: AUTH_THROTTLE_LIMIT } })
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  /**
   * Input: AuthService (nghiệp vụ) + ConfigService (FRONTEND_ORIGIN, môi trường).
   * Output: Controller cho các route xác thực.
   */
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Input: Request khởi tạo OAuth.
   * Output: Chuyển hướng sang trang đăng nhập Google.
   */
  @Get('google')
  @UseGuards(GoogleAuthGuard)
  loginWithGoogle(): void {}

  /**
   * Input: Callback Google (profile đã validate) + cookie device_id (nếu có).
   * Output: Tạo session, set cookie session_id + device_id, redirect thẳng về FE `/login/callback`.
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
      const deviceId = readCookieValue(request.headers.cookie, DEVICE_COOKIE_NAME);
      const result = await this.authService.loginWithGoogle(googleUser, {
        deviceId,
        userAgent: request.headers['user-agent'],
      });
      response.cookie(SESSION_COOKIE_NAME, result.sessionTokenRaw, this.buildCookieOptions(SESSION_TTL_MS));
      response.cookie(DEVICE_COOKIE_NAME, result.deviceId, this.buildCookieOptions(DEVICE_COOKIE_MAX_AGE_MS));
      this.logger.log(`Session issued for ${googleUser.email}, redirecting to FE callback`);
      response.redirect(302, buildGoogleLoginCallbackRedirectUrl(frontendOrigin));
    } catch (err) {
      this.logger.error(`Google callback failed: ${err instanceof Error ? err.message : String(err)}`);
      response.redirect(302, loginPageUrl);
    }
  }

  /**
   * Input: body.userId + cookie device_id.
   * Output: Đổi account active — set lại cookie session_id. AUTH_001 nếu account cần login lại.
   */
  @Post('switch')
  async switchAccount(
    @Body() body: SwitchAccountDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const deviceId = readCookieValue(request.headers.cookie, DEVICE_COOKIE_NAME);
    if (!deviceId) throw new AppException(ERROR_CODES.AUTH_001);
    const result = await this.authService.switchAccount(deviceId, body.userId);
    response.cookie(SESSION_COOKIE_NAME, result.sessionTokenRaw, this.buildCookieOptions(SESSION_TTL_MS));
    return { success: true, userId: result.userId };
  }

  /**
   * Input: cookie session_id.
   * Output: Revoke session hiện tại + xoá cookie session_id (giữ device_id).
   */
  @Post('logout')
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const rawToken = readCookieValue(request.headers.cookie, SESSION_COOKIE_NAME);
    if (rawToken) await this.authService.logout(rawToken);
    response.clearCookie(SESSION_COOKIE_NAME, this.buildCookieOptions(SESSION_TTL_MS));
    return { success: true };
  }

  /**
   * Input: cookie device_id.
   * Output: Danh sách account trên device + cờ needsRelogin (rỗng nếu chưa có device_id).
   */
  @Get('accounts')
  async accounts(@Req() request: Request) {
    const deviceId = readCookieValue(request.headers.cookie, DEVICE_COOKIE_NAME);
    if (!deviceId) return { accounts: [] };
    return this.authService.listAccounts(deviceId);
  }

  /**
   * Input: session cookie (qua SessionGuard).
   * Output: Thông tin user hiện tại.
   */
  @Get('me')
  @UseGuards(SessionGuard)
  async me(@Req() request: Request & { userId: string }) {
    return this.authService.getMe(request.userId);
  }

  /**
   * Input: session cookie (qua SessionGuard).
   * Output: Danh sách thiết bị/phiên của user.
   */
  @Get('devices')
  @UseGuards(SessionGuard)
  async devices(@Req() request: Request & { userId: string }) {
    return this.authService.listDevices(request.userId);
  }

  /**
   * Input: session cookie (qua SessionGuard) + sessionId.
   * Output: Revoke session từ xa nếu thuộc về user.
   */
  @Delete('sessions/:id')
  @UseGuards(SessionGuard)
  async revokeSession(@Param('id') id: string, @Req() request: Request & { userId: string }) {
    await this.authService.revokeSession(id, request.userId);
    return { success: true };
  }

  private buildCookieOptions(maxAge: number) {
    return {
      httpOnly: true,
      secure: isProductionEnvironment(this.configService),
      sameSite: 'lax' as const,
      path: COOKIE_PATH,
      maxAge,
    };
  }
}
