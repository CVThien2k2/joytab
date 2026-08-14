import { createTestDatabaseService, createUser, resetDatabase } from '../../test/integration-db';
import { SettlementsService } from '../billing/settlements.service';
import { AppException } from '../common/exceptions/app.exception';
import { DatabaseService } from '../database/database.service';
import { AttendanceStatus, EventStatus, MemberRole, MemberStatus } from '../generated/prisma/enums';
import { EventsService } from './events.service';

/**
 * Những gì mock không chứng minh được: hai người cùng giành slot cuối, hai admin cùng bấm
 * chốt sổ. Chỉ Postgres thật với `SELECT ... FOR UPDATE` mới trả lời được.
 */
describe('EventsService (Postgres thật)', () => {
  let db: DatabaseService;
  let eventsService: EventsService;

  beforeAll(() => {
    db = createTestDatabaseService();
    eventsService = new EventsService(db, new SettlementsService(db));
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  beforeEach(async () => {
    await resetDatabase(db);
  });

  /**
   * Input: Số thành viên cần tạo và sĩ số tối đa của trận.
   * Output: Org có 1 admin + N member, kèm một trận OPEN chưa ai vote.
   */
  async function seedOrgWithEvent(memberCount: number, maxParticipants: number) {
    const admin = await createUser(db, 'admin');
    const organization = await db.organization.create({
      data: { name: 'Nhóm cầu lông', created_by: admin.id },
    });
    await db.organizationMember.create({
      data: {
        organization_id: organization.id,
        user_id: admin.id,
        role: MemberRole.ADMIN,
        status: MemberStatus.ACTIVE,
      },
    });

    const members = await Promise.all(
      Array.from({ length: memberCount }, (_value, index) => createUser(db, `member-${index}`)),
    );
    await db.organizationMember.createMany({
      data: members.map((member) => ({
        organization_id: organization.id,
        user_id: member.id,
        role: MemberRole.MEMBER,
        status: MemberStatus.ACTIVE,
      })),
    });

    const startAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const event = await db.event.create({
      data: {
        organization_id: organization.id,
        title: 'Tối thứ Năm',
        start_at: startAt,
        end_at: new Date(startAt.getTime() + 2 * 60 * 60 * 1000),
        court_cost: 200_000,
        extra_costs: [{ name: 'Cầu', amount: 100_000 }],
        max_participants: maxParticipants,
        vote_locked_at: startAt,
        created_by: admin.id,
      },
    });

    return { admin, organization, members, event };
  }

  it('N người cùng giành slot cuối thì chỉ đúng 1 người vào được', async () => {
    const maxParticipants = 4;
    const { members, event } = await seedOrgWithEvent(8, maxParticipants);

    // Lấp đầy trận, chừa đúng một chỗ.
    for (let index = 0; index < maxParticipants - 1; index++) {
      await eventsService.vote(event.id, members[index].id, AttendanceStatus.GOING);
    }

    const racers = members.slice(maxParticipants - 1);
    const results = await Promise.allSettled(
      racers.map((member) => eventsService.vote(event.id, member.id, AttendanceStatus.GOING)),
    );

    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    expect(fulfilled).toHaveLength(1);

    for (const result of results.filter((item) => item.status === 'rejected')) {
      expect(result.reason).toBeInstanceOf(AppException);
      expect((result.reason as AppException).code).toBe('EVT_002');
    }

    const goingCount = await db.eventAttendance.count({
      where: { event_id: event.id, status: AttendanceStatus.GOING },
    });
    expect(goingCount).toBe(maxParticipants);
  });

  it('bỏ vote thì slot trống ra ngay cho người khác vào', async () => {
    const { members, event } = await seedOrgWithEvent(3, 2);
    await eventsService.vote(event.id, members[0].id, AttendanceStatus.GOING);
    await eventsService.vote(event.id, members[1].id, AttendanceStatus.GOING);

    await expect(eventsService.vote(event.id, members[2].id, AttendanceStatus.GOING)).rejects.toMatchObject({
      code: 'EVT_002',
    });

    await eventsService.vote(event.id, members[0].id, AttendanceStatus.NOT_GOING);
    const result = await eventsService.vote(event.id, members[2].id, AttendanceStatus.GOING);

    expect(result.goingCount).toBe(2);
    expect(result.isFull).toBe(true);
  });

  it('đổi vote của chính mình khi đang GOING không tự chiếm mất slot của mình', async () => {
    const { members, event } = await seedOrgWithEvent(2, 1);
    await eventsService.vote(event.id, members[0].id, AttendanceStatus.GOING);

    // Vote lại GOING lần nữa: nếu đếm cả chính mình thì đây sẽ sai thành EVT_002.
    const result = await eventsService.vote(event.id, members[0].id, AttendanceStatus.GOING);
    expect(result.goingCount).toBe(1);
  });

  it('vote sau mốc khoá bị chặn bằng EVT_003', async () => {
    const { members, event } = await seedOrgWithEvent(1, 10);
    await db.event.update({
      where: { id: event.id },
      data: { vote_locked_at: new Date(Date.now() - 60_000) },
    });

    await expect(eventsService.vote(event.id, members[0].id, AttendanceStatus.GOING)).rejects.toMatchObject({
      code: 'EVT_003',
    });
  });

  it('finalize hai lần đồng thời chỉ tạo settlement đúng một lần', async () => {
    const { admin, members, event } = await seedOrgWithEvent(3, 10);
    for (const member of members) {
      await eventsService.vote(event.id, member.id, AttendanceStatus.GOING);
    }
    await eventsService.markAttended(event.id, admin.id, {
      items: members.map((member) => ({ userId: member.id, attended: true })),
    });

    const results = await Promise.allSettled([
      eventsService.finalize(event.id, admin.id),
      eventsService.finalize(event.id, admin.id),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);

    const settlements = await db.eventSettlement.findMany({ where: { event_id: event.id } });
    expect(settlements).toHaveLength(3);
    // total = 200.000 (sân) + 100.000 (cầu) = 300.000, chia 3 người chẵn.
    expect(settlements.reduce((sum, settlement) => sum + settlement.amount, 0)).toBe(300_000);

    const finalized = await db.event.findUniqueOrThrow({ where: { id: event.id } });
    expect(finalized.status).toBe(EventStatus.COMPLETED);
  });

  it('finalize khi không ai được chấm attended thì bị chặn bằng EVT_005', async () => {
    const { admin, members, event } = await seedOrgWithEvent(2, 10);
    for (const member of members) {
      await eventsService.vote(event.id, member.id, AttendanceStatus.GOING);
    }

    await expect(eventsService.finalize(event.id, admin.id)).rejects.toMatchObject({ code: 'EVT_005' });
    expect(await db.eventSettlement.count({ where: { event_id: event.id } })).toBe(0);
  });

  it('chia tiền lẻ vẫn khớp tuyệt đối tổng chi phí', async () => {
    const { admin, members, event } = await seedOrgWithEvent(7, 10);
    // 200.000 + 100.001 = 300.001, chia 7 người không chẵn.
    await db.event.update({ where: { id: event.id }, data: { extra_costs: [{ name: 'Cầu', amount: 100_001 }] } });
    for (const member of members) {
      await eventsService.vote(event.id, member.id, AttendanceStatus.GOING);
    }
    await eventsService.markAttended(event.id, admin.id, {
      items: members.map((member) => ({ userId: member.id, attended: true })),
    });

    await eventsService.finalize(event.id, admin.id);

    const settlements = await db.eventSettlement.findMany({ where: { event_id: event.id } });
    expect(settlements.reduce((sum, settlement) => sum + settlement.amount, 0)).toBe(300_001);
    const amounts = settlements.map((settlement) => settlement.amount);
    expect(Math.max(...amounts) - Math.min(...amounts)).toBe(1);
  });

  it('reopen xoá sạch settlement và đưa trận về OPEN', async () => {
    const { admin, members, event } = await seedOrgWithEvent(2, 10);
    for (const member of members) {
      await eventsService.vote(event.id, member.id, AttendanceStatus.GOING);
    }
    await eventsService.markAttended(event.id, admin.id, {
      items: members.map((member) => ({ userId: member.id, attended: true })),
    });
    await eventsService.finalize(event.id, admin.id);

    await eventsService.reopen(event.id, admin.id);

    expect(await db.eventSettlement.count({ where: { event_id: event.id } })).toBe(0);
    const reopened = await db.event.findUniqueOrThrow({ where: { id: event.id } });
    expect(reopened.status).toBe(EventStatus.OPEN);
    expect(reopened.completed_at).toBeNull();
  });

  it('reopen bị chặn bằng EVT_006 khi đã có người trả tiền', async () => {
    const { admin, members, event } = await seedOrgWithEvent(2, 10);
    for (const member of members) {
      await eventsService.vote(event.id, member.id, AttendanceStatus.GOING);
    }
    await eventsService.markAttended(event.id, admin.id, {
      items: members.map((member) => ({ userId: member.id, attended: true })),
    });
    await eventsService.finalize(event.id, admin.id);
    await db.eventSettlement.updateMany({ where: { event_id: event.id }, data: { paid_amount: 1 } });

    await expect(eventsService.reopen(event.id, admin.id)).rejects.toMatchObject({ code: 'EVT_006' });
    expect(await db.eventSettlement.count({ where: { event_id: event.id } })).toBe(2);
  });
});
