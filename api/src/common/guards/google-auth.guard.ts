import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard, IAuthModuleOptions } from '@nestjs/passport';
import { Request } from 'express';
import { sanitizeReturnToPath } from '../../auth/auth.utils';

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  /**
   * Input: Không có tham số.
   * Output: Khởi tạo guard OAuth Google mặc định của Passport.
   */
  constructor() {
    super();
  }

  /**
   * Input: ExecutionContext của request khởi tạo OAuth.
   * Output: Options cho Passport:
   *  - prompt=select_account khi query yêu cầu (luồng thêm tài khoản).
   *  - state = đích cần quay lại sau khi đăng nhập (vd /join/ABCD1234).
   *
   *         Đi bằng `state` chứ không phải cookie: Google trả lại đúng giá trị này ở callback,
   *         nên không phụ thuộc vào việc browser có gửi kèm cookie trong luồng cross-site hay
   *         không. Lọc ngay tại đây để giá trị rác không bao giờ rời khỏi hệ thống.
   */
  getAuthenticateOptions(context: ExecutionContext): IAuthModuleOptions {
    const request = context.switchToHttp().getRequest<Request>();
    const options: IAuthModuleOptions = {};
    if (request.query?.prompt === 'select_account') {
      options.prompt = 'select_account';
    }
    const returnTo = sanitizeReturnToPath(request.query?.returnTo);
    if (returnTo) {
      options.state = returnTo;
    }
    return options;
  }
}
