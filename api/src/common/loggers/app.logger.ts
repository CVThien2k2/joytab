import { ConsoleLogger, Injectable, LogLevel } from '@nestjs/common';
import { appendFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { AppException } from '../exceptions/app.exception';

type LogTask = () => void;
type LogLevelName = 'log' | 'error' | 'warn' | 'debug' | 'verbose' | 'fatal';

@Injectable()
export class AppLogger extends ConsoleLogger {
  private readonly queue: LogTask[] = [];
  private readonly logDirectory = this.resolveLogDirectory();
  private isDraining = false;

  /**
   * Input: message và optionalParams do NestJS truyền vào khi log thường.
   * Output: Đưa log vào hàng đợi bất đồng bộ để giảm block request path.
   */
  override log(message: unknown, ...optionalParams: unknown[]): void {
    this.enqueue(() => {
      super.log(message, ...optionalParams);
      void this.writeFileLog('log', message, optionalParams);
    });
  }

  /**
   * Input: message và optionalParams do NestJS truyền vào khi log error.
   * Output: Đưa log lỗi rút gọn vào hàng đợi bất đồng bộ, ưu tiên hiển thị code/message thay vì stack trace dài.
   */
  override error(message: unknown, ...optionalParams: unknown[]): void {
    const compactMessage = this.buildCompactErrorMessage(message);
    const context = this.extractContext(optionalParams);
    this.enqueue(() => {
      super.error(compactMessage, undefined, context);
      void this.writeFileLog('error', compactMessage, context ? [context] : []);
    });
  }

  /**
   * Input: message và optionalParams do NestJS truyền vào khi log cảnh báo.
   * Output: Đưa warning log vào hàng đợi bất đồng bộ.
   */
  override warn(message: unknown, ...optionalParams: unknown[]): void {
    this.enqueue(() => {
      super.warn(message, ...optionalParams);
      void this.writeFileLog('warn', message, optionalParams);
    });
  }

  /**
   * Input: message và optionalParams do NestJS truyền vào khi log debug.
   * Output: Đưa debug log vào hàng đợi bất đồng bộ.
   */
  override debug(message: unknown, ...optionalParams: unknown[]): void {
    this.enqueue(() => {
      super.debug(message, ...optionalParams);
      void this.writeFileLog('debug', message, optionalParams);
    });
  }

  /**
   * Input: message và optionalParams do NestJS truyền vào khi log verbose.
   * Output: Đưa verbose log vào hàng đợi bất đồng bộ.
   */
  override verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.enqueue(() => {
      super.verbose(message, ...optionalParams);
      void this.writeFileLog('verbose', message, optionalParams);
    });
  }

  /**
   * Input: message và optionalParams do NestJS truyền vào khi log fatal.
   * Output: Đưa fatal log vào hàng đợi bất đồng bộ.
   */
  override fatal(message: unknown, ...optionalParams: unknown[]): void {
    this.enqueue(() => {
      super.fatal(message, ...optionalParams);
      void this.writeFileLog('fatal', message, optionalParams);
    });
  }

  /**
   * Input: Tác vụ ghi log thực tế.
   * Output: Đưa task vào queue và lên lịch drain ở tick kế tiếp.
   */
  private enqueue(task: LogTask): void {
    this.queue.push(task);
    this.scheduleDrain();
  }

  /**
   * Input: Queue log hiện tại.
   * Output: Ghi toàn bộ log đã gom trong queue theo thứ tự FIFO.
   */
  private drainQueue(): void {
    try {
      let task: LogTask | undefined;
      while ((task = this.queue.shift())) {
        task();
      }
    } finally {
      this.isDraining = false;
      if (this.queue.length > 0) {
        this.scheduleDrain();
      }
    }
  }

  /**
   * Input: Trạng thái queue hiện tại.
   * Output: Lên lịch drain một lần nếu chưa có drain đang chạy.
   */
  private scheduleDrain(): void {
    if (this.isDraining) {
      return;
    }

    this.isDraining = true;
    setImmediate(() => this.drainQueue());
  }

  /**
   * Input: Log level, message và optional params đã nhận từ NestJS logger.
   * Output: Ghi thêm một dòng log vào file `logs/YYYY-MM-DD.log` bất đồng bộ.
   */
  private async writeFileLog(level: LogLevelName, message: unknown, optionalParams: unknown[]): Promise<void> {
    try {
      await mkdir(this.logDirectory, { recursive: true });
      await appendFile(this.getTodayLogPath(), `${this.formatFileLogLine(level, message, optionalParams)}\n`, 'utf8');
    } catch {
      // Không ném lỗi logging để tránh ảnh hưởng request/runtime chính.
    }
  }

  /**
   * Input: Không nhận tham số.
   * Output: Đường dẫn file log theo ngày hiện tại tại thư mục `logs`.
   */
  private getTodayLogPath(): string {
    const date = new Date().toISOString().slice(0, 10);
    return join(this.logDirectory, `${date}.log`);
  }

  /**
   * Input: Level, message và optional params.
   * Output: Một dòng log text ổn định để ghi file.
   */
  private formatFileLogLine(level: LogLevelName, message: unknown, optionalParams: unknown[]): string {
    const timestamp = new Date().toISOString();
    const context = this.extractContext(optionalParams);
    const contextPart = context ? ` [${context}]` : '';
    return `${timestamp} ${level.toUpperCase().padEnd(7)}${contextPart} ${this.stringifyForFile(message)}`;
  }

  /**
   * Input: Giá trị message bất kỳ từ logger.
   * Output: Chuỗi ngắn gọn để ghi file log.
   */
  private stringifyForFile(value: unknown): string {
    if (value instanceof Error) {
      return value.message;
    }
    if (typeof value === 'string') {
      return value;
    }
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  /**
   * Input: Runtime cwd hiện tại.
   * Output: Đường dẫn thư mục log thuộc dự án BE (`api/logs`) ở cả dev và dist runtime.
   */
  private resolveLogDirectory(): string {
    const cwd = process.cwd();
    return cwd.endsWith('api') ? join(cwd, 'logs') : join(cwd, 'api', 'logs');
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
