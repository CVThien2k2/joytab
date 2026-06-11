/**
 * Các thành phần để dựng connection string PostgreSQL.
 * Bên gọi tự resolve giá trị (ConfigService bắt buộc, hoặc process.env có default) rồi truyền vào.
 */
export interface PostgresUrlParts {
  host: string;
  user: string;
  password: string;
  database: string;
  port?: string;
  params?: string;
}

/**
 * Input: Các phần host/user/password/database (+ port, params tùy chọn) đã resolve sẵn.
 * Output: Connection string PostgreSQL chuẩn — port mặc định 5432, params chuẩn hóa tiền tố `?`.
 *
 * Dùng chung cho cả runtime (DatabaseService) và Prisma CLI (prisma.config.ts) để 1 nguồn logic.
 */
export function buildPostgresUrl(parts: PostgresUrlParts): string {
  const user = encodeURIComponent(parts.user);
  const password = encodeURIComponent(parts.password);
  const port = (parts.port ?? '').trim() || '5432';
  const rawParams = (parts.params ?? '').trim();
  const query = rawParams ? `?${rawParams.replace(/^\?+/, '')}` : '';
  return `postgresql://${user}:${password}@${parts.host}:${port}/${parts.database}${query}`;
}
