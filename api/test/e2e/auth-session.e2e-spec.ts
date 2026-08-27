import 'dotenv/config';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';
import {
  ACCESS_COOKIE_NAME,
  ONBOARDING_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
} from '../../src/auth/auth.constants';
import { AuthJwtService } from '../../src/auth/jwt.service';
import { RefreshTokenService } from '../../src/auth/refresh-token.service';
import { DatabaseService } from '../../src/database/database.service';
import { HttpExceptionFilter } from '../../src/common/exceptions/http-exception.filter';
import { ResponseInterceptor } from '../../src/common/interceptors/response.interceptor';

/**
 * Luồng phiên đăng nhập, tính từ SAU khi Google trả người dùng về (phần bắt tay với Google
 * cần chữ ký thật của họ nên không e2e được): khai onboarding, đọc /auth/me, xoay refresh
 * token, đăng xuất.
 *
 * Điểm đáng kiểm nhất là cookie `onb` — proxy của FE chỉ nhìn cookie này để quyết định ép
 * user về /onboarding hay cho vào app, nên nó phải xuất hiện và biến mất đúng lúc.
 */
let app: INestApplication<App>;
let db: DatabaseService;
let jwt: AuthJwtService;
let refreshTokens: RefreshTokenService;

const RUN_ID = `${Date.now()}`;
const createdUserIds: string[] = [];

/** Tạo user thật + cookie `at` của user đó. `onboarded` quyết định user đang ở bước nào. */
async function makeUser(name: string, onboarded: boolean) {
  const email = `e2e.${name}.${RUN_ID}@joytab.test`;
  const user = await db.user.create({
    data: {
      provider: 'google',
      provider_user_id: `e2e-${name}-${RUN_ID}`,
      email,
      full_name: onboarded ? `E2E ${name}` : null,
      onboarded,
    },
  });
  createdUserIds.push(user.id);
  return {
    id: user.id,
    email,
    cookie: `${ACCESS_COOKIE_NAME}=${await jwt.signAccessToken({ userId: user.id, email })}`,
  };
}

/** Đọc giá trị một cookie trong header set-cookie của response. */
function cookieValue(setCookie: string[] | undefined, name: string): string | null {
  const found = (setCookie ?? []).find((c) => c.startsWith(`${name}=`));
  return found ? found.slice(name.length + 1).split(';')[0] : null;
}

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideGuard(ThrottlerGuard)
    .useValue({ canActivate: () => true })
    .compile();
  app = moduleRef.createNestApplication({ logger: false });
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.init();

  db = app.get(DatabaseService);
  jwt = app.get(AuthJwtService);
  refreshTokens = app.get(RefreshTokenService);
});

afterAll(async () => {
  await db.refreshToken.deleteMany({ where: { user_id: { in: createdUserIds } } });
  await db.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await app.close();
});

describe('GET /auth/me', () => {
  it('không cookie → AUTH_001', async () => {
    const res = await request(app.getHttpServer()).get('/auth/me').expect(401);
    expect(res.body.code).toBe('AUTH_001');
  });

  it('token rác → AUTH_001, KHÔNG phải AUTH_005 (FE chỉ refresh khi thấy AUTH_005)', async () => {
    const res = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', `${ACCESS_COOKIE_NAME}=khong-phai-jwt`)
      .expect(401);
    expect(res.body.code).toBe('AUTH_001');
  });

  it('cookie hợp lệ → trả đúng user đang đăng nhập', async () => {
    const user = await makeUser('me', true);
    const res = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', user.cookie)
      .expect(200);
    expect(res.body.data.userId).toBe(user.id);
    expect(res.body.data.user.email).toBe(user.email);
    expect(res.body.data.user.onboarded).toBe(true);
  });
});

describe('POST /auth/onboarding — luồng khai thông tin lần đầu', () => {
  it('dữ liệu sai → 400 và user vẫn ở trạng thái chưa khai', async () => {
    const user = await makeUser('onboarding-invalid', false);
    await request(app.getHttpServer())
      .post('/auth/onboarding')
      .set('Cookie', user.cookie)
      .send({ fullName: 'A', age: 999, gender: 'khac', phone: '123' })
      .expect(400);

    const after = await db.user.findUnique({ where: { id: user.id } });
    expect(after?.onboarded).toBe(false);
  });

  it('khai đủ → onboarded=true, dữ liệu được chuẩn hoá, và cookie `onb` bị xoá', async () => {
    const user = await makeUser('onboarding-ok', false);
    const res = await request(app.getHttpServer())
      .post('/auth/onboarding')
      .set('Cookie', user.cookie)
      .send({ fullName: '  Nguyễn   Văn A  ', age: '30', gender: 'male', phone: '+84 912 345 678' })
      .expect(201);

    expect(res.body.data.user.onboarded).toBe(true);
    expect(res.body.data.user.fullName).toBe('Nguyễn Văn A');
    expect(res.body.data.user.age).toBe(30);
    expect(res.body.data.user.phone).toBe('0912345678');

    // Cookie `onb` phải bị xoá (set rỗng) — còn sót là proxy FE ép user quay lại /onboarding
    // mãi mãi dù đã khai xong.
    expect(cookieValue(res.headers['set-cookie'] as unknown as string[], ONBOARDING_COOKIE_NAME))
      .toBe('');
  });
});

describe('POST /auth/refresh — xoay refresh token', () => {
  it('không có rt → AUTH_006', async () => {
    const res = await request(app.getHttpServer()).post('/auth/refresh').expect(401);
    expect(res.body.code).toBe('AUTH_006');
  });

  it('rt hợp lệ → cấp at + rt MỚI, và rt cũ dùng lại thì chết', async () => {
    const user = await makeUser('refresh', true);
    const issued = await refreshTokens.issue(user.id);

    const res = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', `${REFRESH_COOKIE_NAME}=${issued.raw}`)
      .expect(201);

    const setCookie = res.headers['set-cookie'] as unknown as string[];
    const newRefresh = cookieValue(setCookie, REFRESH_COOKIE_NAME);
    expect(cookieValue(setCookie, ACCESS_COOKIE_NAME)).toBeTruthy();
    expect(newRefresh).toBeTruthy();
    expect(newRefresh).not.toBe(issued.raw);
    expect(res.body.data.userId).toBe(user.id);

    // Dùng lại token đã xoay = dấu hiệu token bị đánh cắp; phải từ chối.
    const reused = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', `${REFRESH_COOKIE_NAME}=${issued.raw}`)
      .expect(401);
    expect(reused.body.code).toBe('AUTH_006');
  });
});

describe('POST /auth/logout', () => {
  it('xoá cookie và thu hồi rt — rt đó không refresh lại được nữa', async () => {
    const user = await makeUser('logout', true);
    const issued = await refreshTokens.issue(user.id);

    const res = await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Cookie', `${user.cookie}; ${REFRESH_COOKIE_NAME}=${issued.raw}`)
      .expect(201);

    const setCookie = res.headers['set-cookie'] as unknown as string[];
    expect(cookieValue(setCookie, ACCESS_COOKIE_NAME)).toBe('');
    expect(cookieValue(setCookie, REFRESH_COOKIE_NAME)).toBe('');

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', `${REFRESH_COOKIE_NAME}=${issued.raw}`)
      .expect(401);
  });
});
