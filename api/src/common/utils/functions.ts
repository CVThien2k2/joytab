import { ConfigService } from '@nestjs/config';
import { ErrorCodeItem } from './types';
import { AppException } from '../exceptions/app.exception';

/**
 * Input: ConfigService, tên biến môi trường và mã lỗi tương ứng nếu biến bị thiếu.
 * Output: Trả về giá trị cấu hình bắt buộc hoặc ném AppException theo mã lỗi đã chỉ định.
 */
export function getRequiredConfig(configService: ConfigService, key: string, errorCode: ErrorCodeItem): string {
  const value = configService.get<string>(key);
  if (!value) throw new AppException(errorCode);

  return value;
}

/**
 * Input: ConfigService có thể chứa NODE_ENV.
 * Output: Trả true nếu runtime đang ở production, ngược lại trả false.
 */
export function isProductionEnvironment(configService: ConfigService): boolean {
  const nodeEnv = configService.get<string>('NODE_ENV');
  return nodeEnv?.trim().toLowerCase() === 'production';
}
