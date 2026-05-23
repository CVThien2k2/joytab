import { ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { resolveGoogleLoginRedirectTarget } from '../../auth/auth.utils';

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  /**
   * Input: ConfigService để đọc FRONTEND_ORIGIN và cấu hình guard OAuth Google.
   * Output: Khởi tạo guard có thể đính redirectTo vào state trước khi chuyển hướng sang Google.
   */
  constructor(private readonly configService: ConfigService) {
    super();
  }

  /**
   * Input: ExecutionContext của luồng OAuth, chứa query redirectTo từ FE.
   * Output: Trả authenticate options với state đã chuẩn hóa để callback biết redirect đích.
   */
  override getAuthenticateOptions(
    context: ExecutionContext,
  ): Record<string, unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const redirectTo = (request.query.redirectTo as string) ?? undefined;
    return {
      state: resolveGoogleLoginRedirectTarget({
        redirectTo,
        frontendOrigin: this.configService.get<string>('FRONTEND_ORIGIN'),
      }),
    };
  }
}
