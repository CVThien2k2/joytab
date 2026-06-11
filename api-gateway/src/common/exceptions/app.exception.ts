import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCodeItem } from '../constants/error-codes.constant';

export class AppException extends HttpException {
  public readonly code: string;

  /**
   * Input: Error code object chuẩn.
   * Output: HttpException nghiệp vụ — map code sang status (AUTH_006→403, còn lại→401).
   */
  constructor(error: ErrorCodeItem) {
    super(
      error.message,
      error.code === 'AUTH_006'
        ? HttpStatus.FORBIDDEN
        : HttpStatus.UNAUTHORIZED,
    );
    this.code = error.code;
  }
}
