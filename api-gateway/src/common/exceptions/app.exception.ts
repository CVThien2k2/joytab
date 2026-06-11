import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCodeItem } from '../constants/error-codes.constant';

const STATUS_BY_CODE: Record<string, HttpStatus> = {
  AUTH_001: HttpStatus.UNAUTHORIZED,
  AUTH_004: HttpStatus.UNAUTHORIZED,
  AUTH_005: HttpStatus.UNAUTHORIZED,
  AUTH_006: HttpStatus.FORBIDDEN,
  SYS_404: HttpStatus.NOT_FOUND,
  SYS_001: HttpStatus.INTERNAL_SERVER_ERROR,
  SYS_502: HttpStatus.BAD_GATEWAY,
  SYS_503: HttpStatus.SERVICE_UNAVAILABLE,
  SYS_504: HttpStatus.GATEWAY_TIMEOUT,
};

export class AppException extends HttpException {
  public readonly code: string;

  /**
   * Input: Error code object chuẩn.
   * Output: HttpException nghiệp vụ — map code sang HTTP status tương ứng (mặc định 500).
   */
  constructor(error: ErrorCodeItem) {
    super(
      error.message,
      STATUS_BY_CODE[error.code] ?? HttpStatus.INTERNAL_SERVER_ERROR,
    );
    this.code = error.code;
  }
}
