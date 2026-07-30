import { Controller, Get, Logger, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { ERROR_CODES } from '../common/constants/error-codes.constant';
import { AppException } from '../common/exceptions/app.exception';
import { GoogleAuthGuard } from '../common/guards/google-auth.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthService } from './auth.service';
import {
  ACCESS_COOKIE_NAME,
  ACCESS_TOKEN_TTL_MS,
  AUTH_THROTTLE_LIMIT,
  AUTH_THROTTLE_TTL_MS,
  REFRESH_COOKIE_NAME,
  REFRESH_TOKEN_TTL_MS,
} from './auth.constants';
import {
  buildAuthCookieOptions,
  buildGoogleLoginFailedRedirectUrl,
  buildPostLoginRedirectUrl,
  readCookieValue,
} from './auth.utils';
import { AuthJwtService } from './jwt.service';
import { RefreshTokenService } from './refresh-token.service';

@Throttle({ global: { ttl: AUTH_THROTTLE_TTL_MS, limit: AUTH_THROTTLE_LIMIT } })
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly authJwtService: AuthJwtService,
    private readonly refreshTokenService: RefreshTokenService,
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
   * Input: Callback Google (profile đã validate).
   * Output: Upsert user, cấp AT + RT, set 2 cookie, redirect về FE `/login/callback` —
   *         trang đó gọi /auth/me một lần để bơm user vào store rồi về `/`.
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
      const { userId, user } = await this.authService.loginWithGoogle(googleUser);
      await this.issueTokenCookies(response, { userId, email: user.email });
      this.logger.log(`Tokens issued for ${user.email}, redirecting to FE callback`);
      response.redirect(302, buildPostLoginRedirectUrl(frontendOrigin));
    } catch (err) {
      this.logger.error(`Google callback failed: ${err instanceof Error ? err.message : String(err)}`);
      response.redirect(302, loginPageUrl);
    }
  }

  /**
   * Input: cookie `rt`.
   * Output: Xoay vòng refresh token, cấp AT + RT mới, set lại 2 cookie, trả { userId, user }
   *         (cùng shape với /auth/me để FE cập nhật store luôn nếu cần).
   *
   *         Mọi lý do từ chối đều trả AUTH_006 — không tiết lộ cho client rằng đã phát hiện
   *         token bị dùng lại.
   */
  @Post('refresh')
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const rawToken = readCookieValue(request.headers.cookie, REFRESH_COOKIE_NAME);
    if (!rawToken) throw new AppException(ERROR_CODES.AUTH_006);

    const stored = await this.refreshTokenService.findByRawToken(rawToken);
    if (!stored) throw new AppException(ERROR_CODES.AUTH_006);
    // Check revoke ĐỨNG TRƯỚC check hết hạn có chủ ý: một RT đã bị revoke mà vẫn được đem
    // đi refresh luôn là dấu hiệu token bị copy, kể cả khi nó cũng đã hết hạn.
    if (stored.revoked_at) {
      this.logger.warn(`Refresh token reuse detected for user ${stored.user_id}, revoking all tokens`);
      await this.refreshTokenService.revokeAllForUser(stored.user_id);
      throw new AppException(ERROR_CODES.AUTH_006);
    }
    if (stored.expires_at.getTime() <= Date.now()) {
      throw new AppException(ERROR_CODES.AUTH_006);
    }

    const { userId, user } = await this.authService.getMe(stored.user_id);
    const rotated = await this.refreshTokenService.rotate(stored.id, userId);
    await this.setTokenCookies(response, { userId, email: user.email, refreshTokenRaw: rotated.raw });
    return { userId, user };
  }

  /**
   * Input: cookie `rt` (không bắt buộc).
   * Output: Revoke refresh token hiện tại + xoá cả 2 cookie. Luôn thành công, kể cả khi
   *         token đã hết hạn hoặc không còn hợp lệ — logout không được phép thất bại.
   */
  @Post('logout')
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const rawToken = readCookieValue(request.headers.cookie, REFRESH_COOKIE_NAME);
    if (rawToken) await this.refreshTokenService.revokeByRawToken(rawToken);
    this.clearTokenCookies(response);
    return { success: true };
  }

  /**
   * Input: cookie `at` (qua JwtAuthGuard).
   * Output: Thông tin user hiện tại.
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Req() request: Request & { userId: string }) {
    return this.authService.getMe(request.userId);
  }

  /**
   * Input: Response + userId/email.
   * Output: Tạo row refresh token mới rồi set cả 2 cookie. Dùng cho luồng login.
   */
  private async issueTokenCookies(response: Response, params: { userId: string; email: string }): Promise<void> {
    const issued = await this.refreshTokenService.issue(params.userId);
    await this.setTokenCookies(response, { ...params, refreshTokenRaw: issued.raw });
  }

  /**
   * Input: Response + userId/email + chuỗi RT thô đã có row tương ứng trong DB.
   * Output: Sign AT rồi set cookie `at` và `rt`.
   */
  private async setTokenCookies(
    response: Response,
    params: { userId: string; email: string; refreshTokenRaw: string },
  ): Promise<void> {
    const accessToken = await this.authJwtService.signAccessToken({
      userId: params.userId,
      email: params.email,
    });
    response.cookie(ACCESS_COOKIE_NAME, accessToken, buildAuthCookieOptions(this.configService, ACCESS_TOKEN_TTL_MS));
    response.cookie(
      REFRESH_COOKIE_NAME,
      params.refreshTokenRaw,
      buildAuthCookieOptions(this.configService, REFRESH_TOKEN_TTL_MS),
    );
  }

  private clearTokenCookies(response: Response): void {
    response.clearCookie(ACCESS_COOKIE_NAME, buildAuthCookieOptions(this.configService, ACCESS_TOKEN_TTL_MS));
    response.clearCookie(REFRESH_COOKIE_NAME, buildAuthCookieOptions(this.configService, REFRESH_TOKEN_TTL_MS));
  }
}
