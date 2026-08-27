import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { buildPostgresUrl } from '../src/common/utils/database-url';
import { PrismaClient } from '../src/generated/prisma/client';

/**
 * Seed dữ liệu tổ chức cho môi trường dev.
 *
 * Idempotent hoàn toàn: mọi thao tác là upsert theo khoá unique nên chạy bao nhiêu lần cũng
 * ra cùng một kết quả. Cố tình CHỈ chạm tới các row có tiền tố `seed.` / mã `SEED*` —
 * user thật đăng nhập bằng Google không bị seed ghi đè.
 */

/** Mọi email seed đều thuộc domain này để phân biệt với user thật và xoá dọn dễ. */
const SEED_EMAIL_DOMAIN = 'joytab.dev';

/** Mã tham gia của org seed. Chỉ dùng ký tự Crockford base32 (không có I L O U). */
const DEMO_JOIN_CODE = 'SEED0001';
const CLASS_FUND_JOIN_CODE = 'SEED0002';

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: buildPostgresUrl({
      host: process.env.DB_HOST ?? '127.0.0.1',
      user: process.env.DB_USER ?? 'postgres',
      password: process.env.DB_PASSWORD ?? 'postgres',
      database: process.env.DB_NAME ?? 'postgres',
      port: process.env.DB_PORT,
      params: process.env.DB_PARAMS,
    }),
  }),
});

/**
 * Input: Tên đăng nhập ngắn (vd 'owner') + họ tên hiển thị.
 * Output: User seed đã onboarded, upsert theo provider_user_id nên gọi lại không tạo trùng.
 *
 *         Đặt `onboarded: true` để login seed vào được app ngay, không bị proxy đá về
 *         /onboarding — seed là để xem UI tổ chức, không phải để test onboarding.
 */
async function upsertSeedUser(handle: string, fullName: string) {
  const email = `seed.${handle}@${SEED_EMAIL_DOMAIN}`;
  const providerUserId = `seed-${handle}`;
  const data = {
    provider: 'google',
    email,
    full_name: fullName,
    avatar_url: null,
    age: 30,
    gender: 'other',
    phone: null,
    onboarded: true,
    status: 'active',
  };

  return prisma.user.upsert({
    where: { provider_user_id: providerUserId },
    update: data,
    create: { ...data, provider_user_id: providerUserId },
  });
}

/**
 * Input: Tên tổ chức, mã tham gia, công tắc cho phép vào bằng mã, id người tạo.
 * Output: Tổ chức đã upsert theo `join_code` (unique) — mã seed là hằng số nên chạy lại
 *         không sinh thêm tổ chức.
 */
async function upsertSeedOrganization(params: {
  name: string;
  joinCode: string;
  joinByCodeEnabled: boolean;
  createdBy: string;
}) {
  return prisma.organization.upsert({
    where: { join_code: params.joinCode },
    update: { name: params.name, join_by_code_enabled: params.joinByCodeEnabled },
    create: {
      name: params.name,
      join_code: params.joinCode,
      join_by_code_enabled: params.joinByCodeEnabled,
      created_by: params.createdBy,
    },
  });
}

/**
 * Input: id tổ chức, id user, vai trò.
 * Output: Row thành viên, upsert theo unique (organization_id, user_id).
 */
async function upsertSeedMember(organizationId: string, userId: string, role: 'owner' | 'member') {
  return prisma.organizationMember.upsert({
    where: { organization_id_user_id: { organization_id: organizationId, user_id: userId } },
    update: { role },
    create: { organization_id: organizationId, user_id: userId, role },
  });
}

async function main(): Promise<void> {
  const owner = await upsertSeedUser('owner', 'Seed Owner');
  const member = await upsertSeedUser('member', 'Seed Member');
  const guest = await upsertSeedUser('guest', 'Seed Guest');

  // Org 1: mở cửa bằng mã — dùng để test luồng "tham gia bằng mã".
  const demo = await upsertSeedOrganization({
    name: 'Joytab Demo',
    joinCode: DEMO_JOIN_CODE,
    joinByCodeEnabled: true,
    createdBy: owner.id,
  });
  // Org 2: đóng cửa — nhập đúng mã vẫn phải bị từ chối. `member` là OWNER ở đây trong khi chỉ
  // là member ở org 1: đó là cả điểm của thiết kế n-n, vai trò thuộc về cặp (org, user).
  const classFund = await upsertSeedOrganization({
    name: 'Quỹ lớp 12A',
    joinCode: CLASS_FUND_JOIN_CODE,
    joinByCodeEnabled: false,
    createdBy: member.id,
  });

  await upsertSeedMember(demo.id, owner.id, 'owner');
  await upsertSeedMember(demo.id, member.id, 'member');
  await upsertSeedMember(classFund.id, member.id, 'owner');

  console.log('Seed xong:');
  console.log(`  ${owner.email} — owner của "${demo.name}" (mã ${DEMO_JOIN_CODE}, mở cửa)`);
  console.log(`  ${member.email} — member của "${demo.name}", owner của "${classFund.name}" (mã ${CLASS_FUND_JOIN_CODE}, đóng)`);
  console.log(`  ${guest.email} — chưa vào tổ chức nào (dùng để xem UI 2 nút)`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
