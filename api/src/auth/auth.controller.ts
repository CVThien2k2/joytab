import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ERROR_CODES } from '../common/constants/error-codes.constant';
import { AppException } from '../common/exceptions/app.exception';
import { GoogleAuthGuard } from '../common/guards/google-auth.guard';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  /**
   * Input: AuthService để xử lý nghiệp vụ đăng nhập Google.
   * Output: Khởi tạo controller cho các route xác thực.
   */
  constructor(private readonly authService: AuthService) {}

  /**
   * Input: Request gọi từ UI vào endpoint khởi tạo OAuth.
   * Output: Chuyển hướng người dùng sang trang đăng nhập Google.
   */
  @Get('google')
  @UseGuards(GoogleAuthGuard)
  loginWithGoogle(): void {}

  /**
   * Input: Request callback từ Google chứa user profile đã được strategy validate.
   * Output: Trả response đăng nhập thành công và dữ liệu user đã đồng bộ vào DB.
   */
  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleCallback(@Req() request: Request) {
    if (!request.user) throw new AppException(ERROR_CODES.AUTH_002);

    return this.authService.loginWithGoogle(request.user);
  }
}
