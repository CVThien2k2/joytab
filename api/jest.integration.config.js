/**
 * Integration test chạy trên Postgres thật (database `*_test` riêng, xem test/global-setup.ts).
 *
 * Tách khỏi jest.config.js vì hai bộ có yêu cầu hoàn toàn khác nhau: unit test chạy được ở
 * mọi nơi trong ~2s, integration test cần container postgres đang chạy.
 *
 * `maxWorkers: 1` là bắt buộc: mọi spec dùng chung một database và tự truncate ở beforeEach,
 * chạy song song thì spec này xoá dữ liệu của spec kia.
 */
/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testRegex: 'src/.*\\.integration\\.spec\\.ts$',
  moduleFileExtensions: ['ts', 'js', 'json'],
  globalSetup: '<rootDir>/test/global-setup.ts',
  maxWorkers: 1,
  testTimeout: 30000,
};
