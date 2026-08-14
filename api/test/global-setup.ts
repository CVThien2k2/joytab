import { execFileSync } from 'node:child_process';
import { Client } from 'pg';
import { getIntegrationDbConfig } from './integration-env';

/**
 * Input: Không có tham số.
 * Output: Đảm bảo database `*_test` tồn tại và đã chạy hết migration, trước khi Jest chạy
 *         bất kỳ integration spec nào.
 *
 * Dùng `migrate deploy` chứ không phải `migrate dev`: deploy chỉ áp migration đã commit,
 * không sinh file mới và không bao giờ hỏi reset.
 */
export default async function globalSetup(): Promise<void> {
  const config = getIntegrationDbConfig();

  const admin = new Client({ connectionString: config.adminUrl });
  await admin.connect();
  try {
    const existing = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [config.database]);
    if (existing.rowCount === 0) {
      // Tên database không tham số hoá được trong CREATE DATABASE; nó do chính env của repo
      // sinh ra chứ không phải input người dùng, và vẫn được bọc dấu nháy kép.
      await admin.query(`CREATE DATABASE "${config.database}"`);
    }
  } finally {
    await admin.end();
  }

  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    cwd: `${__dirname}/..`,
    env: { ...process.env, DB_NAME: config.database },
    stdio: 'inherit',
  });
}
