import { Controller, Get, UseGuards } from '@nestjs/common';
import { GatewayUserGuard } from '../common/guards/gateway-user.guard';

/**
 * [DEMO] Endpoint nghiệp vụ (non-/auth) để minh hoạ luồng 401 phía client bật popup hết phiên.
 */
@Controller('v1/users')
export class UsersController {
  /**
   * Input: header X-User-Id (qua GatewayUserGuard); thiếu → 401 (AUTH_001).
   * Output: Danh sách user stub. Dùng để FE gọi (không gửi cookie) nhằm demo popup hết phiên.
   */
  @Get()
  @UseGuards(GatewayUserGuard)
  findAll(): { data: { users: Array<{ id: string; email: string; fullName: string }> } } {
    return {
      data: {
        users: [
          { id: '1', email: 'alice@example.com', fullName: 'Alice Nguyen' },
          { id: '2', email: 'bob@example.com', fullName: 'Bob Tran' },
          { id: '3', email: 'charlie@example.com', fullName: 'Charlie Le' },
        ],
      },
    };
  }
}
