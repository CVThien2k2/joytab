import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { parseDeviceNameFromUserAgent, parsePlatformFromUserAgent } from './auth.utils';
import { PrismaTx } from './session.service';

@Injectable()
export class DeviceService {
  /**
   * Input: DatabaseService cho query đọc ngoài transaction.
   * Output: Service quản lý Device + DeviceUser.
   */
  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Input: fingerprint (bắt buộc), deviceName (tùy chọn), userAgent (tùy chọn) và transaction client.
   * Output: Upsert Device theo fingerprint; cập nhật platform/last_seen_at; trả device.
   */
  async upsertDevice(params: { fingerprint: string; deviceName?: string | null; userAgent?: string }, tx: PrismaTx) {
    const platform = parsePlatformFromUserAgent(params.userAgent);
    // Ưu tiên deviceName client gửi; nếu không có thì suy ra tên trình duyệt từ User-Agent.
    const deviceName = params.deviceName ?? parseDeviceNameFromUserAgent(params.userAgent);
    const now = new Date();
    return tx.device.upsert({
      where: { device_fingerprint: params.fingerprint },
      create: {
        device_fingerprint: params.fingerprint,
        device_name: deviceName,
        platform,
        last_seen_at: now,
      },
      update: {
        ...(deviceName ? { device_name: deviceName } : {}),
        ...(platform ? { platform } : {}),
        last_seen_at: now,
      },
    });
  }

  /**
   * Input: deviceId, userId và transaction client.
   * Output: Link account vào device (upsert), KHÔNG deactivate account khác — cho phép nhiều account song song.
   */
  async linkDeviceUser(params: { deviceId: string; userId: string }, tx: PrismaTx): Promise<void> {
    await tx.deviceUser.upsert({
      where: { device_id_user_id: { device_id: params.deviceId, user_id: params.userId } },
      create: { device_id: params.deviceId, user_id: params.userId, is_active: true },
      update: { is_active: true },
    });
  }

  /**
   * Input: deviceId.
   * Output: Danh sách account đã link với device (kèm user) để dựng UI account switcher.
   */
  async listAccountsByDevice(deviceId: string) {
    return this.databaseService.deviceUser.findMany({
      where: { device_id: deviceId },
      include: { user: true },
      orderBy: { linked_at: 'desc' },
    });
  }
}
