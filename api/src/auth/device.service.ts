import { Injectable } from '@nestjs/common';
import { isUuid, parseDeviceNameFromUserAgent, parsePlatformFromUserAgent } from './auth.utils';
import { PrismaTx } from './session.service';

@Injectable()
export class DeviceService {
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

}
