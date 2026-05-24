import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  /**
   * Input: Không có tham số.
   * Output: Khởi tạo guard OAuth Google mặc định của Passport.
   */
  constructor() {
    super();
  }
}
