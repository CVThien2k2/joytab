import 'dotenv/config';
import { defineConfig } from 'prisma/config';

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
 * Input: Không có tham số, đọc các biến DB_HOST, DB_USER, DB_PASSWORD, DB_NAME.
 * Output: Trả về connection string PostgreSQL cho Prisma CLI.
 */
function buildDatabaseUrl(): string {
  const user = encodeURIComponent(getDbUser());
  const password = encodeURIComponent(getDbPassword());
  const host = getDbHost();
  const database = getDbName();
  return `postgresql://${user}:${password}@${host}:5432/${database}`;
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
