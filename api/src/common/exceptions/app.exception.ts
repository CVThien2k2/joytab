import { HttpException } from '@nestjs/common';
import { ErrorCodeItem, ErrorCodeValue } from '../utils/types';

/**
 * Exception nghiệp vụ dùng chung: nhận một mục trong ERROR_CODES và dùng luôn `status`
 * nhúng sẵn của mã đó. Ném ở bất kỳ đâu: `throw new AppException(ERROR_CODES.SYS_404)`.
 */
export class AppException extends HttpException {
  public readonly code: ErrorCodeValue;

  /**
   * Input: Error code object chuẩn (code + status + message).
   * Output: HttpException mang sẵn status đúng và giữ lại `code` cho exception filter.
   */
  constructor(error: ErrorCodeItem) {
    super(error.message, error.status);
    this.code = error.code as ErrorCodeValue;
  }
}
