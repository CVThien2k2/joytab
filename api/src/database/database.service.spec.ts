import { ConfigService } from '@nestjs/config';
import { ERROR_CODES } from '../common/constants/error-codes.constant';
import { AppException } from '../common/exceptions/app.exception';
import { DatabaseService } from './database.service';

describe('DatabaseService', () => {
  /**
   * Input: Override tùy chọn cho các biến DB bắt buộc.
   * Output: Trả ConfigService chứa đủ cấu hình DB để khởi tạo DatabaseService.
   */
  function createDbConfigService(overrides?: Partial<Record<string, string>>) {
    return new ConfigService({
      DB_HOST: '127.0.0.1',
      DB_USER: 'postgres',
      DB_PASSWORD: 'postgres',
      DB_NAME: 'joytab',
      ...overrides,
    });
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('calls $connect in onModuleInit', async () => {
    const service = new DatabaseService(createDbConfigService());
    const connectSpy = jest
      .spyOn(service, '$connect')
      .mockResolvedValue(undefined);

    await service.onModuleInit();

    expect(connectSpy).toHaveBeenCalledTimes(1);
  });

  it('calls $disconnect in onModuleDestroy', async () => {
    const service = new DatabaseService(createDbConfigService());
    const disconnectSpy = jest
      .spyOn(service, '$disconnect')
      .mockResolvedValue(undefined);

    await service.onModuleDestroy();

    expect(disconnectSpy).toHaveBeenCalledTimes(1);
  });

  it('throws SYS_005 when DB_HOST is missing', () => {
    try {
      new DatabaseService(
        createDbConfigService({
          DB_HOST: '',
        }),
      );
      throw new Error('Expected constructor to throw AppException');
    } catch (error) {
      expect(error).toBeInstanceOf(AppException);
      expect((error as AppException).code).toBe(ERROR_CODES.SYS_005.code);
    }
  });
});
