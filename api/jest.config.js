/**
 * Unit test — hàm thuần, không chạm DB, chạy được ở mọi nơi.
 *
 * `*.integration.spec.ts` bị loại ra đây và có config riêng (jest.integration.config.js)
 * vì chúng cần một container postgres đang chạy.
 */
/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  testPathIgnorePatterns: ['\\.integration\\.spec\\.ts$'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  collectCoverageFrom: ['**/*.(t|j)s'],
};
