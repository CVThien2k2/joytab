import { Body, Controller, Get, Logger, Patch, Post, Req, Res, UseGuards } from '@nestjs/common';
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
  ONBOARDING_COOKIE_NAME,
  ONBOARDING_PENDING_VALUE,
  PROFILE_UPDATE_THROTTLE_LIMIT,
  PROFILE_UPDATE_THROTTLE_TTL_MS,
  SESSION_READ_THROTTLE_LIMIT,
  SESSION_READ_THROTTLE_TTL_MS,
  REFRESH_COOKIE_NAME,
  REFRESH_TOKEN_TTL_MS,
} from './auth.constants';
import {
  buildAuthCookieOptions,
  buildGoogleLoginFailedRedirectUrl,
  buildFrontendUrl,
  buildOnboardingRedirectUrl,
  buildPostLoginRedirectUrl,
  sanitizeReturnToPath,
  readCookieValue,
} from './auth.utils';
import { AuthJwtService } from './jwt.service';
import { CompleteOnboardingDto, UpdateProfileDto } from './onboarding.dto';
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
   * Output: Upsert user, cấp AT + RT, set cookie rồi redirect về FE.
   *
   *         Đây là chỗ BE kiểm tra user đã onboarding chưa: chưa xong thì kèm cookie `onb`
   *         và đẩy thẳng về /onboarding; xong rồi thì xoá cookie đó và về `/`.
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
      await this.issueTokenCookies(response, { userId, email: user.email, onboarded: user.onboarded });
      // `state` là đích FE muốn quay lại (vd /join/ABCD1234) — Google trả nguyên xi giá trị
      // ta gửi đi, nhưng vẫn lọc lại: cái quay về không nhất thiết là cái đã gửi.
      const returnTo = sanitizeReturnToPath(request.query?.state);
      const redirectUrl = user.onboarded
        ? returnTo
          ? buildFrontendUrl(frontendOrigin, returnTo)
          : buildPostLoginRedirectUrl(frontendOrigin)
        : buildOnboardingRedirectUrl(frontendOrigin, returnTo);
      this.logger.log(`Tokens issued for ${user.email} (onboarded=${user.onboarded}), redirecting to ${redirectUrl}`);
      response.redirect(302, redirectUrl);
    } catch (err) {
      this.logger.error(`Google callback failed: ${err instanceof Error ? err.message : String(err)}`);
      response.redirect(302, loginPageUrl);
    }
  }

  /**
   * Input: cookie `rt`.
   * Output: Xoay vòng refresh token, cấp AT + RT mới, set lại cookie, trả { userId, user }
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
    await this.setTokenCookies(response, {
      userId,
      email: user.email,
      onboarded: user.onboarded,
      refreshTokenRaw: rotated.raw,
    });
    return { userId, user };
  }

  /**
   * Input: cookie `at` (qua JwtAuthGuard) + body 4 field bắt buộc.
   * Output: Lưu tên/tuổi/giới tính/SĐT, bật cờ onboarded, XOÁ cookie `onb` rồi trả user mới
   *         (cùng shape /auth/me) để FE cập nhật store mà không cần gọi lại /auth/me.
   *
   *         Chỉ user đã đăng nhập vào được: userId lấy từ access token chứ không nhận từ
   *         body, nên không ai onboarding hộ người khác.
   */
  @Post('onboarding')
  @UseGuards(JwtAuthGuard)
  async completeOnboarding(
    @Req() request: Request & { userId: string },
    @Res({ passthrough: true }) response: Response,
    @Body() dto: CompleteOnboardingDto,
  ) {
    const { userId, user } = await this.authService.completeOnboarding(request.userId, dto);
    this.syncOnboardingCookie(response, user.onboarded);
    this.logger.log(`Onboarding completed for ${user.email}`);
    return { userId, user };
  }

  /**
   * Input: cookie `at` (qua JwtAuthGuard).
   * Output: Thông tin user hiện tại.
   *
   *         Ngưỡng riêng, rộng hơn hẳn ngưỡng chung của controller: đây không phải thao tác
   *         người dùng mà là thứ Next server gọi ở mỗi lần render trang — xem chú thích ở
   *         SESSION_READ_THROTTLE_LIMIT.
   */
  @Throttle({
    global: { ttl: SESSION_READ_THROTTLE_TTL_MS, limit: SESSION_READ_THROTTLE_LIMIT },
  })
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Req() request: Request & { userId: string }) {
    return this.authService.getMe(request.userId);
  }

  /**
   * Input: cookie `at` + các field cần đổi (đều tuỳ chọn).
   * Output: User sau khi cập nhật, cùng shape /auth/me để FE thay thẳng vào store.
   *
   *         `avatarUrl` là URL S3 trả về sau khi client upload xong, hoặc `null` để xoá ảnh.
   *         Không nhận file ở đây: file đi trực tiếp lên S3 bằng presigned POST (xem
   *         upload.controller.ts), API chỉ lưu địa chỉ.
   */
  @Throttle({
    global: { ttl: PROFILE_UPDATE_THROTTLE_TTL_MS, limit: PROFILE_UPDATE_THROTTLE_LIMIT },
  })
  @Patch('me')
  @UseGuards(JwtAuthGuard)
  async updateProfile(@Req() request: Request & { userId: string }, @Body() dto: UpdateProfileDto) {
    const result = await this.authService.updateProfile(request.userId, dto);
    this.logger.log(`Profile updated for ${result.user.email}`);
    return result;
  }

  /**
   * Input: cookie `rt` (không bắt buộc).
   * Output: Revoke refresh token hiện tại + xoá cookie. Luôn thành công, kể cả khi
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
   * Input: Response + userId/email/onboarded.
   * Output: Tạo row refresh token mới rồi set cookie. Dùng cho luồng login.
   */
  private async issueTokenCookies(
    response: Response,
    params: { userId: string; email: string; onboarded: boolean },
  ): Promise<void> {
    const issued = await this.refreshTokenService.issue(params.userId);
    await this.setTokenCookies(response, { ...params, refreshTokenRaw: issued.raw });
  }

  /**
   * Input: Response + userId/email/onboarded + chuỗi RT thô đã có row tương ứng trong DB.
   * Output: Sign AT rồi set cookie `at`, `rt` và đồng bộ cookie `onb`.
   */
  private async setTokenCookies(
    response: Response,
    params: { userId: string; email: string; onboarded: boolean; refreshTokenRaw: string },
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
    this.syncOnboardingCookie(response, params.onboarded);
  }

  /**
   * Input: Response + cờ onboarded hiện tại của user.
   * Output: Set cookie `onb` khi còn thiếu thông tin, xoá khi đã xong.
   *
   *         Luôn ghi rõ một trong hai chiều (không "để nguyên nếu đã xong") để cookie cũ còn
   *         sót từ phiên trước không giam user ở /onboarding mãi.
   *         Tuổi cookie bằng RT: hết phiên là hết ý nghĩa.
   */
  private syncOnboardingCookie(response: Response, onboarded: boolean): void {
    const options = buildAuthCookieOptions(this.configService, REFRESH_TOKEN_TTL_MS);
    if (onboarded) {
      response.clearCookie(ONBOARDING_COOKIE_NAME, options);
      return;
    }
    response.cookie(ONBOARDING_COOKIE_NAME, ONBOARDING_PENDING_VALUE, options);
  }

  private clearTokenCookies(response: Response): void {
    response.clearCookie(ACCESS_COOKIE_NAME, buildAuthCookieOptions(this.configService, ACCESS_TOKEN_TTL_MS));
    response.clearCookie(REFRESH_COOKIE_NAME, buildAuthCookieOptions(this.configService, REFRESH_TOKEN_TTL_MS));
    response.clearCookie(ONBOARDING_COOKIE_NAME, buildAuthCookieOptions(this.configService, REFRESH_TOKEN_TTL_MS));
  }
}
