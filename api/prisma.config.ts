import 'dotenv/config';
import { defineConfig } from 'prisma/config';
import { buildPostgresUrl } from './src/common/utils/database-url';

/**
 * Input: Không có tham số, đọc DB_HOST từ biến môi trường.
 * Output: Trả về host PostgreSQL, mặc định là 127.0.0.1 nếu chưa cấu hình.
 */
function getDbHost(): string {
  return process.env.DB_HOST ?? '127.0.0.1';
}

/**
 * Input: Không có tham số, đọc DB_USER từ biến môi trường.
 * Output: Trả về username PostgreSQL, mặc định là postgres nếu chưa cấu hình.
 */
function getDbUser(): string {
  return process.env.DB_USER ?? 'postgres';
}

/**
 * Input: Không có tham số, đọc DB_PASSWORD từ biến môi trường.
 * Output: Trả về password PostgreSQL, mặc định là postgres nếu chưa cấu hình.
 */
function getDbPassword(): string {
  return process.env.DB_PASSWORD ?? 'postgres';
}

/**
 * Input: Không có tham số, đọc DB_NAME từ biến môi trường.
 * Output: Trả về tên database PostgreSQL, mặc định là postgres nếu chưa cấu hình.
 */
function getDbName(): string {
  return process.env.DB_NAME ?? 'postgres';
}

/**
 * Input: Không có tham số, đọc DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, DB_PARAMS.
 * Output: Trả về connection string PostgreSQL cho Prisma CLI (dùng chung buildPostgresUrl với runtime).
 */
function buildDatabaseUrl(): string {
  return buildPostgresUrl({
    host: getDbHost(),
    user: getDbUser(),
    password: getDbPassword(),
    database: getDbName(),
    port: process.env.DB_PORT,
    params: process.env.DB_PARAMS,
  });
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: buildDatabaseUrl(),
  },
});
