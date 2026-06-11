import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload, RpcException } from '@nestjs/microservices';
import { ERROR_CODES } from '../common/constants/error-codes.constant';
import { AppException } from '../common/exceptions/app.exception';
import { AuthService } from './auth.service';
import { AUTH_INTROSPECT_PATTERN } from './auth.constants';
import { isUuid } from './auth.utils';

/** Payload introspect gateway gửi qua TCP (đã parse từ cookie, không gửi cookie thô). */
export type IntrospectMessage = { sessionToken?: string; deviceId?: string };

@Controller()
export class AuthRpcController {
  private readonly logger = new Logger(AuthRpcController.name);

  /**
   * Input: AuthService (nghiệp vụ introspect dùng chung với HTTP cũ).
   * Output: Controller microservice cho gateway gọi khi Redis miss.
   */
  constructor(private readonly authService: AuthService) {}

  /**
   * Input: { sessionToken, deviceId } gateway parse từ cookie và gửi qua TCP.
   * Output: SessionPayload nếu hợp lệ (đã rehydrate Redis); ném RpcException kèm code thật
   *         (AUTH_001/004/005) khi từ chối — gateway đọc code để map status. Lỗi lạ → RpcException
   *         chung (không có code AUTH_*) → gateway coi như unreachable (SYS_502).
   */
  @MessagePattern(AUTH_INTROSPECT_PATTERN)
  async introspect(@Payload() payload: IntrospectMessage) {
    const sessionToken = payload?.sessionToken;
    const deviceId = payload?.deviceId;
    if (!sessionToken || !isUuid(deviceId)) {
      throw new RpcException({ code: ERROR_CODES.AUTH_001.code });
    }
    try {
      return await this.authService.introspect(sessionToken, deviceId);
    } catch (err) {
      if (err instanceof AppException) {
        // propagate code nghiệp vụ thật để gateway map status (AUTH_001/004/005)
        throw new RpcException({ code: err.code });
      }
      // lỗi không lường trước (DB/Redis...) — không lộ code AUTH_*, gateway sẽ coi là unreachable
      this.logger.error(`Introspect RPC lỗi không xác định: ${err instanceof Error ? err.message : String(err)}`);
      throw new RpcException({ code: ERROR_CODES.SYS_001.code });
    }
  }
}
