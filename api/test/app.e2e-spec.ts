import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    process.env.GOOGLE_CLIENT_ID =
      process.env.GOOGLE_CLIENT_ID ?? 'test-client-id';
    process.env.GOOGLE_CLIENT_SECRET =
      process.env.GOOGLE_CLIENT_SECRET ?? 'test-client-secret';
    process.env.GOOGLE_CALLBACK_URL =
      process.env.GOOGLE_CALLBACK_URL ??
      'http://localhost:3000/auth/google/callback';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET) should return 404 when no route is defined', () => {
    return request(app.getHttpServer()).get('/').expect(404);
  });
});
