import 'dotenv/config';
import { buildPostgresUrl } from '../src/common/utils/database-url';

/**
 * Input: Không có tham số; đọc DB_* từ `api/.env`.
 * Output: Cấu hình DB cho integration test — LUÔN là một database riêng có hậu tố `_test`.
 *
 * Không bao giờ dùng chung database với dev: test truncate sạch bảng ở mỗi ca, chạy nhầm
 * vào DB dev là mất hết dữ liệu đang làm dở.
 */
export function getIntegrationDbConfig() {
  const host = process.env.DB_HOST ?? '127.0.0.1';
  const user = process.env.DB_USER ?? 'postgres';
  const password = process.env.DB_PASSWORD ?? 'postgres';
  const port = process.env.DB_PORT;
  const baseName = process.env.DB_NAME ?? 'postgres';
  const database = baseName.endsWith('_test') ? baseName : `${baseName}_test`;

  return {
    host,
    user,
    password,
    port,
    database,
    url: buildPostgresUrl({ host, user, password, database, port }),
    adminUrl: buildPostgresUrl({ host, user, password, database: 'postgres', port }),
  };
}
