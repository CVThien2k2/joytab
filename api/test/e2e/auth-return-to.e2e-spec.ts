import 'dotenv/config';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';
import { HttpExceptionFilter } from '../../src/common/exceptions/http-exception.filter';
import { ResponseInterceptor } from '../../src/common/interceptors/response.interceptor';

/**
 * Luồng "bấm link mời khi chưa đăng nhập": FE gửi `returnTo` sang /auth/google, BE nhét vào
 * `state` của OAuth, Google trả lại nguyên xi ở callback rồi BE mới redirect về đó.
 *
 * Nửa sau (callback) không e2e được vì cần Google thật ký `code`; phần lọc giá trị — chỗ dễ
 * thành open-redirect nhất — nằm ở unit test test/unit/auth/redirect.spec.ts. Suite này kiểm
 * nửa đầu trên HTTP thật: giá trị nào được mang đi, giá trị nào bị bỏ lại.
 */
let app: INestApplication<App>;

/** Đọc `state` trong URL Google mà BE redirect tới. */
function stateOf(location: string): string | null {
  return new URL(location).searchParams.get('state');
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
});

afterAll(async () => {
  await app.close();
});

describe('GET /auth/google — mang đích quay lại qua OAuth', () => {
  it('không có returnTo → vẫn sang Google, không có state', async () => {
    const res = await request(app.getHttpServer()).get('/auth/google').expect(302);
    expect(res.headers.location).toContain('accounts.google.com');
    expect(stateOf(res.headers.location)).toBeNull();
  });

  it('link mời → đi theo đúng trong state', async () => {
    const res = await request(app.getHttpServer())
      .get('/auth/google')
      .query({ returnTo: '/join/ABCD1234' })
      .expect(302);
    expect(stateOf(res.headers.location)).toBe('/join/ABCD1234');
  });

  it('prompt=select_account đi kèm returnTo, hai thứ không đá nhau', async () => {
    const res = await request(app.getHttpServer())
      .get('/auth/google')
      .query({ prompt: 'select_account', returnTo: '/join/ABCD1234' })
      .expect(302);
    const url = new URL(res.headers.location);
    expect(url.searchParams.get('prompt')).toBe('select_account');
    expect(url.searchParams.get('state')).toBe('/join/ABCD1234');
  });

  it.each([
    ['//evil.com/steal', 'host khác núp dưới dạng path'],
    ['https://evil.com', 'URL tuyệt đối'],
    ['/a://evil.com', 'có "://" ở giữa'],
    ['javascript:alert(1)', 'scheme thực thi mã'],
    ['join/ABCD1234', 'thiếu / ở đầu'],
  ])('bỏ đích không an toàn: %s (%s)', async (returnTo) => {
    const res = await request(app.getHttpServer())
      .get('/auth/google')
      .query({ returnTo })
      .expect(302);
    // Vẫn cho đăng nhập bình thường, chỉ là quên đích đi — sau khi login sẽ về `/`.
    expect(res.headers.location).toContain('accounts.google.com');
    expect(stateOf(res.headers.location)).toBeNull();
  });
});
