import 'dotenv/config';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';
import { AuthJwtService } from '../../src/auth/jwt.service';
import { DatabaseService } from '../../src/database/database.service';
import { HttpExceptionFilter } from '../../src/common/exceptions/http-exception.filter';
import { ResponseInterceptor } from '../../src/common/interceptors/response.interceptor';

/**
 * E2E luồng tổ chức: chạy trên Postgres THẬT (đúng DB mà .env đang trỏ tới), không mock DB —
 * phần dễ sai nhất của luồng này nằm ở ràng buộc unique và quyền, mock đi là mất chỗ đó.
 *
 * Dữ liệu tự tạo, tự dọn: user/tổ chức đều mang tiền tố `e2e.` + timestamp nên không đụng tới
 * user thật lẫn dữ liệu seed, và afterAll xoá sạch.
 *
 * ThrottlerGuard bị vô hiệu ở suite này để 20+ request liên tiếp không đâm vào giới hạn
 * 10 req/phút của các route ăn mã tham gia — chính giới hạn đó được kiểm riêng ở
 * organizations-throttle.e2e-spec.ts.
 */
let app: INestApplication<App>;
let db: DatabaseService;
let jwt: AuthJwtService;

const RUN_ID = `${Date.now()}`;
const users: Record<string, { id: string; email: string; cookie: string }> = {};

/** Tạo user thật trong DB rồi ký sẵn cookie `at` cho user đó. */
async function makeUser(name: string): Promise<void> {
  const email = `e2e.${name}.${RUN_ID}@joytab.test`;
  const user = await db.user.create({
    data: {
      provider: 'google',
      provider_user_id: `e2e-${name}-${RUN_ID}`,
      email,
      full_name: `E2E ${name}`,
      onboarded: true,
    },
  });
  const token = await jwt.signAccessToken({ userId: user.id, email });
  users[name] = { id: user.id, email, cookie: `at=${token}` };
}

const api = () => request(app.getHttpServer());
/** Gọi có đăng nhập. `as` là tên user đã tạo ở beforeAll. */
const asUser = (as: string) => ({ Cookie: users[as].cookie });

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideGuard(ThrottlerGuard)
    .useValue({ canActivate: () => true })
    .compile();

  app = moduleRef.createNestApplication({ logger: false });
  // Dựng đúng bộ global của main.ts — thiếu một cái là response/status trong test khác thật.
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.init();

  db = app.get(DatabaseService);
  jwt = app.get(AuthJwtService);
  await Promise.all([makeUser('owner'), makeUser('joiner'), makeUser('outsider')]);
});

afterAll(async () => {
  const ids = Object.values(users).map((u) => u.id);
  // Hai lớp chặn, vì đây là code XOÁ chạy trên DB dev:
  //  1. Danh sách rỗng thì không chạy gì cả. Prisma coi `in: undefined` là KHÔNG có điều
  //     kiện, tức là khớp toàn bộ bảng — một beforeAll hỏng nửa chừng đủ để biến dòng
  //     deleteMany này thành lệnh xoá sạch dữ liệu.
  //  2. Kèm điều kiện tên có tiền tố `E2E ` để dù userId có sai thì cũng chỉ đụng tới thứ
  //     do chính suite này tạo ra.
  if (ids.length > 0) {
    await db.organization.deleteMany({
      where: { created_by: { in: ids }, name: { startsWith: 'E2E ' } },
    });
    await db.user.deleteMany({ where: { id: { in: ids }, email: { endsWith: '@joytab.test' } } });
  }
  await app.close();
});

describe('Tổ chức — luồng đầy đủ từ tạo tới mời người vào', () => {
  let organizationId: string;
  let joinCode: string;

  it('chưa đăng nhập thì mọi route đều 401', async () => {
    await api().get('/organizations').expect(401);
    await api().post('/organizations').send({ name: 'Không ai cả' }).expect(401);
    await api().post('/organizations/join').send({ joinCode: 'ABCD1234' }).expect(401);
    await api().get('/organizations/by-code/ABCD1234').expect(401);
    await api()
      .patch('/organizations/00000000-0000-0000-0000-000000000001')
      .send({ joinByCodeEnabled: true })
      .expect(401);
  });

  it('user mới chưa thuộc tổ chức nào — mảng rỗng, không phải lỗi', async () => {
    const res = await api().get('/organizations').set(asUser('owner')).expect(200);
    expect(res.body.data.organizations).toEqual([]);
  });

  it('tên tổ chức quá ngắn → 400', async () => {
    await api().post('/organizations').set(asUser('owner')).send({ name: 'A' }).expect(400);
  });

  it('tạo tổ chức: người tạo là owner, và tổ chức ĐÃ MỞ kèm mã mời', async () => {
    const res = await api()
      .post('/organizations')
      .set(asUser('owner'))
      // khoảng trắng thừa để kiểm luôn phần chuẩn hoá tên
      .send({ name: `  E2E   Quỹ ${RUN_ID}  ` })
      .expect(201);

    const org = res.body.data.organization;
    expect(org.name).toBe(`E2E Quỹ ${RUN_ID}`);
    expect(org.role).toBe('owner');
    expect(org.memberCount).toBe(1);
    // Mở sẵn: việc đầu tiên sau khi lập nhóm là mời người vào, nên mã phải có ngay. Công tắc
    // suy ra TỪ mã chứ không phải một cột riêng, nên hai dòng này luôn đi cùng nhau.
    expect(org.joinByCodeEnabled).toBe(true);
    expect(org.joinCode).toMatch(/^[0-9A-HJKMNP-TV-Z]{8}$/);

    organizationId = org.id;
  });

  it('chỉ owner mở được cửa — member/người ngoài/id rác đều bị chặn', async () => {
    const outsider = await api()
      .patch(`/organizations/${organizationId}`)
      .set(asUser('outsider'))
      .send({ joinByCodeEnabled: true })
      .expect(404);
    // Người ngoài nhận "không tồn tại" chứ không phải 403: không xác nhận id đó có thật.
    expect(outsider.body.code).toBe('ORG_001');

    await api()
      .patch('/organizations/khong-phai-uuid')
      .set(asUser('owner'))
      .send({ joinByCodeEnabled: true })
      .expect(400);

    await api()
      .patch(`/organizations/${organizationId}`)
      .set(asUser('owner'))
      .send({ joinByCodeEnabled: 'yes' })
      .expect(400);

    const opened = await api()
      .patch(`/organizations/${organizationId}`)
      .set(asUser('owner'))
      .send({ joinByCodeEnabled: true })
      .expect(200);
    // Mở cửa là lúc mã được sinh ra.
    expect(opened.body.data.organization.joinByCodeEnabled).toBe(true);
    expect(opened.body.data.organization.joinCode).toMatch(/^[0-9A-HJKMNP-TV-Z]{8}$/);

    joinCode = opened.body.data.organization.joinCode;
  });

  it('cửa đã mở: xem trước thấy tên + số thành viên, chưa phải thành viên', async () => {
    const res = await api()
      .get(`/organizations/by-code/${joinCode}`)
      .set(asUser('joiner'))
      .expect(200);

    expect(res.body.data.organization).toEqual({
      name: `E2E Quỹ ${RUN_ID}`,
      memberCount: 1,
      alreadyMember: false,
    });
    // Xem trước KHÔNG được lộ id/mã: người xem chưa phải thành viên.
    expect(res.body.data.organization).not.toHaveProperty('id');
    expect(res.body.data.organization).not.toHaveProperty('joinCode');
  });

  it('mã viết thường + gạch nối vẫn vào đúng tổ chức đó', async () => {
    const messy = `${joinCode.slice(0, 4).toLowerCase()}-${joinCode.slice(4).toLowerCase()}`;
    const res = await api()
      .get(`/organizations/by-code/${messy}`)
      .set(asUser('joiner'))
      .expect(200);
    expect(res.body.data.organization.name).toBe(`E2E Quỹ ${RUN_ID}`);
  });

  it('tham gia bằng mã: vào với vai trò member, số thành viên tăng', async () => {
    const res = await api()
      .post('/organizations/join')
      .set(asUser('joiner'))
      .send({ joinCode })
      .expect(201);

    const org = res.body.data.organization;
    expect(org.role).toBe('member');
    expect(org.memberCount).toBe(2);
    // Member CŨNG thấy mã: mời bạn vào nhóm là việc ai trong nhóm cũng làm. Bật/tắt và xoay
    // mã thì vẫn chỉ owner làm được — kiểm ở test riêng bên dưới.
    expect(org.joinCode).toBe(joinCode);
  });

  it('vào lần hai → ORG_003, và xem trước báo đã là thành viên', async () => {
    const again = await api()
      .post('/organizations/join')
      .set(asUser('joiner'))
      .send({ joinCode })
      .expect(409);
    expect(again.body.code).toBe('ORG_003');

    const preview = await api()
      .get(`/organizations/by-code/${joinCode}`)
      .set(asUser('joiner'))
      .expect(200);
    expect(preview.body.data.organization.alreadyMember).toBe(true);
  });

  it('member ĐỌC được danh sách thành viên — xem nhóm gồm ai là việc của cả nhóm', async () => {
    const res = await api()
      .get(`/organizations/${organizationId}/members`)
      .set(asUser('joiner'))
      .expect(200);

    const members = res.body.data.members as { role: string; userId: string }[];
    expect(members).toHaveLength(2);
    // Owner xếp trước theo hợp đồng sắp xếp của BE.
    expect(members[0].role).toBe('owner');
    expect(members.some((member) => member.role === 'member')).toBe(true);
  });

  it('người NGOÀI tổ chức hỏi danh sách thành viên → ORG_001, không phải 403', async () => {
    const res = await api()
      .get(`/organizations/${organizationId}/members`)
      .set(asUser('outsider'))
      .expect(404);
    expect(res.body.code).toBe('ORG_001');
  });

  it('member không đổi được công tắc → ORG_004', async () => {
    const res = await api()
      .patch(`/organizations/${organizationId}`)
      .set(asUser('joiner'))
      .send({ joinByCodeEnabled: false })
      .expect(403);
    expect(res.body.code).toBe('ORG_004');
  });

  it('mặc định tắt, owner bật được cài đặt chủ tổ chức tự đánh dấu đã trả', async () => {
    const list = await api().get('/organizations').set(asUser('owner')).expect(200);
    const before = list.body.data.organizations.find(
      (org: { id: string }) => org.id === organizationId,
    );
    expect(before.skipOwnerPayment).toBe(false);

    const updated = await api()
      .patch(`/organizations/${organizationId}`)
      .set(asUser('owner'))
      .send({ skipOwnerPayment: true })
      .expect(200);
    expect(updated.body.data.organization.skipOwnerPayment).toBe(true);

    // Trả về trạng thái ban đầu — các test sau trong suite không nên bị ảnh hưởng.
    await api()
      .patch(`/organizations/${organizationId}`)
      .set(asUser('owner'))
      .send({ skipOwnerPayment: false })
      .expect(200);
  });

  it('owner đóng cửa: mã về null và chính mã đó lập tức hết dùng được', async () => {
    const closed = await api()
      .patch(`/organizations/${organizationId}`)
      .set(asUser('owner'))
      .send({ joinByCodeEnabled: false })
      .expect(200);
    expect(closed.body.data.organization.joinByCodeEnabled).toBe(false);
    expect(closed.body.data.organization.joinCode).toBeNull();

    const preview = await api()
      .get(`/organizations/by-code/${joinCode}`)
      .set(asUser('outsider'))
      .expect(404);
    expect(preview.body.code).toBe('ORG_002');

    const join = await api()
      .post('/organizations/join')
      .set(asUser('outsider'))
      .send({ joinCode })
      .expect(404);
    expect(join.body.code).toBe('ORG_002');
  });

  it('mở lại sinh mã KHÁC, và bật lại lần nữa cũng xoay ra mã khác', async () => {
    const reopened = await api()
      .patch(`/organizations/${organizationId}`)
      .set(asUser('owner'))
      .send({ joinByCodeEnabled: true })
      .expect(200);

    const newCode = reopened.body.data.organization.joinCode as string;
    expect(newCode).toMatch(/^[0-9A-HJKMNP-TV-Z]{8}$/);
    // Mã cũ không hồi sinh: mở lại là một mã hoàn toàn khác, nên mọi liên kết đã chia sẻ trước
    // khi đóng cửa đều chết vĩnh viễn. (Mã cũ hết dùng được đã kiểm ở test đóng cửa phía trên.)
    expect(newCode).not.toBe(joinCode);

    // Bật lại lần nữa trong lúc đang mở cũng xoay ra mã khác — đó là đường xoay mã của owner.
    const rotated = await api()
      .patch(`/organizations/${organizationId}`)
      .set(asUser('owner'))
      .send({ joinByCodeEnabled: true })
      .expect(200);
    expect(rotated.body.data.organization.joinCode).not.toBe(newCode);

    joinCode = rotated.body.data.organization.joinCode;
  });

  it('mã sai định dạng → 400; mã đúng định dạng nhưng không tồn tại → ORG_002', async () => {
    await api().get('/organizations/by-code/abc').set(asUser('outsider')).expect(400);

    // I/L/O là ký tự dễ đọc nhầm nên được chuẩn hoá thành 1/1/0 TRƯỚC khi validate: 'IIIIIIII'
    // thành '11111111' — đúng định dạng, chỉ là không có thật. Người đọc mã qua điện thoại
    // đọc nhầm chữ I thành số 1 thì vẫn tới đúng tổ chức, đó là chủ ý.
    const confusable = await api()
      .get('/organizations/by-code/IIIIIIII')
      .set(asUser('outsider'))
      .expect(404);
    expect(confusable.body.code).toBe('ORG_002');

    // U bị loại hẳn khỏi bảng chữ và không có luật chuẩn hoá → mới là mã sai định dạng.
    await api().get('/organizations/by-code/UUUUUUUU').set(asUser('outsider')).expect(400);

    const missing = await api()
      .get('/organizations/by-code/ZZZZZZZZ')
      .set(asUser('outsider'))
      .expect(404);
    expect(missing.body.code).toBe('ORG_002');
  });

  it('danh sách tổ chức phản ánh đúng hai góc nhìn owner và member', async () => {
    const ownerList = await api().get('/organizations').set(asUser('owner')).expect(200);
    const ownerOrg = ownerList.body.data.organizations.find(
      (o: { id: string }) => o.id === organizationId,
    );
    expect(ownerOrg.joinCode).toBe(joinCode);
    expect(ownerOrg.memberCount).toBe(2);

    const joinerList = await api().get('/organizations').set(asUser('joiner')).expect(200);
    const joinerOrg = joinerList.body.data.organizations.find(
      (o: { id: string }) => o.id === organizationId,
    );
    expect(joinerOrg.role).toBe('member');
    expect(joinerOrg.joinCode).toBe(joinCode);

    const outsiderList = await api().get('/organizations').set(asUser('outsider')).expect(200);
    expect(outsiderList.body.data.organizations).toEqual([]);
  });
});

/**
 * Bốn con số của trang chủ. Dựng dữ liệu thẳng bằng Prisma chứ không đi đường API: một buổi
 * "đã chốt tiền trong quá khứ" qua API là ba request (tạo ở tương lai → vote → dời về quá khứ →
 * chốt), mà ở đây thứ cần kiểm là phép cộng, không phải luồng chốt tiền.
 */
describe('Tổng quan tổ chức ở trang chủ', () => {
  let orgId: string;
  const HOUR = 60 * 60 * 1000;
  const DAY = 24 * HOUR;

  async function seedMatch(params: {
    startOffset: number;
    status: 'open' | 'settled' | 'canceled';
    votedBy?: 'owner' | 'joiner';
    charge?: { user: 'owner' | 'joiner'; amount: number; paymentStatus: 'unpaid' | 'paid' };
  }): Promise<string> {
    const startAt = new Date(Date.now() + params.startOffset);
    const match = await db.match.create({
      data: {
        organization_id: orgId,
        court_name: 'E2E Sân tổng quan',
        start_at: startAt,
        end_at: new Date(startAt.getTime() + 2 * HOUR),
        max_players: 4,
        male_ratio: 1,
        status: params.status,
        created_by: users.owner.id,
      },
    });
    if (params.votedBy) {
      await db.matchVote.create({ data: { match_id: match.id, user_id: users[params.votedBy].id } });
    }
    if (params.charge) {
      await db.matchCharge.create({
        data: {
          match_id: match.id,
          user_id: users[params.charge.user].id,
          ratio: 1,
          amount: params.charge.amount,
          payment_status: params.charge.paymentStatus,
        },
      });
    }
    return match.id;
  }

  const overview = (as: string) =>
    api().get(`/organizations/${orgId}/overview`).set(asUser(as));

  beforeAll(async () => {
    // Tổ chức riêng: các describe trên đã để lại tổ chức chung, mà ở đây phải đếm chính xác.
    const created = await api()
      .post('/organizations')
      .set(asUser('owner'))
      .send({ name: `E2E Tổng quan ${RUN_ID}` })
      .expect(201);
    orgId = created.body.data.organization.id;

    const opened = await api()
      .patch(`/organizations/${orgId}`)
      .set(asUser('owner'))
      .send({ joinByCodeEnabled: true })
      .expect(200);
    await api()
      .post('/organizations/join')
      .set(asUser('joiner'))
      .send({ joinCode: opened.body.data.organization.joinCode })
      .expect(201);

    // Hai buổi đã chốt của owner: một còn nợ 50k, một đã trả 30k.
    await seedMatch({
      startOffset: -10 * DAY,
      status: 'settled',
      votedBy: 'owner',
      charge: { user: 'owner', amount: 50_000, paymentStatus: 'unpaid' },
    });
    await seedMatch({
      startOffset: -9 * DAY,
      status: 'settled',
      votedBy: 'owner',
      charge: { user: 'owner', amount: 30_000, paymentStatus: 'paid' },
    });
    // Buổi đã chốt của người khác: không được cộng vào bất kỳ con số nào của owner.
    await seedMatch({
      startOffset: -8 * DAY,
      status: 'settled',
      votedBy: 'joiner',
      charge: { user: 'joiner', amount: 70_000, paymentStatus: 'unpaid' },
    });
    // Buổi đã huỷ: không phải buổi "đã chơi" dù owner từng đăng ký.
    await seedMatch({ startOffset: -7 * DAY, status: 'canceled', votedBy: 'owner' });
    // Hai buổi phía trước: một owner đã đăng ký, một chưa ai đăng ký.
    await seedMatch({ startOffset: 2 * DAY, status: 'open', votedBy: 'owner' });
    await seedMatch({ startOffset: 3 * DAY, status: 'open' });
    // Buổi `open` đã qua giờ: không phải sắp diễn ra, cũng chưa phải đã chơi (chưa chốt tiền).
    await seedMatch({ startOffset: -1 * DAY, status: 'open', votedBy: 'owner' });
  });

  it('cộng đúng tiền và đếm đúng trận của chính người hỏi', async () => {
    const response = await overview('owner').expect(200);
    expect(response.body.data.overview).toEqual({
      unpaidTotal: 50_000,
      unpaidCount: 1,
      paidTotal: 30_000,
      playedCount: 2,
      upcomingCount: 2,
    });
  });

  it('mỗi người thấy tiền của mình, nhưng cùng một số buổi sắp diễn ra', async () => {
    const response = await overview('joiner').expect(200);
    expect(response.body.data.overview).toMatchObject({
      unpaidTotal: 70_000,
      unpaidCount: 1,
      paidTotal: 0,
      playedCount: 1,
      // Buổi sắp tới là của cả tổ chức nên hai người thấy cùng con số, kể cả buổi chưa đăng ký.
      upcomingCount: 2,
    });
  });

  it('người ngoài không thấy tổ chức tồn tại, chưa đăng nhập thì 401', async () => {
    await overview('outsider').expect(404);
    await api().get(`/organizations/${orgId}/overview`).expect(401);
  });

  it('id không phải uuid bị chặn ở tầng validate', async () => {
    await api().get('/organizations/khong-phai-uuid/overview').set(asUser('owner')).expect(400);
  });
});
