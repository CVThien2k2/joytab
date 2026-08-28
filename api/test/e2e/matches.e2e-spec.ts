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
 * E2E luồng lịch thi đấu → chốt chi phí → thanh toán. Chạy trên Postgres THẬT: phần dễ sai
 * nhất nằm ở transaction, khoá hàng và luật thời gian — mock DB đi là mất đúng chỗ đó.
 *
 * Dữ liệu tự tạo tự dọn, mọi thứ mang tiền tố `E2E ` + timestamp.
 */
let app: INestApplication<App>;
let db: DatabaseService;
let jwt: AuthJwtService;

const RUN_ID = `${Date.now()}`;
const users: Record<string, { id: string; cookie: string }> = {};

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** Mốc thời gian tương đối so với bây giờ, dạng ISO — mọi trận trong suite đều dựng từ đây. */
const at = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();

async function makeUser(name: string, gender: 'male' | 'female'): Promise<void> {
  const user = await db.user.create({
    data: {
      provider: 'google',
      provider_user_id: `e2e-match-${name}-${RUN_ID}`,
      email: `e2e.match.${name}.${RUN_ID}@joytab.test`,
      full_name: `E2E ${name}`,
      gender,
      onboarded: true,
    },
  });
  const token = await jwt.signAccessToken({ userId: user.id, email: user.email });
  users[name] = { id: user.id, cookie: `at=${token}` };
}

const api = () => request(app.getHttpServer());
const asUser = (as: string) => ({ Cookie: users[as].cookie });

let organizationId: string;

/** Tạo trận qua API, trả id. Dùng nhiều lần nên gom lại cho khỏi lặp body. */
async function createMatch(params: {
  startOffset: number;
  endOffset: number;
  maxPlayers?: number;
  courtName?: string;
}): Promise<string> {
  const response = await api()
    .post(`/organizations/${organizationId}/matches`)
    .set(asUser('owner'))
    .send({
      courtName: params.courtName ?? 'E2E Sân 1',
      startAt: at(params.startOffset),
      endAt: at(params.endOffset),
      maxPlayers: params.maxPlayers ?? 4,
    })
    .expect(201);
  return response.body.data.match.id as string;
}

/** Dời một trận về quá khứ để chốt chi phí được — API cho phép sửa sang quá khứ (nhập bù). */
async function moveToPast(matchId: string): Promise<void> {
  await api()
    .patch(`/matches/${matchId}`)
    .set(asUser('owner'))
    .send({ startAt: at(-3 * HOUR), endAt: at(-1 * HOUR) })
    .expect(200);
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
  await makeUser('owner', 'male');
  await makeUser('mate', 'female');
  await makeUser('third', 'male');
  await makeUser('outsider', 'male');

  const created = await api()
    .post('/organizations')
    .set(asUser('owner'))
    .send({ name: `E2E Matches ${RUN_ID}` })
    .expect(201);
  organizationId = created.body.data.organization.id;

  // Mở cửa rồi cho `mate` vào — cần hai người thật để có gì mà chia tiền.
  const opened = await api()
    .patch(`/organizations/${organizationId}`)
    .set(asUser('owner'))
    .send({ joinByCodeEnabled: true })
    .expect(200);
  const joinCode = opened.body.data.organization.joinCode;
  for (const name of ['mate', 'third']) {
    await api().post('/organizations/join').set(asUser(name)).send({ joinCode }).expect(201);
  }
});

afterAll(async () => {
  const ids = Object.values(users).map((user) => user.id);
  if (ids.length > 0) {
    // Xoá tổ chức là cascade sạch matches/votes/charges/payments — không xoá tay từng bảng.
    await db.organization.deleteMany({
      where: { created_by: { in: ids }, name: { startsWith: 'E2E Matches ' } },
    });
    await db.user.deleteMany({ where: { id: { in: ids }, full_name: { startsWith: 'E2E ' } } });
  }
  await app.close();
});

describe('Tạo lịch thi đấu', () => {
  it('owner tạo được, member thì không', async () => {
    const matchId = await createMatch({ startOffset: 3 * DAY, endOffset: 3 * DAY + 2 * HOUR });
    expect(matchId).toBeTruthy();

    await api()
      .post(`/organizations/${organizationId}/matches`)
      .set(asUser('mate'))
      .send({
        courtName: 'E2E Sân lén',
        startAt: at(3 * DAY),
        endAt: at(3 * DAY + HOUR),
        maxPlayers: 4,
      })
      .expect(403);
  });

  it('người ngoài tổ chức không thấy tổ chức tồn tại', async () => {
    await api().get(`/organizations/${organizationId}/matches`).set(asUser('outsider')).expect(404);
  });

  it('giờ kết thúc trước giờ bắt đầu bị chặn', async () => {
    const response = await api()
      .post(`/organizations/${organizationId}/matches`)
      .set(asUser('owner'))
      .send({
        courtName: 'E2E Sân ngược',
        startAt: at(2 * DAY + 2 * HOUR),
        endAt: at(2 * DAY),
        maxPlayers: 4,
      })
      .expect(400);
    expect(response.body.code).toBe('MATCH_002');
  });

  it('tạo trận ở quá khứ bị chặn', async () => {
    const response = await api()
      .post(`/organizations/${organizationId}/matches`)
      .set(asUser('owner'))
      .send({
        courtName: 'E2E Sân hôm qua',
        startAt: at(-2 * DAY),
        endAt: at(-2 * DAY + HOUR),
        maxPlayers: 4,
      })
      .expect(400);
    expect(response.body.code).toBe('MATCH_002');
  });
});

describe('Vote', () => {
  let matchId: string;

  beforeAll(async () => {
    matchId = await createMatch({ startOffset: 10 * DAY, endOffset: 10 * DAY + 2 * HOUR });
  });

  it('vote rồi thì thấy mình trong danh sách', async () => {
    await api().post(`/matches/${matchId}/vote`).set(asUser('mate')).expect(201);

    const response = await api().get(`/matches/${matchId}`).set(asUser('mate')).expect(200);
    const match = response.body.data.match;
    expect(match.voted).toBe(true);
    expect(match.playerCount).toBe(1);
    expect(match.participants).toHaveLength(1);
    expect(match.canCancelVote).toBe(true);
    expect(match.voteClosedReason).toBeNull();
  });

  it('vote hai lần bị chặn', async () => {
    const response = await api().post(`/matches/${matchId}/vote`).set(asUser('mate')).expect(409);
    expect(response.body.code).toBe('MATCH_007');
  });

  it('trận khác trùng giờ thì không vote được — kể cả ở tổ chức khác', async () => {
    const overlapping = await createMatch({
      startOffset: 10 * DAY + HOUR,
      endOffset: 10 * DAY + 3 * HOUR,
      courtName: 'E2E Sân trùng giờ',
    });

    const response = await api().post(`/matches/${overlapping}/vote`).set(asUser('mate')).expect(409);
    expect(response.body.code).toBe('MATCH_006');
  });

  it('sát nhau nhưng không giao nhau thì vote được', async () => {
    const adjacent = await createMatch({
      startOffset: 10 * DAY + 2 * HOUR,
      endOffset: 10 * DAY + 4 * HOUR,
      courtName: 'E2E Sân kế tiếp',
    });

    await api().post(`/matches/${adjacent}/vote`).set(asUser('mate')).expect(201);
  });

  it('đủ người thì đóng vote', async () => {
    const small = await createMatch({
      startOffset: 20 * DAY,
      endOffset: 20 * DAY + 2 * HOUR,
      maxPlayers: 2,
      courtName: 'E2E Sân nhỏ',
    });
    await api().post(`/matches/${small}/vote`).set(asUser('owner')).expect(201);
    await api().post(`/matches/${small}/vote`).set(asUser('mate')).expect(201);

    const detail = await api().get(`/matches/${small}`).set(asUser('owner')).expect(200);
    expect(detail.body.data.match.voteClosedReason).toBe('full');

    const response = await api().post(`/matches/${small}/vote`).set(asUser('third')).expect(409);
    expect(response.body.code).toBe('MATCH_004');
  });

  it('không hạ trần xuống dưới số người đã đăng ký', async () => {
    const match = await createMatch({
      startOffset: 21 * DAY,
      endOffset: 21 * DAY + 2 * HOUR,
      maxPlayers: 4,
      courtName: 'E2E Sân hạ trần',
    });
    await api().post(`/matches/${match}/vote`).set(asUser('owner')).expect(201);
    await api().post(`/matches/${match}/vote`).set(asUser('mate')).expect(201);
    await api().post(`/matches/${match}/vote`).set(asUser('third')).expect(201);

    const response = await api().patch(`/matches/${match}`).set(asUser('owner')).send({ maxPlayers: 2 }).expect(409);
    expect(response.body.code).toBe('MATCH_004');
  });

  it('huỷ vote được khi còn xa, và ghi lại lịch sử', async () => {
    await api().delete(`/matches/${matchId}/vote`).set(asUser('mate')).expect(200);

    const history = await api().get(`/matches/${matchId}/history`).set(asUser('mate')).expect(200);
    const events = history.body.data.events;
    // Mới nhất trước: huỷ rồi mới tới lần vote đầu.
    expect(events[0].action).toBe('cancel');
    expect(events[1].action).toBe('join');

    // Vote lại được, và lịch sử KHÔNG mất dòng huỷ trước đó.
    await api().post(`/matches/${matchId}/vote`).set(asUser('mate')).expect(201);
    const after = await api().get(`/matches/${matchId}/history`).set(asUser('mate')).expect(200);
    expect(after.body.data.events).toHaveLength(3);
  });

  it('không huỷ được khi còn dưới 2 tiếng', async () => {
    const soon = await createMatch({
      startOffset: HOUR,
      endOffset: 3 * HOUR,
      courtName: 'E2E Sân sắp đá',
    });
    await api().post(`/matches/${soon}/vote`).set(asUser('owner')).expect(201);

    const response = await api().delete(`/matches/${soon}/vote`).set(asUser('owner')).expect(409);
    expect(response.body.code).toBe('MATCH_009');

    const detail = await api().get(`/matches/${soon}`).set(asUser('owner')).expect(200);
    expect(detail.body.data.match.canCancelVote).toBe(false);
  });
});

describe('Chốt chi phí', () => {
  let matchId: string;

  beforeAll(async () => {
    matchId = await createMatch({
      startOffset: 30 * DAY,
      endOffset: 30 * DAY + 2 * HOUR,
      courtName: 'E2E Sân tính tiền',
    });
    await api().post(`/matches/${matchId}/vote`).set(asUser('owner')).expect(201);
    await api().post(`/matches/${matchId}/vote`).set(asUser('mate')).expect(201);
  });

  it('chưa tới giờ thì chưa chốt được', async () => {
    const response = await api()
      .post(`/matches/${matchId}/settlement`)
      .set(asUser('owner'))
      .send({ maleRatio: 1.2, expenses: [{ name: 'Sân', quantity: 1, unitPrice: 300000 }] })
      .expect(409);
    expect(response.body.code).toBe('MATCH_010');
  });

  it('chia theo hệ số, làm tròn lên nghìn, dư vào quỹ', async () => {
    await moveToPast(matchId);

    const response = await api()
      .post(`/matches/${matchId}/settlement`)
      .set(asUser('owner'))
      .send({
        maleRatio: 1.2,
        expenses: [
          { name: 'Tiền sân', quantity: 1, unitPrice: 200000 },
          { name: 'Cầu', quantity: 4, unitPrice: 25000 },
        ],
      })
      .expect(201);

    const settlement = response.body.data.settlement;
    expect(settlement.total).toBe(300000);
    // Nam 1.2 suất + nữ 1 suất = 2.2 suất → nữ 136.363đ → 137.000, nam 163.636đ → 164.000.
    const byUser = Object.fromEntries(
      settlement.charges.map((charge: { userId: string; amount: number }) => [charge.userId, charge.amount]),
    );
    expect(byUser[users.owner.id]).toBe(164000);
    expect(byUser[users.mate.id]).toBe(137000);
    expect(settlement.surplus).toBe(1000);
    expect(settlement.editable).toBe(true);
  });

  it('member không chốt được', async () => {
    await api()
      .post(`/matches/${matchId}/settlement`)
      .set(asUser('mate'))
      .send({ maleRatio: 1, expenses: [{ name: 'Sân', quantity: 1, unitPrice: 100000 }] })
      .expect(403);
  });

  it('chốt lại được khi chưa ai gửi thanh toán', async () => {
    const response = await api()
      .post(`/matches/${matchId}/settlement`)
      .set(asUser('owner'))
      .send({ maleRatio: 1, expenses: [{ name: 'Tiền sân', quantity: 1, unitPrice: 300000 }] })
      .expect(201);

    // Hệ số 1 → chia đều, và bảng chi phí cũ bị ghi đè chứ không cộng dồn.
    expect(response.body.data.settlement.total).toBe(300000);
    expect(response.body.data.settlement.expenses).toHaveLength(1);
    for (const charge of response.body.data.settlement.charges) {
      expect(charge.amount).toBe(150000);
    }
  });

  it('trận đã chốt thì không kéo thả đổi giờ được nữa', async () => {
    const response = await api()
      .patch(`/matches/${matchId}`)
      .set(asUser('owner'))
      .send({ startAt: at(-5 * HOUR), endAt: at(-4 * HOUR) })
      .expect(409);
    expect(response.body.code).toBe('MATCH_011');
  });
});

describe('Thanh toán gom nhiều trận', () => {
  let matchA: string;
  let matchB: string;

  type ChargeItem = {
    chargeId: string;
    matchId: string;
    amount: number;
    paymentStatus: string;
    rejectReason: string | null;
  };
  type Group = { organizationId: string; unpaidTotal: number; charges: ChargeItem[] };

  /** Công nợ của `mate` ở tổ chức này, lấy qua đúng API mà trang thanh toán dùng. */
  const myGroup = async (): Promise<Group> => {
    const response = await api()
      .get(`/organizations/${organizationId}/charges/me`)
      .set(asUser('mate'))
      .expect(200);
    return response.body.data.groups.find((group: Group) => group.organizationId === organizationId);
  };
  /** Chỉ hai trận của describe này — tổ chức còn khoản từ describe trước nên phải lọc. */
  const ownScope = (group: Group) => group.charges.filter((charge) => [matchA, matchB].includes(charge.matchId));
  const ownCharges = (group: Group) => ownScope(group).filter((charge) => charge.paymentStatus === 'unpaid');
  const sum = (charges: ChargeItem[]) => charges.reduce((total, charge) => total + charge.amount, 0);

  beforeAll(async () => {
    // Hai trận riêng biệt, cùng hai người — để kiểm đúng chuyện gom nhiều trận vào một ảnh.
    matchA = await createMatch({
      startOffset: 40 * DAY,
      endOffset: 40 * DAY + 2 * HOUR,
      courtName: 'E2E Sân buổi A',
    });
    matchB = await createMatch({
      startOffset: 41 * DAY,
      endOffset: 41 * DAY + 2 * HOUR,
      courtName: 'E2E Sân buổi B',
    });
    for (const matchId of [matchA, matchB]) {
      await api().post(`/matches/${matchId}/vote`).set(asUser('owner')).expect(201);
      await api().post(`/matches/${matchId}/vote`).set(asUser('mate')).expect(201);
    }
  });

  it('chưa cấu hình QR thì không gửi thanh toán được', async () => {
    await moveToPast(matchA);
    await api()
      .post(`/matches/${matchA}/settlement`)
      .set(asUser('owner'))
      .send({ maleRatio: 1, expenses: [{ name: 'Sân', quantity: 1, unitPrice: 200000 }] })
      .expect(201);

    const charges = await api().get(`/organizations/${organizationId}/charges/me`).set(asUser('mate')).expect(200);
    const chargeId = charges.body.data.groups[0].charges.find(
      (charge: { matchId: string }) => charge.matchId === matchA,
    ).chargeId;

    const response = await api()
      .post(`/organizations/${organizationId}/payments`)
      .set(asUser('mate'))
      .send({ chargeIds: [chargeId], proofUrl: 'http://localhost:4566/joytab/proof.png' })
      .expect(409);
    expect(response.body.code).toBe('PAY_005');
  });

  it('một ảnh trả cho nhiều trận, và khoản biến khỏi danh sách phải trả', async () => {
    await api()
      .patch(`/organizations/${organizationId}`)
      .set(asUser('owner'))
      .send({ paymentQrUrl: 'http://localhost:4566/joytab/qr.png' })
      .expect(200);

    await moveToPast(matchB);
    await api()
      .post(`/matches/${matchB}/settlement`)
      .set(asUser('owner'))
      .send({ maleRatio: 1, expenses: [{ name: 'Sân', quantity: 1, unitPrice: 100000 }] })
      .expect(201);

    const before = await myGroup();
    const unpaid = ownCharges(before);
    // 100.000 (buổi A) + 50.000 (buổi B) — hai trận, một lần trả.
    expect(unpaid).toHaveLength(2);
    expect(sum(unpaid)).toBe(150000);

    const payment = await api()
      .post(`/organizations/${organizationId}/payments`)
      .set(asUser('mate'))
      .send({
        chargeIds: unpaid.map((charge) => charge.chargeId),
        proofUrl: 'http://localhost:4566/joytab/proof.png',
      })
      .expect(201);
    expect(payment.body.data.payment.total).toBe(150000);
    expect(payment.body.data.payment.items).toHaveLength(2);

    const after = await myGroup();
    // Phía user: hai khoản này đã trả xong, không còn nằm trong danh sách phải thanh toán.
    expect(ownCharges(after)).toHaveLength(0);
    expect(before.unpaidTotal - after.unpaidTotal).toBe(150000);
    expect(ownScope(after).every((charge) => charge.paymentStatus === 'submitted')).toBe(true);
  });

  it('gửi lại đúng những khoản đó thì bị chặn', async () => {
    const charge = await db.matchCharge.findFirst({
      where: { user_id: users.mate.id, match_id: matchA },
      select: { id: true },
    });

    const response = await api()
      .post(`/organizations/${organizationId}/payments`)
      .set(asUser('mate'))
      .send({
        chargeIds: [charge!.id],
        proofUrl: 'http://localhost:4566/joytab/proof-2.png',
      })
      .expect(409);
    expect(response.body.code).toBe('PAY_002');
  });

  it('đã có người gửi thì owner không sửa được chia tiền nữa', async () => {
    const response = await api()
      .post(`/matches/${matchA}/settlement`)
      .set(asUser('owner'))
      .send({ maleRatio: 1, expenses: [{ name: 'Sân', quantity: 1, unitPrice: 500000 }] })
      .expect(409);
    expect(response.body.code).toBe('MATCH_011');
  });

  it('owner từ chối thì khoản quay lại kèm lý do', async () => {
    const queue = await api()
      .get(`/organizations/${organizationId}/payments`)
      .set(asUser('owner'))
      .query({ status: 'submitted' })
      .expect(200);
    const paymentId = queue.body.data.payments[0].id;

    await api()
      .post(`/organizations/${organizationId}/payments/${paymentId}/reject`)
      .set(asUser('owner'))
      .send({ reason: 'Chưa thấy tiền về tài khoản' })
      .expect(201);

    const group = await myGroup();
    const back = ownCharges(group);
    expect(sum(back)).toBe(150000);
    expect(back.every((charge) => charge.rejectReason === 'Chưa thấy tiền về tài khoản')).toBe(true);
  });

  it('gửi lại rồi owner duyệt thì mọi khoản trong lần đó thành đã đối soát', async () => {
    const payment = await api()
      .post(`/organizations/${organizationId}/payments`)
      .set(asUser('mate'))
      .send({
        chargeIds: ownCharges(await myGroup()).map((charge) => charge.chargeId),
        proofUrl: 'http://localhost:4566/joytab/proof-3.png',
      })
      .expect(201);

    const confirmed = await api()
      .post(`/organizations/${organizationId}/payments/${payment.body.data.payment.id}/confirm`)
      .set(asUser('owner'))
      .expect(201);
    expect(confirmed.body.data.payment.status).toBe('confirmed');

    const settlement = await api().get(`/matches/${matchA}/settlement`).set(asUser('owner')).expect(200);
    const mateCharge = settlement.body.data.settlement.charges.find(
      (charge: { userId: string }) => charge.userId === users.mate.id,
    );
    expect(mateCharge.paymentStatus).toBe('confirmed');
    expect(settlement.body.data.settlement.editable).toBe(false);
  });

  it('member không thấy lần thanh toán của người khác', async () => {
    const asMember = await api().get(`/organizations/${organizationId}/payments`).set(asUser('mate')).expect(200);
    expect(asMember.body.data.payments.every((payment: { userId: string }) => payment.userId === users.mate.id)).toBe(
      true,
    );
  });
});
