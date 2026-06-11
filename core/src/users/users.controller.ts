import { Controller, Get, UseGuards } from '@nestjs/common';
import { SessionGuard } from '../common/guards/session.guard';

/**
 * [DEMO] Endpoint nghiệp vụ (non-/auth) để minh hoạ luồng 401 phía client bật popup hết phiên.
 */
@Controller('users')
export class UsersController {
  /**
   * Input: Cookie session_id + device_id hợp lệ (SessionGuard); thiếu/không hợp lệ → 401 (AUTH_001).
   * Output: Danh sách user stub. Dùng để FE gọi (không gửi cookie) nhằm demo popup hết phiên.
   */
  @Get()
  @UseGuards(SessionGuard)
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
