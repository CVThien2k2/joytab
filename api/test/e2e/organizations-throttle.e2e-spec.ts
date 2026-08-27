import 'dotenv/config';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';
import { AuthJwtService } from '../../src/auth/jwt.service';
import { DatabaseService } from '../../src/database/database.service';
import { HttpExceptionFilter } from '../../src/common/exceptions/http-exception.filter';
import { ResponseInterceptor } from '../../src/common/interceptors/response.interceptor';
import { JOIN_CODE_THROTTLE_LIMIT } from '../../src/organizations/organizations.constants';

/**
 * Suite này CỐ TÌNH không tắt ThrottlerGuard: hai route ăn mã tham gia là chỗ duy nhất trong
 * app trả lời được câu "mã này có thật không", nên giới hạn số lần thử là một phần của hành
 * vi đúng chứ không phải cấu hình phụ. Không có nó, mã 8 ký tự chỉ còn là bài toán thời gian.
 */
let app: INestApplication<App>;
let db: DatabaseService;
let cookie: string;
let userId: string;

const RUN_ID = `${Date.now()}`;

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication({ logger: false });
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.init();

  db = app.get(DatabaseService);
  const email = `e2e.throttle.${RUN_ID}@joytab.test`;
  const user = await db.user.create({
    data: {
      provider: 'google',
      provider_user_id: `e2e-throttle-${RUN_ID}`,
      email,
      onboarded: true,
    },
  });
  userId = user.id;
  cookie = `at=${await app.get(AuthJwtService).signAccessToken({ userId: user.id, email })}`;
});

afterAll(async () => {
  // `userId` chưa gán (beforeAll hỏng) thì Prisma hiểu `id: undefined` là không lọc gì —
  // xoá sạch bảng users. Kiểm tra trước khi xoá.
  if (userId) {
    await db.user.deleteMany({ where: { id: userId, email: { endsWith: '@joytab.test' } } });
  }
  await app.close();
});

describe('Giới hạn số lần thử mã tham gia', () => {
  it(`quá ${JOIN_CODE_THROTTLE_LIMIT} lần dò mã trong một phút thì bị chặn`, async () => {
    const statuses: number[] = [];
    for (let attempt = 0; attempt < JOIN_CODE_THROTTLE_LIMIT + 2; attempt++) {
      // Mã hợp lệ về định dạng nhưng không tồn tại — đúng thứ một kẻ dò mã sẽ gửi.
      const code = `ZZZZZZ${attempt.toString().padStart(2, '0')}`.slice(0, 8);
      const res = await request(app.getHttpServer())
        .get(`/organizations/by-code/${code}`)
        .set('Cookie', cookie);
      statuses.push(res.status);
    }

    expect(statuses.slice(0, JOIN_CODE_THROTTLE_LIMIT).every((s) => s === 404)).toBe(true);
    expect(statuses.slice(JOIN_CODE_THROTTLE_LIMIT)).toEqual([429, 429]);
  });

  it('route khác không bị vạ lây khi mã đã bị chặn', async () => {
    await request(app.getHttpServer()).get('/organizations').set('Cookie', cookie).expect(200);
  });
});
