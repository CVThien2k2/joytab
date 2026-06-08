import { Injectable } from '@nestjs/common';
import { ERROR_CODES } from '../common/constants/error-codes.constant';
import { AppException } from '../common/exceptions/app.exception';
import { GoogleUser } from '../common/utils/types';
import { DatabaseService } from '../database/database.service';
import { DeviceService } from './device.service';
import { SessionService } from './session.service';

type LoginContext = { deviceId?: string | null; deviceName?: string; userAgent?: string };
type LoginResult = { userId: string; sessionTokenRaw: string; deviceId: string; user: GoogleUser };

@Injectable()
export class AuthService {
  /**
   * Input: DatabaseService, SessionService, DeviceService.
   * Output: Service orchestrate nghiệp vụ login/switch/logout/quản lý phiên.
   */
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly sessionService: SessionService,
    private readonly deviceService: DeviceService,
  ) {}

  /**
   * Input: Google profile đã validate + ngữ cảnh (deviceId cookie, userAgent).
   * Output: Upsert user, đảm bảo Device, link DeviceUser, tạo/refresh session. Trả raw token + deviceId để set cookie.
   */
  async loginWithGoogle(googleUser: GoogleUser, ctx: LoginContext): Promise<LoginResult> {
    const user = await this.upsertGoogleUser(googleUser);
    const result = await this.databaseService.$transaction(async (tx) => {
      const device = await this.deviceService.ensureDevice(
        { deviceId: ctx.deviceId, deviceName: ctx.deviceName, userAgent: ctx.userAgent },
        tx,
      );
      await this.deviceService.linkDeviceUser({ deviceId: device.id, userId: user.id }, tx);
      const sessionTokenRaw = await this.sessionService.createOrRefreshSession(
        { userId: user.id, deviceId: device.id },
        tx,
      );
      return { deviceId: device.id, sessionTokenRaw };
    });
    return {
      userId: user.id,
      sessionTokenRaw: result.sessionTokenRaw,
      deviceId: result.deviceId,
      user: this.toGoogleUser(user),
    };
  }

  /**
   * Input: deviceId (từ cookie) + userId đích.
   * Output: raw token mới cho account đích nếu còn phiên sống; AUTH_001 nếu cần login lại.
   */
  async switchAccount(deviceId: string, userId: string): Promise<{ userId: string; sessionTokenRaw: string }> {
    const sessionTokenRaw = await this.databaseService.$transaction((tx) =>
      this.sessionService.switchActiveSession({ deviceId, userId }, tx),
    );
    return { userId, sessionTokenRaw };
  }

  /**
   * Input: raw session token.
   * Output: Revoke session hiện tại (logout). Không ném lỗi nếu token đã không hợp lệ.
   */
  async logout(rawToken: string): Promise<void> {
    await this.databaseService.$transaction((tx) => this.sessionService.revokeByRawToken(rawToken, tx));
  }

  /**
   * Input: deviceId từ cookie.
   * Output: Danh sách account trên device + cờ needsRelogin (account hết phiên sống).
   */
  async listAccounts(deviceId: string) {
    const [links, liveUserIds] = await Promise.all([
      this.deviceService.listAccountsByDevice(deviceId),
      this.sessionService.listLiveUserIdsForDevice(deviceId),
    ]);
    const live = new Set(liveUserIds);
    return {
      accounts: links.map((l) => ({
        userId: l.user.id,
        email: l.user.email,
        fullName: l.user.full_name,
        avatarUrl: l.user.avatar_url,
        needsRelogin: !live.has(l.user.id),
      })),
    };
  }

  /**
   * Input: userId từ SessionGuard.
   * Output: Thông tin user hiện tại.
   */
  async getMe(userId: string) {
    const user = await this.databaseService.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppException(ERROR_CODES.AUTH_001);
    return { userId: user.id, user: this.toGoogleUser(user) };
  }

  /**
   * Input: userId từ SessionGuard.
   * Output: Danh sách thiết bị/phiên của user.
   */
  async listDevices(userId: string) {
    const sessions = await this.sessionService.listByUser(userId);
    return {
      devices: sessions.map((s) => ({
        sessionId: s.id,
        deviceId: s.device_id,
        deviceName: s.device.device_name,
        platform: s.device.platform,
        lastSeenAt: s.device.last_seen_at,
        createdAt: s.created_at,
      })),
    };
  }

  /**
   * Input: sessionId cần revoke + userId chủ sở hữu.
   * Output: Revoke session từ xa nếu thuộc về user.
   */
  async revokeSession(sessionId: string, userId: string): Promise<void> {
    await this.databaseService.$transaction((tx) =>
      this.sessionService.revokeSessionOwnedByUser(sessionId, userId, tx),
    );
  }

  private toGoogleUser(user: {
    provider_user_id: string;
    email: string;
    email_verified: boolean;
    full_name: string | null;
    avatar_url: string | null;
  }): GoogleUser {
    return {
      provider: 'google',
      providerUserId: user.provider_user_id,
      email: user.email,
      emailVerified: user.email_verified,
      fullName: user.full_name,
      avatarUrl: user.avatar_url,
    };
  }

  /**
   * Input: Google user đã validate.
   * Output: Upsert bản ghi users theo provider_user_id; trả user mới nhất.
   */
  private async upsertGoogleUser(googleUser: GoogleUser) {
    const now = new Date();
    return this.databaseService.user.upsert({
      where: { provider_user_id: googleUser.providerUserId },
      update: {
        provider: googleUser.provider,
        email: googleUser.email,
        email_verified: googleUser.emailVerified,
        full_name: googleUser.fullName,
        avatar_url: googleUser.avatarUrl,
        status: 'active',
        last_login_at: now,
        is_deleted: false,
        deleted_by: null,
        deleted_at: null,
      },
      create: {
        provider: googleUser.provider,
        provider_user_id: googleUser.providerUserId,
        email: googleUser.email,
        email_verified: googleUser.emailVerified,
        full_name: googleUser.fullName,
        avatar_url: googleUser.avatarUrl,
        status: 'active',
        last_login_at: now,
      },
    });
  }
}
