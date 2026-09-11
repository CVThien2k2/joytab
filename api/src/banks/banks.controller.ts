import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { BanksService } from './banks.service';

/**
 * Danh sách ngân hàng để dựng ô "chọn ngân hàng" ở màn tạo/sửa tổ chức.
 *
 * Có JwtAuthGuard dù đây là dữ liệu công khai: route này đứng trước một lượt gọi ra ngoài
 * internet, mở toang là biến API của mình thành proxy miễn phí tới VietQR cho bất kỳ ai. Người
 * cần nó thì đằng nào cũng đã đăng nhập — họ đang tạo tổ chức.
 */
@Controller('banks')
@UseGuards(JwtAuthGuard)
export class BanksController {
  constructor(private readonly banksService: BanksService) {}

  /**
   * Input: cookie `at`.
   * Output: { banks } — các ngân hàng nhận được chuyển khoản, đã sắp theo tên ngắn.
   */
  @Get()
  async list() {
    return { banks: await this.banksService.list() };
  }
}
