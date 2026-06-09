import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCodeItem, ErrorCodeValue } from '../utils/types';

export class AppException extends HttpException {
  public readonly code: ErrorCodeValue;

  /**
   * Input: Error code object chuẩn.
   * Output: Khởi tạo exception nghiệp vụ dùng chung cho NestJS module trong dự án.
   */
  constructor(error: ErrorCodeItem) {
    super(error.message, AppException.mapStatusByCode(error.code));
    this.code = error.code;
  }

  /**
   * Input: Mã lỗi chuẩn của dự án.
   * Output: Trả HTTP status tương ứng dựa trên mapping theo mã lỗi.
   */
  private static mapStatusByCode(code: ErrorCodeValue): HttpStatus {
    switch (code) {
      case 'AUTH_001':
        return HttpStatus.UNAUTHORIZED;
      case 'AUTH_003':
        return HttpStatus.UNAUTHORIZED;
      case 'AUTH_004':
        return HttpStatus.UNAUTHORIZED;
      case 'AUTH_005':
        return HttpStatus.UNAUTHORIZED;
      case 'AUTH_002':
      case 'VALIDATION_001':
        return HttpStatus.BAD_REQUEST;
      case 'SYS_404':
        return HttpStatus.NOT_FOUND;
      case 'SYS_001':
      case 'SYS_002':
      case 'SYS_003':
      case 'SYS_004':
      case 'SYS_005':
      case 'SYS_006':
      case 'SYS_007':
      case 'SYS_008':
      case 'SYS_009':
      case 'SYS_010':
      case 'SYS_011':
      case 'SYS_012':
      case 'UNKNOWN_001':
      default:
        return HttpStatus.INTERNAL_SERVER_ERROR;
    }
  }
}
