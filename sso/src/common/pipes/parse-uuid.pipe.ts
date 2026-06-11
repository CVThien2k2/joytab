import { HttpStatus, ParseUUIDPipe } from '@nestjs/common';
import { ERROR_CODES } from '../constants/error-codes.constant';
import { AppException } from '../exceptions/app.exception';

export class CommonParseUuidPipe extends ParseUUIDPipe {
  /**
   * Input: Không có tham số đầu vào.
   * Output: Khởi tạo UUID pipe dùng chung với format lỗi thống nhất theo AppException.
   */
  constructor() {
    super({
      version: '4',
      errorHttpStatusCode: HttpStatus.BAD_REQUEST,
      exceptionFactory: () => new AppException(ERROR_CODES.VALIDATION_001),
    });
  }
}
