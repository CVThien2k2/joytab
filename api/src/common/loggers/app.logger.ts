import { ConsoleLogger, Injectable, LogLevel } from '@nestjs/common';
import { AppException } from '../exceptions/app.exception';

@Injectable()
export class AppLogger extends ConsoleLogger {
  /**
   * Input: message và optionalParams do NestJS truyền vào khi log error.
   * Output: In log lỗi ngắn gọn, ưu tiên hiển thị code/message thay vì stack trace dài.
   */
  override error(message: unknown, ...optionalParams: unknown[]): void {
    const compactMessage = this.buildCompactErrorMessage(message);
    const context = this.extractContext(optionalParams);
    super.error(compactMessage, undefined, context);
  }

  /**
   * Input: message lỗi gốc có thể là Error/AppException/string/object.
   * Output: Trả chuỗi lỗi ngắn để hiển thị trong log bootstrap/runtime.
   */
  private buildCompactErrorMessage(message: unknown): string {
    if (message instanceof AppException) {
      return `[${message.code}] ${message.message}`;
    }

    if (message instanceof Error) {
      return message.message;
    }

    if (typeof message === 'string' && message.trim()) {
      return message;
    }

    return 'Unexpected error';
  }

  /**
   * Input: Danh sách optional params từ logger của NestJS.
   * Output: Trả context nếu có để giữ nguồn log, ngược lại dùng context mặc định.
   */
  private extractContext(optionalParams: unknown[]): string | undefined {
    for (const param of optionalParams) {
      if (typeof param === 'string' && this.isLogLevelContext(param)) {
        return param;
      }
    }

    return undefined;
  }

  /**
   * Input: Chuỗi context ứng viên từ optional params.
   * Output: Xác định context hợp lệ, loại bỏ stack trace và log level.
   */
  private isLogLevelContext(value: string): boolean {
    const nestLogLevels: LogLevel[] = ['log', 'error', 'warn', 'debug', 'verbose', 'fatal'];

    if (!value.trim()) {
      return false;
    }

    return !nestLogLevels.includes(value as LogLevel) && !value.includes('\n');
  }
}
