import 'dotenv/config';
import { createHash } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { buildPostgresUrl } from '../src/common/utils/database-url';
import { PrismaClient } from '../src/generated/prisma/client';
import { splitExpenses } from '../src/matches/matches.utils';

/**
 * Seed lịch thi đấu cho môi trường dev: người chơi, trận đã đá, trận sắp tới, trận đã chốt chi
 * phí, và trận đã trả tiền xong — đủ để mọi khối trên UI có số liệu thật để vẽ.
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
 * Cờ `--reset` dọn sạch tổ chức TRƯỚC khi seed: mọi trận (kèm vote, chi phí, tiền từng người
 * theo cascade), mọi lần thanh toán, và thành viên seed. Có cờ vì lịch bạn tự bấm tay trên UI
 * lẫn vào lịch seed thì các trạng thái không còn đúng như mô tả bên dưới nữa — nhưng phải GÕ
 * RA mới xoá, chạy seed thường không được nuốt dữ liệu của ai.
 *
 * Chạy: `pnpm --filter api db:seed:matches [--reset] [tên hoặc id tổ chức]`
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

/**
 * Khung giờ của một trận seed. Hai cách, chọn MỘT:
 *
 *  - `dayOffset` + `startHour` + `hours`: giờ TRÒN của một ngày lệch so với hôm nay. Dùng cho
 *    phần lịch ổn định (đã đá xong, tuần sau) — chạy lúc nào cũng ra đúng khung giờ người ta
 *    hay đặt sân, nên nhìn vào lịch thấy tự nhiên.
 *  - `minutesFromNow` + `minutes`: lệch bao nhiêu PHÚT so với lúc chạy script. Bắt buộc cho
 *    những trạng thái chỉ tồn tại quanh "bây giờ" — đang diễn ra, hay còn dưới 2 tiếng là tới
 *    giờ nên không huỷ đăng ký được nữa. Giờ tròn không dựng được chúng: "bây giờ" là mốc di
 *    động, mà 19h thì chỉ đúng một lần mỗi ngày.
 *
 * Hai nhánh loại trừ nhau bằng `?: never` để gõ lẫn cả hai là lỗi biên dịch, không phải một
 * trường bị lặng lẽ bỏ qua.
 */
type MatchSchedule =
  | { dayOffset: number; startHour: number; hours: number; minutesFromNow?: never; minutes?: never }
  | { minutesFromNow: number; minutes: number; dayOffset?: never; startHour?: never; hours?: never };

type MatchPlan = MatchSchedule & {
  /** Khoá sinh id. Đổi khoá là ra một trận khác, đừng đổi khi chỉ muốn sửa nội dung. */
  key: string;
  court: string;
  /** Địa chỉ sân — thẻ trong danh sách hiện nó dưới tên sân. */
  address: string;
  maxPlayers: number;
  maleRatio: string;
  note?: string;
  players: PlayerHandle[];
  realVoters: RealVoters;
  status: 'open' | 'settled' | 'canceled';
  /** Chỉ dùng khi `status = 'settled'`. Đơn giá, đơn vị đồng. */
  expenses?: { name: string; quantity: number; unitPrice: number }[];
  /**
   * Chỉ dùng khi `status = 'settled'`: mọi người ĐÃ trả tiền buổi này.
   *
   * Cần có ít nhất một buổi như vậy thì ô "Đã thanh toán" ở trang chủ mới khác 0, và trang
   * Lịch sử mới có cả hai nhãn "Đã trả" / "Chưa trả" để nhìn ra khác biệt.
   */
  paid?: boolean;
  /** Một người đã đăng ký rồi rút — chỉ để lịch sử đăng ký có gì mà xem. */
  canceledBy?: PlayerHandle;
};

/**
 * Lịch seed, xếp theo trục thời gian. Mỗi trận có một việc để thử — gộp lại thì mọi trạng thái
 * mà UI vẽ ra đều có ít nhất một dòng dữ liệu thật:
 *
 *  - đã chốt + ĐÃ TRẢ (2 trận): nguồn của ô "Đã thanh toán" ở trang chủ, và của nhãn "Đã trả"
 *    ở Lịch sử đấu.
 *  - đã chốt + CHƯA trả (1 trận): nguồn của ô "Cần thanh toán" và của nút trả tiền.
 *  - đã đá + chưa chốt (3 trận): chỗ bấm "Chốt chi phí".
 *  - sắp tới (4 trận): mình đã đăng ký (viền xanh) / đủ chỗ (viền xám) / còn chỗ (không viền
 *    màu) / chưa ai đăng ký (vòng "?" trong cụm avatar) — đúng bốn trạng thái của thẻ.
 *  - đã huỷ (1 trận): không hiện ở buổi sắp tới, và có mặt trong Lịch sử đấu.
 *  - quanh GIỜ HIỆN TẠI (3 trận, `minutesFromNow`): đang diễn ra / đã đăng ký mà lọt vào cửa
 *    khoá 2 tiếng / đã đăng ký trên một trận đã đủ người. Ba trạng thái này là hàm của thời
 *    gian nên chúng HẾT HẠN: sau khoảng 6 tiếng cả ba đã trôi vào quá khứ, muốn xem lại thì
 *    chạy seed lần nữa.
 */
const MATCH_PLANS: MatchPlan[] = [
  {
    key: 'settled-1',
    dayOffset: -14,
    startHour: 19,
    hours: 2,
    court: 'Sân Cầu Vồng',
    address: '18 Trần Thái Tông, Cầu Giấy, Hà Nội',
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
    key: 'settled-paid',
    dayOffset: -28,
    startHour: 19,
    hours: 2,
    court: 'Sân Thanh Xuân',
    address: '45 Nguyễn Trãi, Thanh Xuân, Hà Nội',
    maxPlayers: 8,
    maleRatio: '1.20',
    note: 'Đã chốt và ĐÃ TRẢ hết — nguồn của ô "Đã thanh toán" ở trang chủ.',
    players: ['lan', 'yen', 'huy', 'long'],
    realVoters: 'first',
    status: 'settled',
    paid: true,
    expenses: [
      { name: 'Thuê sân', quantity: 2, unitPrice: 130_000 },
      { name: 'Cầu', quantity: 4, unitPrice: 28_000 },
    ],
  },
  {
    key: 'settled-paid-2',
    dayOffset: -21,
    startHour: 20,
    hours: 2,
    court: 'Sân Trung Kính',
    address: '92 Trung Kính, Cầu Giấy, Hà Nội',
    maxPlayers: 10,
    maleRatio: '1.00',
    note: 'Đã chốt và đã trả — buổi thứ hai để lịch sử không chỉ có một dòng "Đã trả".',
    players: ['mai', 'kiet', 'long'],
    realVoters: 'first',
    status: 'settled',
    paid: true,
    expenses: [
      { name: 'Thuê sân', quantity: 2, unitPrice: 110_000 },
      { name: 'Nước', quantity: 6, unitPrice: 12_000 },
    ],
  },
  {
    key: 'past-open-1',
    dayOffset: -9,
    startHour: 19,
    hours: 2,
    court: 'Sân Bách Khoa',
    address: '1 Đại Cồ Việt, Hai Bà Trưng, Hà Nội',
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
    address: '45 Nguyễn Trãi, Thanh Xuân, Hà Nội',
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
    address: 'Khu LHTT Mỹ Đình, Nam Từ Liêm, Hà Nội',
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
    address: '18 Trần Thái Tông, Cầu Giấy, Hà Nội',
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
    address: '92 Trung Kính, Cầu Giấy, Hà Nội',
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
    address: '1 Đại Cồ Việt, Hai Bà Trưng, Hà Nội',
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
    address: '12 Quang Trung, Hà Đông, Hà Nội',
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
    address: 'Khu LHTT Mỹ Đình, Nam Từ Liêm, Hà Nội',
    maxPlayers: 10,
    maleRatio: '1.00',
    note: 'Đã huỷ — không hiện ở buổi sắp tới, chỉ tra được ở Lịch sử đấu.',
    players: ['lan', 'mai'],
    realVoters: 'first',
    status: 'canceled',
  },

  // Ba trận dưới đây neo vào GIỜ CHẠY SCRIPT, xếp NỐI TIẾP nhau (kết thúc trận trước rồi mới
  // tới trận sau): một tổ chức không được có hai trận giao giờ (MATCH_014), nên không thể dựng
  // hai trận "đang diễn ra" cùng lúc để so sánh.
  {
    key: 'now-ongoing',
    minutesFromNow: -60,
    minutes: 100,
    court: 'Sân Cầu Giấy',
    address: '2 Phạm Văn Bạch, Cầu Giấy, Hà Nội',
    maxPlayers: 8,
    maleRatio: '1.20',
    note: 'ĐANG diễn ra và bạn có tên trong đó: nhãn "Đang diễn ra", nút "Đã tham gia" mờ.',
    players: ['lan', 'mai', 'huy', 'kiet'],
    realVoters: 'first',
    status: 'open',
  },
  {
    key: 'now-cancel-locked',
    minutesFromNow: 60,
    minutes: 120,
    court: 'Sân Nghĩa Tân',
    address: '15 Nguyễn Phong Sắc, Cầu Giấy, Hà Nội',
    maxPlayers: 10,
    maleRatio: '1.20',
    // Đúng một tiếng nữa là tới giờ, tức nằm trong `MATCH_CANCEL_LOCK_HOURS` = 2: đã đăng ký
    // nhưng không rút ra được nữa. Khác trận trên ở chỗ trận này CHƯA bắt đầu, nên trang chi
    // tiết nói "còn dưới 2 tiếng" thay vì "đang diễn ra" — hai câu cho hai lý do khác nhau.
    note: 'Còn 1 tiếng là tới giờ: đã đăng ký nhưng KHÔNG huỷ được nữa (cửa khoá 2 tiếng).',
    players: ['yen', 'long'],
    realVoters: 'first',
    status: 'open',
  },
  {
    key: 'now-full-joined',
    minutesFromNow: 240,
    minutes: 120,
    court: 'Sân Kim Mã',
    address: '108 Kim Mã, Ba Đình, Hà Nội',
    // 5 người seed + chính bạn = 6, bằng `maxPlayers`: trận đã ĐỦ mà bạn có tên trong đó, nên
    // thẻ phải hiện viền xanh + "Huỷ đăng ký" chứ không phải "Đã đủ chỗ" — "đã đăng ký" thắng
    // "hết chỗ", và 6 người thì cụm avatar cũng hiện "+1" vì thẻ chỉ vẽ 5 mặt.
    maxPlayers: 6,
    maleRatio: '1.00',
    note: 'Đã ĐỦ người mà bạn có tên: viền xanh + "Huỷ đăng ký", không phải "Đã đủ chỗ".',
    players: ['lan', 'mai', 'yen', 'huy', 'long'],
    realVoters: 'first',
    status: 'open',
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

/**
 * Input: một plan + mốc "bây giờ" của lần chạy này.
 * Output: Hai đầu khung giờ của trận.
 *
 *         Nhận `now` từ ngoài chứ không tự gọi `new Date()`: mọi trận trong một lần chạy phải
 *         đo từ CÙNG một mốc, không thì trận cuối lệch vài giây so với trận đầu và hai trận
 *         xếp sát nhau có thể hoá ra giao giờ.
 *
 *         Cắt giây và mili giây về 0 ở nhánh `minutesFromNow`: khung giờ 11:47:00 đọc được,
 *         còn 11:47:23.481 thì chỉ là tiếng ồn trong log và trên UI.
 */
function resolveSchedule(plan: MatchPlan, now: Date): { startAt: Date; endAt: Date } {
  if (plan.minutesFromNow !== undefined) {
    const startAt = new Date(now.getTime() + plan.minutesFromNow * 60_000);
    startAt.setSeconds(0, 0);
    return { startAt, endAt: new Date(startAt.getTime() + plan.minutes * 60_000) };
  }

  const startAt = atLocalHour(plan.dayOffset, plan.startHour);
  return { startAt, endAt: new Date(startAt.getTime() + plan.hours * 60 * 60 * 1000) };
}

/**
 * Input: id tổ chức.
 * Output: Vài dòng kể lại đã xoá những gì.
 *
 *         Dọn TRẮNG phần lịch của một tổ chức: trận, và theo cascade của khoá ngoại là vote,
 *         lịch sử vote, dòng chi phí, tiền từng người. Thanh toán phải xoá riêng vì nó treo
 *         vào tổ chức chứ không vào trận.
 *
 *         Thành viên: chỉ user seed (`provider_user_id` bắt đầu bằng `seed-`). Người thật ở
 *         lại — xoá owner thì tổ chức không còn ai tạo trận, mà xoá người thật khác thì lần
 *         sau đăng nhập họ thấy mình bị đá khỏi tổ chức, một chuyện seed không có quyền làm.
 *
 *         Bản thân user seed KHÔNG bị xoá, chỉ rời tổ chức: `upsertSeedUser` dùng lại đúng
 *         những row đó ngay bên dưới, và họ còn có thể đang là thành viên tổ chức khác.
 */
async function resetOrganizationData(organizationId: string): Promise<string[]> {
  const matches = await prisma.match.deleteMany({ where: { organization_id: organizationId } });
  const payments = await prisma.payment.deleteMany({ where: { organization_id: organizationId } });
  const members = await prisma.organizationMember.deleteMany({
    where: {
      organization_id: organizationId,
      user: { provider_user_id: { startsWith: 'seed-' } },
    },
  });

  return [
    `  đã xoá ${matches.count} trận (kèm vote / chi phí / tiền từng người theo cascade)`,
    `  đã xoá ${payments.count} lần thanh toán`,
    `  đã cho ${members.count} thành viên seed rời tổ chức (người thật giữ nguyên)`,
  ];
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  // Tên tổ chức có thể chứa dấu cách nhưng không bắt đầu bằng `--`, nên tách cờ theo tiền tố
  // là đủ; không cần một thư viện parse tham số cho đúng một cờ.
  const organization = await resolveOrganization(args.find((arg) => !arg.startsWith('--')));
  const resetLog = args.includes('--reset') ? await resetOrganizationData(organization.id) : [];

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
  // Một mốc "bây giờ" cho cả lần chạy — xem `resolveSchedule`.
  const now = new Date();

  for (const plan of MATCH_PLANS) {
    const id = seedUuid(`match:${organization.id}:${plan.key}`);
    const { startAt, endAt } = resolveSchedule(plan, now);
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
      address: plan.address,
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
          payment_status: plan.paid ? 'paid' : 'unpaid',
        })),
      });

      // Buổi "đã trả": mỗi người một lần chuyển khoản riêng, đúng như app tạo ra (một payment
      // gom các khoản của MỘT người). Không có row payments thì các khoản vẫn hiện "Đã trả"
      // nhưng không có chứng từ nào đứng sau — dữ liệu seed mà tự mâu thuẫn thì tệ hơn không có.
      if (plan.paid) {
        await prisma.payment.deleteMany({ where: { id: { in: split.charges.map((charge) => seedUuid(`payment:${id}:${charge.userId}`)) } } });
        for (const charge of split.charges) {
          const paymentId = seedUuid(`payment:${id}:${charge.userId}`);
          await prisma.payment.create({
            data: {
              id: paymentId,
              organization_id: organization.id,
              user_id: charge.userId,
              proof_url: 'https://placehold.co/600x800/png?text=Chuyen+khoan',
              note: `Chuyển khoản buổi ${plan.court}`,
              submitted_at: new Date(endAt.getTime() + 2 * 60 * 60 * 1000),
            },
          });
          await prisma.matchCharge.updateMany({
            where: { match_id: id, user_id: charge.userId },
            data: { payment_id: paymentId },
          });
        }
      }

      summary.push(
        `  ${plan.court} — ĐÃ CHỐT${plan.paid ? ' + ĐÃ TRẢ' : ''}, tổng ${split.total.toLocaleString('vi-VN')}đ, ${split.charges.length} người, dư ${split.surplus.toLocaleString('vi-VN')}đ`,
      );
      continue;
    }

    const when = startAt.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
    // Trạng thái đọc từ hai mốc giờ chứ không từ `dayOffset`: các plan neo vào "bây giờ" không
    // có trường đó, và "đang diễn ra" thì chỉ so giờ mới biết.
    const state =
      plan.status === 'canceled'
        ? 'đã huỷ'
        : endAt <= now
          ? 'đã đá xong, CHƯA chốt tiền'
          : startAt <= now
            ? 'ĐANG diễn ra'
            : 'sắp tới';
    summary.push(`  ${plan.court} — ${when} — ${state}, ${voters.length}/${plan.maxPlayers} người`);
  }

  console.log(`Seed lịch vào tổ chức "${organization.name}" (${organization.id})`);
  if (resetLog.length > 0) console.log(resetLog.join('\n'));
  console.log(`  ${PLAYERS.length} người chơi seed đã là thành viên (3 nữ, 3 nam)`);
  console.log(summary.join('\n'));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
