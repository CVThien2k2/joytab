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

  it('tạo tổ chức: người tạo là owner, và tổ chức ĐANG KÍN (chưa có mã)', async () => {
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
    // Mã tồn tại đồng nghĩa cửa đang mở, nên tổ chức mới tạo KHÔNG có mã.
    expect(org.joinByCodeEnabled).toBe(false);
    expect(org.joinCode).toBeNull();

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

  it('member không đổi được công tắc → ORG_004', async () => {
    const res = await api()
      .patch(`/organizations/${organizationId}`)
      .set(asUser('joiner'))
      .send({ joinByCodeEnabled: false })
      .expect(403);
    expect(res.body.code).toBe('ORG_004');
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
