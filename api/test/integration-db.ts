import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../src/database/database.service';
import { getIntegrationDbConfig } from './integration-env';

/** Thứ tự truncate không quan trọng vì dùng CASCADE, nhưng liệt kê đủ để không sót bảng nào. */
const BUSINESS_TABLES = [
  'payment_allocations',
  'payments',
  'event_settlements',
  'event_attendances',
  'events',
  'event_templates',
  'organization_invites',
  'organization_members',
  'organizations',
  'refresh_tokens',
  'users',
];

/**
 * Input: Không có tham số.
 * Output: DatabaseService trỏ vào database `*_test`.
 *
 * Dựng thẳng bằng `new` thay vì qua Nest DI: integration test ở đây kiểm tra hành vi
 * transaction/khoá row của service, không kiểm tra dây DI — dựng tay nhanh hơn hẳn.
 */
export function createTestDatabaseService(): DatabaseService {
  const config = getIntegrationDbConfig();
  const configService = {
    get: (key: string) =>
      ({
        DB_HOST: config.host,
        DB_USER: config.user,
        DB_PASSWORD: config.password,
        DB_NAME: config.database,
        DB_PORT: config.port,
        FRONTEND_ORIGIN: 'http://localhost:3000',
      })[key],
  } as unknown as ConfigService;

  return new DatabaseService(configService);
}

/**
 * Input: DatabaseService của test.
 * Output: Xoá sạch mọi bảng nghiệp vụ để ca test sau không thấy dữ liệu của ca trước.
 */
export async function resetDatabase(db: DatabaseService): Promise<void> {
  await db.$executeRawUnsafe(`TRUNCATE TABLE ${BUSINESS_TABLES.map((table) => `"${table}"`).join(', ')} CASCADE`);
}

/**
 * Input: DatabaseService và hậu tố để phân biệt user.
 * Output: Một user thật trong DB (mọi bảng nghiệp vụ đều có FK tới users).
 */
export async function createUser(db: DatabaseService, suffix: string) {
  return db.user.create({
    data: {
      provider: 'google',
      provider_user_id: `google-${suffix}`,
      email: `${suffix}@example.com`,
      email_verified: true,
      full_name: `User ${suffix}`,
    },
  });
}
