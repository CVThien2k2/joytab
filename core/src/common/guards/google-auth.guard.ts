import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard, IAuthModuleOptions } from '@nestjs/passport';
import { Request } from 'express';

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
   * Output: Truyền prompt=select_account cho Google khi query yêu cầu (luồng thêm tài khoản).
   */
  getAuthenticateOptions(context: ExecutionContext): IAuthModuleOptions {
    const request = context.switchToHttp().getRequest<Request>();
    if (request.query?.prompt === 'select_account') {
      return { prompt: 'select_account' };
    }
    return {};
  }
}
