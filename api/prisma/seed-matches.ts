import 'dotenv/config';
import { createHash } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { buildPostgresUrl } from '../src/common/utils/database-url';
import { PrismaClient } from '../src/generated/prisma/client';
import { splitExpenses } from '../src/matches/matches.utils';

/**
 * Seed lịch thi đấu cho môi trường dev: người chơi, trận đã đá, trận sắp tới, và một trận đã
 * chốt chi phí sẵn.
 *
 * Khác `seed.ts` ở chỗ nó ghi vào một tổ chức THẬT (tổ chức bạn đang đăng nhập bằng Google),
 * vì mục đích là bấm thử luồng "chốt chi phí" trên UI — mà luồng đó chỉ owner của tổ chức đó
 * mới thấy. Chọn tổ chức nào: xem `resolveOrganization`.
 *
 * Nhường lịch có sẵn: buổi nào trùng giờ với một trận đã có của tổ chức thì bỏ qua, vì app
 * không cho hai trận giao giờ trong cùng một tổ chức (MATCH_014).
 *
 * Idempotent bằng id TIỀN ĐỊNH: id mỗi trận sinh ra từ băm của một khoá chuỗi (`seedUuid`), nên
 * chạy lại là ghi lại đúng những row đó chứ không sinh thêm trận mới. Bảng con của trận seed
 * (vote, lịch sử, chi phí, tiền từng người) bị XOÁ rồi dựng lại mỗi lần chạy — nghĩa là nếu
 * bạn đã tự chốt chi phí hay thanh toán trên một trận seed thì chạy lại sẽ mất phần đó.
 *
 * Chạy: `pnpm --filter api db:seed:matches [tên hoặc id tổ chức]`
 */

/** Mọi email seed đều thuộc domain này để phân biệt với user thật và xoá dọn dễ. */
const SEED_EMAIL_DOMAIN = 'joytab.dev';

/**
 * Input: khoá chuỗi bất kỳ.
 * Output: UUID v5 cố định theo khoá đó.
 *
 *         Có nó thì `upsert` mới dùng được: `matches` không có khoá nghiệp vụ nào unique
 *         (cùng sân, cùng giờ, hai trận khác nhau là hợp lệ), nên nếu id sinh ngẫu nhiên thì
 *         chạy seed lần hai là nhân đôi cả lịch.
 */
function seedUuid(key: string): string {
  const hash = createHash('sha1').update(`joytab.seed:${key}`).digest('hex');
  const variant = ((parseInt(hash.slice(16, 17), 16) & 0x3) | 0x8).toString(16);
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    `5${hash.slice(13, 16)}`,
    `${variant}${hash.slice(17, 20)}`,
    hash.slice(20, 32),
  ].join('-');
}

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

/** Người chơi seed. Đủ cả hai giới để hệ số nam/nữ ra hai con số khác nhau khi chia tiền. */
const PLAYERS = [
  { handle: 'lan', fullName: 'Nguyễn Thị Lan', gender: 'female', age: 26 },
  { handle: 'mai', fullName: 'Trần Ngọc Mai', gender: 'female', age: 24 },
  { handle: 'yen', fullName: 'Phạm Hải Yến', gender: 'female', age: 29 },
  { handle: 'huy', fullName: 'Lê Quang Huy', gender: 'male', age: 31 },
  { handle: 'kiet', fullName: 'Đỗ Tuấn Kiệt', gender: 'male', age: 27 },
  { handle: 'long', fullName: 'Vũ Bảo Long', gender: 'male', age: 34 },
] as const;

type PlayerHandle = (typeof PLAYERS)[number]['handle'];

/** Ai trong số THÀNH VIÊN THẬT của tổ chức được cho vote trận này. */
type RealVoters = 'all' | 'first' | 'none';

type MatchPlan = {
  /** Khoá sinh id. Đổi khoá là ra một trận khác, đừng đổi khi chỉ muốn sửa nội dung. */
  key: string;
  /** Lệch bao nhiêu ngày so với hôm nay. Âm = đã đá xong. */
  dayOffset: number;
  startHour: number;
  hours: number;
  court: string;
  maxPlayers: number;
  maleRatio: string;
  note?: string;
  players: PlayerHandle[];
  realVoters: RealVoters;
  status: 'open' | 'settled' | 'canceled';
  /** Chỉ dùng khi `status = 'settled'`. Đơn giá, đơn vị đồng. */
  expenses?: { name: string; quantity: number; unitPrice: number }[];
  /** Một người đã đăng ký rồi rút — chỉ để lịch sử đăng ký có gì mà xem. */
  canceledBy?: PlayerHandle;
};

/**
 * Lịch seed, xếp theo trục thời gian. Mỗi trận có một việc để thử:
 *  - đã đá + CHƯA chốt (3 trận): đây là chỗ bấm "Chốt chi phí" — mục đích chính của seed này.
 *  - đã chốt sẵn (1 trận): xem bảng chia tiền và tiền từng người mà không phải tự nhập.
 *  - sắp tới (4 trận): còn chỗ / đủ người / chưa ai đăng ký, để thử đăng ký và dời lịch.
 *  - đã huỷ (1 trận): không hiện trên lịch, có mặt để chắc rằng nó KHÔNG hiện.
 */
const MATCH_PLANS: MatchPlan[] = [
  {
    key: 'settled-1',
    dayOffset: -14,
    startHour: 19,
    hours: 2,
    court: 'Sân Cầu Vồng',
    maxPlayers: 10,
    maleRatio: '1.20',
    note: 'Buổi đã chốt tiền — dùng để xem bảng chia tiền.',
    players: ['lan', 'mai', 'yen', 'huy', 'kiet', 'long'],
    realVoters: 'all',
    status: 'settled',
    expenses: [
      { name: 'Thuê sân', quantity: 2, unitPrice: 120_000 },
      { name: 'Cầu', quantity: 6, unitPrice: 25_000 },
      { name: 'Nước', quantity: 8, unitPrice: 10_000 },
    ],
  },
  {
    key: 'past-open-1',
    dayOffset: -9,
    startHour: 19,
    hours: 2,
    court: 'Sân Bách Khoa',
    maxPlayers: 12,
    maleRatio: '1.50',
    note: 'Đã đá xong, chưa chốt tiền. Hệ số nam 1.5 để thấy chênh lệch nam/nữ.',
    players: ['lan', 'mai', 'huy', 'kiet', 'long'],
    realVoters: 'all',
    status: 'open',
    canceledBy: 'yen',
  },
  {
    key: 'past-open-2',
    dayOffset: -5,
    startHour: 20,
    hours: 2,
    court: 'Sân Thanh Xuân',
    maxPlayers: 8,
    maleRatio: '1.00',
    note: 'Đã đá xong, chưa chốt tiền. Hệ số 1 nên mọi người chia đều.',
    players: ['yen', 'huy', 'long'],
    realVoters: 'all',
    status: 'open',
  },
  {
    key: 'past-open-3',
    dayOffset: -2,
    startHour: 19,
    hours: 2,
    court: 'Sân Mỹ Đình',
    maxPlayers: 10,
    maleRatio: '1.20',
    players: ['lan', 'mai', 'yen', 'huy', 'kiet', 'long'],
    realVoters: 'first',
    status: 'open',
  },
  {
    key: 'upcoming-1',
    dayOffset: 1,
    startHour: 19,
    hours: 2,
    court: 'Sân Cầu Vồng',
    maxPlayers: 10,
    maleRatio: '1.20',
    note: 'Còn chỗ. Bạn đã đăng ký sẵn để thấy dấu tích trên chip.',
    players: ['lan', 'huy', 'kiet'],
    realVoters: 'first',
    status: 'open',
  },
  {
    key: 'upcoming-full',
    dayOffset: 3,
    startHour: 18,
    hours: 2,
    court: 'Sân Trung Kính',
    maxPlayers: 4,
    maleRatio: '1.00',
    note: 'Đã đủ người — thẻ xem nhanh phải nói "đã đủ" và không cho đăng ký.',
    players: ['lan', 'mai', 'huy', 'kiet'],
    realVoters: 'none',
    status: 'open',
  },
  {
    key: 'upcoming-2',
    dayOffset: 5,
    startHour: 19,
    hours: 2,
    court: 'Sân Bách Khoa',
    maxPlayers: 12,
    maleRatio: '1.50',
    players: ['yen', 'long'],
    realVoters: 'none',
    status: 'open',
  },
  {
    key: 'upcoming-empty',
    dayOffset: 8,
    startHour: 7,
    hours: 2,
    court: 'Sân Hà Đông',
    maxPlayers: 8,
    maleRatio: '1.00',
    note: 'Chưa ai đăng ký. Buổi sáng để lịch không chỉ có một dải 19h.',
    players: [],
    realVoters: 'none',
    status: 'open',
  },
  {
    key: 'canceled-1',
    dayOffset: 10,
    startHour: 19,
    hours: 2,
    court: 'Sân Mỹ Đình',
    maxPlayers: 10,
    maleRatio: '1.00',
    note: 'Đã huỷ — không được hiện trên lịch.',
    players: ['lan', 'mai'],
    realVoters: 'none',
    status: 'canceled',
  },
];

/**
 * Input: `handle` ngắn + thông tin hiển thị.
 * Output: User seed đã onboarded, upsert theo provider_user_id.
 *
 *         Chép lại từ `seed.ts` chứ không import: file đó gọi `main()` ngay khi được nạp, nên
 *         import nó là chạy luôn cả seed tổ chức.
 */
async function upsertSeedUser(player: (typeof PLAYERS)[number]) {
  const providerUserId = `seed-${player.handle}`;
  const data = {
    provider: 'google',
    email: `seed.${player.handle}@${SEED_EMAIL_DOMAIN}`,
    full_name: player.fullName,
    avatar_url: null,
    age: player.age,
    gender: player.gender,
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
 * Input: tham số dòng lệnh (tên hoặc id tổ chức), có thể không có.
 * Output: Tổ chức sẽ nhận lịch seed.
 *
 *         Không có tham số thì chọn tổ chức có NHIỀU NGƯỜI THẬT NHẤT (user không phải seed):
 *         đó là tổ chức đang được dùng để thử, và cũng là tổ chức mà bạn đăng nhập vào sẽ thấy
 *         ngay. Chọn theo "nhiều thành viên nhất" thì các org của `seed.ts` cũng đua vào.
 */
async function resolveOrganization(target?: string) {
  if (target) {
    const found = await prisma.organization.findFirst({
      where: { OR: [{ name: target }, ...(target.includes('-') ? [{ id: target }] : [])] },
    });
    if (!found) throw new Error(`Không tìm thấy tổ chức "${target}"`);
    return found;
  }

  const organizations = await prisma.organization.findMany({
    include: {
      members: { include: { user: { select: { provider_user_id: true } } } },
    },
  });

  const ranked = organizations
    .map((organization) => ({
      organization,
      realMembers: organization.members.filter((member) => !member.user.provider_user_id.startsWith('seed-')).length,
    }))
    .sort((a, b) => b.realMembers - a.realMembers);

  const best = ranked[0];
  if (!best || best.realMembers === 0) {
    throw new Error(
      'Không có tổ chức nào có người thật. Đăng nhập bằng Google và tạo tổ chức trước, hoặc truyền tên tổ chức vào.',
    );
  }
  return best.organization;
}

/** Mốc 0h hôm nay theo giờ máy, để mọi trận rơi vào đúng giờ tròn người ta hay đặt sân. */
function atLocalHour(dayOffset: number, hour: number): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + dayOffset);
  date.setHours(hour);
  return date;
}

async function main(): Promise<void> {
  const organization = await resolveOrganization(process.argv[2]);

  // Thành viên THẬT của tổ chức: họ là người tạo trận và là người vote cùng, nhờ vậy khi bạn
  // đăng nhập vào là thấy ngay "Bạn đã đăng ký" trên vài buổi chứ không phải một lịch của
  // người lạ.
  const realMembers = await prisma.organizationMember.findMany({
    where: {
      organization_id: organization.id,
      NOT: { user: { provider_user_id: { startsWith: 'seed-' } } },
    },
    select: { user_id: true, role: true, user: { select: { full_name: true, gender: true } } },
    orderBy: { joined_at: 'asc' },
  });

  const owner = realMembers.find((member) => member.role === 'owner') ?? realMembers[0];
  if (!owner) throw new Error('Tổ chức này không có thành viên thật nào để làm người tạo trận.');

  // Người chơi seed vào tổ chức với vai member. Owner vẫn là người thật — seed không giành quyền.
  const players = new Map<PlayerHandle, { id: string; gender: string | null; name: string }>();
  for (const player of PLAYERS) {
    const user = await upsertSeedUser(player);
    await prisma.organizationMember.upsert({
      where: {
        organization_id_user_id: { organization_id: organization.id, user_id: user.id },
      },
      update: { role: 'member' },
      create: { organization_id: organization.id, user_id: user.id, role: 'member' },
    });
    players.set(player.handle, {
      id: user.id,
      gender: player.gender,
      name: player.fullName,
    });
  }

  const summary: string[] = [];

  for (const plan of MATCH_PLANS) {
    const id = seedUuid(`match:${organization.id}:${plan.key}`);
    const startAt = atLocalHour(plan.dayOffset, plan.startHour);
    const endAt = new Date(startAt.getTime() + plan.hours * 60 * 60 * 1000);
    const createdAt = new Date(startAt.getTime() - 7 * 24 * 60 * 60 * 1000);
    const settledAt = plan.status === 'settled' ? new Date(endAt.getTime() + 60 * 60 * 1000) : null;

    const voters = [
      ...plan.players.map((handle) => {
        const player = players.get(handle);
        if (!player) throw new Error(`Người chơi seed không có: ${handle}`);
        return player;
      }),
      ...(plan.realVoters === 'none'
        ? []
        : (plan.realVoters === 'first' ? [owner] : realMembers).map((member) => ({
            id: member.user_id,
            gender: member.user.gender,
            name: member.user.full_name ?? 'Người thật',
          }))),
    ];

    const data = {
      organization_id: organization.id,
      court_name: plan.court,
      start_at: startAt,
      end_at: endAt,
      max_players: plan.maxPlayers,
      male_ratio: plan.maleRatio,
      note: plan.note ?? null,
      status: plan.status,
      created_by: owner.user_id,
      settled_at: settledAt,
      settled_by: settledAt ? owner.user_id : null,
      created_at: createdAt,
    };

    // Một tổ chức không được có hai trận giao giờ (BE ném MATCH_014). Tổ chức thật thường đã
    // có lịch riêng, nên seed phải NHƯỜNG: bỏ qua buổi đó, và xoá luôn bản seed cũ nếu lần
    // chạy trước đã kịp dựng ra một trận nay thành trùng giờ — seed không được để lại dữ liệu
    // mà chính app không cho tạo.
    if (plan.status !== 'canceled') {
      const conflict = await prisma.match.findFirst({
        where: {
          organization_id: organization.id,
          id: { not: id },
          status: { not: 'canceled' },
          start_at: { lt: endAt },
          end_at: { gt: startAt },
        },
        select: { court_name: true },
      });

      if (conflict) {
        await prisma.match.deleteMany({ where: { id } });
        summary.push(`  ${plan.court} — BỎ QUA vì trùng giờ với "${conflict.court_name}" đã có trong tổ chức`);
        continue;
      }
    }

    await prisma.match.upsert({ where: { id }, update: data, create: { id, ...data } });

    // Bảng con dựng lại từ đầu: chúng không có khoá nghiệp vụ để upsert theo, mà trận này là
    // trận của seed nên xoá sạch rồi ghi lại là an toàn.
    await prisma.matchCharge.deleteMany({ where: { match_id: id } });
    await prisma.matchExpense.deleteMany({ where: { match_id: id } });
    await prisma.matchVoteEvent.deleteMany({ where: { match_id: id } });
    await prisma.matchVote.deleteMany({ where: { match_id: id } });

    await prisma.matchVote.createMany({
      data: voters.map((voter, index) => ({
        match_id: id,
        user_id: voter.id,
        voted_at: new Date(createdAt.getTime() + index * 60 * 60 * 1000),
      })),
    });

    const events = voters.map((voter, index) => ({
      match_id: id,
      user_id: voter.id,
      action: 'join',
      created_at: new Date(createdAt.getTime() + index * 60 * 60 * 1000),
    }));
    if (plan.canceledBy) {
      const quitter = players.get(plan.canceledBy);
      if (quitter) {
        const quitAt = createdAt.getTime() + (voters.length + 1) * 60 * 60 * 1000;
        events.push(
          { match_id: id, user_id: quitter.id, action: 'join', created_at: new Date(quitAt) },
          {
            match_id: id,
            user_id: quitter.id,
            action: 'cancel',
            created_at: new Date(quitAt + 30 * 60 * 1000),
          },
        );
      }
    }
    await prisma.matchVoteEvent.createMany({ data: events });

    if (plan.status === 'settled' && plan.expenses) {
      await prisma.matchExpense.createMany({
        data: plan.expenses.map((expense, position) => ({
          match_id: id,
          name: expense.name,
          quantity: expense.quantity,
          unit_price: expense.unitPrice,
          position,
        })),
      });

      // Chia tiền bằng ĐÚNG hàm BE dùng (`splitExpenses`), không tự nhân chia lại ở đây: seed
      // mà lệch một nghìn so với app thì hoá ra lại là dữ liệu để tin sai.
      const split = splitExpenses({
        participants: voters.map((voter) => ({
          userId: voter.id,
          gender: voter.gender as 'male' | 'female' | 'other' | null,
        })),
        expenses: plan.expenses,
        maleRatio: Number(plan.maleRatio),
      });

      await prisma.matchCharge.createMany({
        data: split.charges.map((charge) => ({
          match_id: id,
          user_id: charge.userId,
          gender_at_settle: voters.find((voter) => voter.id === charge.userId)?.gender ?? null,
          ratio: charge.ratio.toFixed(2),
          amount: charge.amount,
          payment_status: 'unpaid',
        })),
      });

      summary.push(
        `  ${plan.court} — ĐÃ CHỐT, tổng ${split.total.toLocaleString('vi-VN')}đ, ${split.charges.length} người, dư ${split.surplus.toLocaleString('vi-VN')}đ`,
      );
      continue;
    }

    const when = startAt.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
    const state = plan.status === 'canceled' ? 'đã huỷ' : plan.dayOffset < 0 ? 'đã đá xong, CHƯA chốt tiền' : 'sắp tới';
    summary.push(`  ${plan.court} — ${when} — ${state}, ${voters.length}/${plan.maxPlayers} người`);
  }

  console.log(`Seed lịch vào tổ chức "${organization.name}" (${organization.id})`);
  console.log(`  ${PLAYERS.length} người chơi seed đã là thành viên (3 nữ, 3 nam)`);
  console.log(summary.join('\n'));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
