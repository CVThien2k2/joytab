import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { isUuid, parseDeviceNameFromUserAgent, parsePlatformFromUserAgent } from './auth.utils';
import { PrismaTx } from './session.service';

@Injectable()
export class DeviceService {
  /**
   * Input: DatabaseService cho query đọc ngoài transaction.
   * Output: Service quản lý Device + DeviceUser.
   */
  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Input: deviceId từ cookie (có thể null/không hợp lệ), deviceName, userAgent, transaction client.
   * Output: Dùng lại Device nếu deviceId hợp lệ + tồn tại (cập nhật platform/name/last_seen);
   *         ngược lại tạo Device mới. Trả device để caller set lại cookie device_id.
   */
  async ensureDevice(
    params: { deviceId?: string | null; deviceName?: string | null; userAgent?: string },
    tx: PrismaTx,
  ) {
    const platform = parsePlatformFromUserAgent(params.userAgent);
    const deviceName = params.deviceName ?? parseDeviceNameFromUserAgent(params.userAgent);
    const now = new Date();
    if (isUuid(params.deviceId)) {
      const existing = await tx.device.findUnique({ where: { id: params.deviceId } });
      if (existing) {
        return tx.device.update({
          where: { id: existing.id },
          data: {
            ...(deviceName ? { device_name: deviceName } : {}),
            ...(platform ? { platform } : {}),
            last_seen_at: now,
          },
        });
      }
    }
    return tx.device.create({
      data: { device_name: deviceName, platform, last_seen_at: now },
    });
  }

  /**
   * Input: deviceId, userId, transaction client.
   * Output: Link account vào device (upsert), KHÔNG deactivate account khác — cho phép multi-account.
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
