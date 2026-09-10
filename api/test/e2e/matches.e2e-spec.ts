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
  // Người tham gia dựng thẳng bằng Prisma (describe "Dòng trong danh sách trận") không nằm
  // trong `users`, nên quét thêm một lượt theo email của ĐÚNG lần chạy này.
  await db.user.deleteMany({ where: { email: { endsWith: `.${RUN_ID}@joytab.test` } } });
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

  it('chia theo hệ số, để lẻ tới đồng, thu đúng bằng chi', async () => {
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
    // Nam 1.2 suất + nữ 1 suất = 2.2 suất → nam 163.636,36đ, nữ 136.363,63đ. Không làm tròn
    // lên nghìn nữa; 1đ lẻ còn lại về tay người có phần dư lớn hơn (nữ).
    const byUser = Object.fromEntries(
      settlement.charges.map((charge: { userId: string; amount: number }) => [charge.userId, charge.amount]),
    );
    expect(byUser[users.owner.id]).toBe(163636);
    expect(byUser[users.mate.id]).toBe(136364);
    expect(byUser[users.owner.id] + byUser[users.mate.id]).toBe(settlement.total);
    expect(settlement.surplus).toBe(0);
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

  it('chủ tổ chức tự đánh dấu đã trả: cách chia không đổi, chỉ khoản của owner thành paid, và vẫn sửa được', async () => {
    const response = await api()
      .post(`/matches/${matchId}/settlement`)
      .set(asUser('owner'))
      .send({
        maleRatio: 1,
        skipOwnerPayment: true,
        expenses: [{ name: 'Tiền sân', quantity: 1, unitPrice: 300000 }],
      })
      .expect(201);

    const settlement = response.body.data.settlement;
    const byUser = Object.fromEntries(
      settlement.charges.map(
        (charge: { userId: string; amount: number; paymentStatus: string }) => [charge.userId, charge],
      ),
    );
    // Vẫn chia đều 150.000 mỗi người — công thức chia không đổi.
    expect(byUser[users.owner.id].amount).toBe(150000);
    expect(byUser[users.mate.id].amount).toBe(150000);
    // Chỉ khoản của owner tự động thành paid; mate vẫn unpaid như bình thường.
    expect(byUser[users.owner.id].paymentStatus).toBe('paid');
    expect(byUser[users.mate.id].paymentStatus).toBe('unpaid');
    // Tự đánh dấu KHÔNG khoá bảng — chưa ai chuyển khoản thật.
    expect(settlement.editable).toBe(true);
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

describe('Lịch sử thi đấu', () => {
  let orgId: string;
  const ids: Record<string, string> = {};

  /**
   * Dựng trận trực tiếp bằng Prisma: API chặn tạo trận ở quá khứ (MATCH_002), mà lịch sử thì
   * toàn quá khứ — đi đường API sẽ phải tạo ở tương lai rồi dời về, ba request cho một fixture.
   */
  async function seed(params: {
    startOffset: number;
    status: 'open' | 'settled' | 'canceled';
    charge?: { user: 'owner' | 'mate'; paymentStatus: 'unpaid' | 'paid' };
    votedBy?: 'owner' | 'mate';
    courtName?: string;
  }): Promise<string> {
    const startAt = new Date(Date.now() + params.startOffset);
    const match = await db.match.create({
      data: {
        organization_id: orgId,
        court_name: params.courtName ?? 'E2E Sân lịch sử',
        start_at: startAt,
        end_at: new Date(startAt.getTime() + 2 * HOUR),
        max_players: 4,
        male_ratio: 1,
        status: params.status,
        created_by: users.owner.id,
      },
    });
    if (params.charge) {
      await db.matchCharge.create({
        data: {
          match_id: match.id,
          user_id: users[params.charge.user].id,
          ratio: 1,
          amount: 50_000,
          payment_status: params.charge.paymentStatus,
        },
      });
    }
    if (params.votedBy) {
      await db.matchVote.create({ data: { match_id: match.id, user_id: users[params.votedBy].id } });
    }
    return match.id;
  }

  const history = (as: string, query: string = '') =>
    api().get(`/organizations/${orgId}/matches/history${query}`).set(asUser(as));

  const idsOf = (body: { data: { matches: { id: string }[] } }) =>
    body.data.matches.map((match) => match.id);

  beforeAll(async () => {
    // Tổ chức RIÊNG: các describe trước đã để lại trận đã chốt/đã huỷ trong tổ chức chung, mà ở
    // đây phải đếm chính xác từng dòng trả về.
    const created = await api()
      .post('/organizations')
      .set(asUser('owner'))
      .send({ name: `E2E Matches history ${RUN_ID}` })
      .expect(201);
    orgId = created.body.data.organization.id;

    const opened = await api()
      .patch(`/organizations/${orgId}`)
      .set(asUser('owner'))
      .send({ joinByCodeEnabled: true })
      .expect(200);
    await api()
      .post('/organizations/join')
      .set(asUser('mate'))
      .send({ joinCode: opened.body.data.organization.joinCode })
      .expect(201);

    ids.openPast = await seed({ startOffset: -40 * DAY, status: 'open', votedBy: 'owner' });
    // Buổi đã huỷ mà owner từng đăng ký: sau khi huỷ không còn charge nào, nên đây là fixture
    // duy nhất chứng minh vế `votes` của bộ lọc "buổi của tôi" có tác dụng.
    ids.canceled = await seed({ startOffset: -30 * DAY, status: 'canceled', votedBy: 'owner' });
    ids.paid = await seed({
      startOffset: -20 * DAY,
      status: 'settled',
      charge: { user: 'owner', paymentStatus: 'paid' },
      votedBy: 'owner',
    });
    // Có tiền phải trả nhưng không có row vote (owner chốt tay cho người vào muộn): fixture
    // của vế `charges` trong bộ lọc "buổi của tôi".
    ids.unpaid = await seed({
      startOffset: -10 * DAY,
      status: 'settled',
      charge: { user: 'owner', paymentStatus: 'unpaid' },
    });
    // CÙNG giờ bắt đầu với `unpaid`, và khoản tiền thuộc người khác — một fixture lo hai việc:
    // kiểm tie-breaker theo id, và kiểm trận mình không tham gia.
    ids.mateOnly = await seed({
      startOffset: -10 * DAY,
      status: 'settled',
      charge: { user: 'mate', paymentStatus: 'unpaid' },
    });
  });

  it('chỉ lấy trận đã chốt tiền và đã huỷ, mới nhất trước', async () => {
    const response = await history('owner').expect(200);
    const returned = idsOf(response.body);

    expect(returned).toHaveLength(3);
    expect(returned).not.toContain(ids.openPast);
    expect(returned).toEqual([ids.unpaid, ids.paid, ids.canceled]);
    expect(response.body.data.nextCursor).toBeNull();

    const times = response.body.data.matches.map((match: { startAt: string }) =>
      new Date(match.startAt).getTime(),
    );
    expect([...times].sort((a: number, b: number) => b - a)).toEqual(times);
  });

  it('mỗi dòng nói đúng "tôi tham gia chưa" và "tôi trả tiền chưa"', async () => {
    const response = await history('owner').expect(200);
    const byId = new Map<string, { voted: boolean; myPaymentStatus: string | null }>(
      response.body.data.matches.map((match: { id: string }) => [match.id, match]),
    );

    expect(byId.get(ids.paid)).toMatchObject({ voted: true, myPaymentStatus: 'paid' });
    expect(byId.get(ids.unpaid)).toMatchObject({ voted: false, myPaymentStatus: 'unpaid' });
  });

  it('chỉ trả buổi của chính mình, không phải sổ của cả tổ chức', async () => {
    // `mateOnly` chỉ có khoản tiền của `mate`: owner không đăng ký, không có tiền ở đó.
    expect(idsOf((await history('owner').expect(200)).body)).not.toContain(ids.mateOnly);
    // Và ngược lại: `mate` chỉ thấy đúng buổi đó, không thấy ba buổi của owner.
    expect(idsOf((await history('mate').expect(200)).body)).toEqual([ids.mateOnly]);
  });

  it('lọc theo trạng thái trận', async () => {
    const canceled = await history('owner', '?status=canceled').expect(200);
    expect(idsOf(canceled.body)).toEqual([ids.canceled]);

    const both = await history('owner', '?status=settled&status=canceled').expect(200);
    expect(idsOf(both.body)).toHaveLength(3);

    await history('owner', '?status=open').expect(400);
  });

  it('lọc theo thanh toán, chỉ xét khoản của chính mình', async () => {
    const unpaid = await history('owner', '?paymentStatus=unpaid').expect(200);
    // `mateOnly` cũng `unpaid`, nhưng là của người khác — owner không có gì phải trả ở trận đó.
    expect(idsOf(unpaid.body)).toEqual([ids.unpaid]);

    const paid = await history('owner', '?paymentStatus=paid').expect(200);
    expect(idsOf(paid.body)).toEqual([ids.paid]);

    const mateUnpaid = await history('mate', '?paymentStatus=unpaid').expect(200);
    expect(idsOf(mateUnpaid.body)).toEqual([ids.mateOnly]);
  });

  it('lọc theo khoảng ngày, biên nửa mở [from, to)', async () => {
    const middle = await history(
      'owner',
      `?from=${encodeURIComponent(at(-25 * DAY))}&to=${encodeURIComponent(at(-15 * DAY))}`,
    ).expect(200);
    expect(idsOf(middle.body)).toEqual([ids.paid]);

    // `to` đúng bằng giờ bắt đầu của trận đó thì trận rơi ra ngoài — đó là ý nghĩa của biên mở.
    const paidMatch = await db.match.findUniqueOrThrow({ where: { id: ids.paid } });
    const exclusive = await history(
      'owner',
      `?from=${encodeURIComponent(at(-21 * DAY))}&to=${encodeURIComponent(paidMatch.start_at.toISOString())}`,
    ).expect(200);
    expect(idsOf(exclusive.body)).toEqual([]);
  });

  it('cuộn theo cursor: nối liền, không lặp, hết thì trả null', async () => {
    const all = idsOf((await history('owner').expect(200)).body);

    const collected: string[] = [];
    let cursor: string | null = null;
    let rounds = 0;
    do {
      const query = `?limit=2${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
      const page = await history('owner', query).expect(200);
      expect(page.body.data.matches.length).toBeLessThanOrEqual(2);
      collected.push(...idsOf(page.body));
      cursor = page.body.data.nextCursor;
      rounds += 1;
    } while (cursor && rounds < 10);

    expect(collected).toEqual(all);
    expect(new Set(collected).size).toBe(collected.length);
    expect(cursor).toBeNull();
  });

  it('cursor sai shape bị chặn ở tầng validate', async () => {
    await history('owner', '?cursor=khong-phai-cursor').expect(400);
  });

  it('member xem được, người ngoài không thấy tổ chức tồn tại', async () => {
    await history('mate').expect(200);
    await history('outsider').expect(404);
  });
});

/**
 * Những gì một DÒNG trong danh sách trận phải mang theo: địa chỉ sân, vài người đã đăng ký để
 * vẽ avatar, và cờ "tôi đã đăng ký chưa".
 *
 * Cờ đó là chỗ dễ sai nhất: phần xem trước chỉ có 5 người đăng ký sớm nhất, nên nếu đọc cờ từ
 * chính danh sách đó thì người đăng ký thứ 6 trở đi sẽ thấy trận của mình là "chưa đăng ký".
 */
describe('Dòng trong danh sách trận', () => {
  let orgId: string;
  let matchId: string;
  /** Sáu người đăng ký trước `owner` — đủ để đẩy owner ra khỏi phần xem trước. */
  const early: { id: string; name: string }[] = [];

  beforeAll(async () => {
    const created = await api()
      .post('/organizations')
      .set(asUser('owner'))
      .send({ name: `E2E Matches row ${RUN_ID}` })
      .expect(201);
    orgId = created.body.data.organization.id;

    // `mate` vào bằng đường thật vì test dưới cần một người CÓ cookie mà CHƯA đăng ký trận.
    const opened = await api()
      .patch(`/organizations/${orgId}`)
      .set(asUser('owner'))
      .send({ joinByCodeEnabled: true })
      .expect(200);
    await api()
      .post('/organizations/join')
      .set(asUser('mate'))
      .send({ joinCode: opened.body.data.organization.joinCode })
      .expect(201);

    // Người tham gia dựng thẳng bằng Prisma: đi đường API là 6 lần đăng nhập + 6 lần join, mà
    // thứ cần kiểm ở đây là hình dạng dữ liệu trả về, không phải luồng tham gia tổ chức.
    for (let i = 0; i < 6; i++) {
      const user = await db.user.create({
        data: {
          provider: 'google',
          provider_user_id: `e2e-row-${i}-${RUN_ID}`,
          email: `e2e.row${i}.${RUN_ID}@joytab.test`,
          full_name: `E2E Row ${i}`,
          onboarded: true,
        },
      });
      await db.organizationMember.create({
        data: { organization_id: orgId, user_id: user.id, role: 'member' },
      });
      early.push({ id: user.id, name: `E2E Row ${i}` });
    }

    const match = await api()
      .post(`/organizations/${orgId}/matches`)
      .set(asUser('owner'))
      .send({
        courtName: 'E2E Sân có địa chỉ',
        address: '  12 Trần Duy Hưng, Cầu Giấy, Hà Nội  ',
        startAt: at(2 * DAY),
        endAt: at(2 * DAY + 2 * HOUR),
        maxPlayers: 10,
      })
      .expect(201);
    matchId = match.body.data.match.id;

    // Sáu người kia đăng ký TRƯỚC, mỗi người cách nhau một giây để thứ tự không phụ thuộc may rủi.
    for (const [index, person] of early.entries()) {
      await db.matchVote.create({
        data: {
          match_id: matchId,
          user_id: person.id,
          voted_at: new Date(Date.now() - (10 - index) * 1000),
        },
      });
    }
    await api().post(`/matches/${matchId}/vote`).set(asUser('owner')).expect(201);
  });

  const rowOf = async (as: string) => {
    const response = await api()
      .get(`/organizations/${orgId}/matches`)
      .query({ from: at(0), to: at(7 * DAY) })
      .set(asUser(as))
      .expect(200);
    return response.body.data.matches.find((match: { id: string }) => match.id === matchId);
  };

  it('mang theo địa chỉ sân, đã cắt khoảng trắng thừa', async () => {
    const row = await rowOf('owner');
    expect(row.address).toBe('12 Trần Duy Hưng, Cầu Giấy, Hà Nội');
  });

  it('xem trước tối đa 5 người, sớm nhất trước', async () => {
    const row = await rowOf('owner');
    expect(row.playerCount).toBe(7);
    expect(row.participantsPreview).toHaveLength(5);
    expect(row.participantsPreview.map((p: { fullName: string }) => p.fullName)).toEqual(
      early.slice(0, 5).map((person) => person.name),
    );
    expect(row.participantsPreview[0]).toMatchObject({ userId: early[0].id, avatarUrl: null });
  });

  it('người đăng ký thứ 7 vẫn thấy mình ĐÃ đăng ký, dù không có trong phần xem trước', async () => {
    const row = await rowOf('owner');
    expect(row.participantsPreview.map((p: { userId: string }) => p.userId)).not.toContain(
      users.owner.id,
    );
    expect(row.voted).toBe(true);
    expect(row.canCancelVote).toBe(true);
  });

  it('người chưa đăng ký thì cờ là false', async () => {
    const row = await rowOf('mate');
    expect(row.voted).toBe(false);
    expect(row.canCancelVote).toBe(false);
  });

  it('sửa địa chỉ được; chuỗi rỗng là KHÔNG đổi, cùng quy ước với ghi chú', async () => {
    const updated = await api()
      .patch(`/matches/${matchId}`)
      .set(asUser('owner'))
      .send({ address: '45 Nguyễn Trãi, Thanh Xuân, Hà Nội' })
      .expect(200);
    expect(updated.body.data.match.address).toBe('45 Nguyễn Trãi, Thanh Xuân, Hà Nội');

    // `trimOrUndefined` biến chuỗi rỗng thành `undefined`, tức là "không gửi field này" — nên
    // ô trống không xoá được địa chỉ đã lưu. Đúng như `note` từ trước tới nay.
    const blank = await api()
      .patch(`/matches/${matchId}`)
      .set(asUser('owner'))
      .send({ address: '   ' })
      .expect(200);
    expect(blank.body.data.match.address).toBe('45 Nguyễn Trãi, Thanh Xuân, Hà Nội');
  });

  it('địa chỉ quá dài bị chặn ở tầng validate', async () => {
    await api()
      .post(`/organizations/${orgId}/matches`)
      .set(asUser('owner'))
      .send({
        courtName: 'E2E Sân địa chỉ dài',
        address: 'x'.repeat(256),
        startAt: at(5 * DAY),
        endAt: at(5 * DAY + 2 * HOUR),
        maxPlayers: 4,
      })
      .expect(400);
  });
});

/**
 * Danh sách "buổi sắp diễn ra" ở trang chủ: mọi buổi CHƯA KẾT THÚC của tổ chức, sớm nhất trước,
 * cuộn theo cursor. Không có trần khoảng ngày — buổi của năm sau vẫn phải tới được.
 */
describe('Buổi sắp diễn ra', () => {
  let orgId: string;
  const ids: Record<string, string> = {};

  async function seed(params: {
    startOffset: number;
    hours?: number;
    status?: 'open' | 'settled' | 'canceled';
    court?: string;
  }): Promise<string> {
    const startAt = new Date(Date.now() + params.startOffset);
    const match = await db.match.create({
      data: {
        organization_id: orgId,
        court_name: params.court ?? 'E2E Sân sắp tới',
        start_at: startAt,
        end_at: new Date(startAt.getTime() + (params.hours ?? 2) * HOUR),
        max_players: 4,
        male_ratio: 1,
        status: params.status ?? 'open',
        created_by: users.owner.id,
      },
    });
    return match.id;
  }

  const upcoming = (as: string, query: string = '') =>
    api().get(`/organizations/${orgId}/matches/upcoming${query}`).set(asUser(as));

  const idsOf = (body: { data: { matches: { id: string }[] } }) =>
    body.data.matches.map((match) => match.id);

  beforeAll(async () => {
    const created = await api()
      .post('/organizations')
      .set(asUser('owner'))
      .send({ name: `E2E Matches upcoming ${RUN_ID}` })
      .expect(201);
    orgId = created.body.data.organization.id;

    const opened = await api()
      .patch(`/organizations/${orgId}`)
      .set(asUser('owner'))
      .send({ joinByCodeEnabled: true })
      .expect(200);
    await api()
      .post('/organizations/join')
      .set(asUser('mate'))
      .send({ joinCode: opened.body.data.organization.joinCode })
      .expect(201);

    ids.ended = await seed({ startOffset: -5 * HOUR });
    // Đang đá dở: bắt đầu 1 tiếng trước, còn 1 tiếng nữa mới xong.
    ids.ongoing = await seed({ startOffset: -1 * HOUR, court: 'E2E Sân đang đá' });
    ids.soon = await seed({ startOffset: 2 * DAY });
    ids.canceled = await seed({ startOffset: 3 * DAY, status: 'canceled' });
    ids.later = await seed({ startOffset: 30 * DAY });
    // Xa hơn hẳn trần 92 ngày của API xem theo khoảng — nó vẫn phải nằm trong danh sách này.
    ids.farFuture = await seed({ startOffset: 200 * DAY, court: 'E2E Sân năm sau' });
  });

  it('lấy mọi buổi chưa kết thúc, sớm nhất trước — kể cả buổi ngoài 92 ngày', async () => {
    const response = await upcoming('owner').expect(200);
    expect(idsOf(response.body)).toEqual([ids.ongoing, ids.soon, ids.later, ids.farFuture]);
    expect(response.body.data.nextCursor).toBeNull();
  });

  it('bỏ buổi đã kết thúc và buổi đã huỷ', async () => {
    const returned = idsOf((await upcoming('owner').expect(200)).body);
    expect(returned).not.toContain(ids.ended);
    expect(returned).not.toContain(ids.canceled);
  });

  it('cuộn theo cursor: nối liền, không lặp, hết thì trả null', async () => {
    const all = idsOf((await upcoming('owner').expect(200)).body);

    const collected: string[] = [];
    let cursor: string | null = null;
    let rounds = 0;
    do {
      const query = `?limit=2${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
      const page = await upcoming('owner', query).expect(200);
      expect(page.body.data.matches.length).toBeLessThanOrEqual(2);
      collected.push(...idsOf(page.body));
      cursor = page.body.data.nextCursor;
      rounds += 1;
    } while (cursor && rounds < 10);

    expect(collected).toEqual(all);
    expect(new Set(collected).size).toBe(collected.length);
    expect(cursor).toBeNull();
  });

  it('cursor sai shape bị chặn ở tầng validate', async () => {
    await upcoming('owner', '?cursor=khong-phai-cursor').expect(400);
    await upcoming('owner', '?limit=0').expect(400);
  });

  it('member xem được, người ngoài không thấy tổ chức tồn tại', async () => {
    await upcoming('mate').expect(200);
    await upcoming('outsider').expect(404);
  });
});
