import { ConfigService } from '@nestjs/config';
import { createTestDatabaseService, createUser, resetDatabase } from '../../test/integration-db';
import { DatabaseService } from '../database/database.service';
import { InviteType, MemberRole, MemberStatus } from '../generated/prisma/enums';
import { InvitesService } from './invites.service';
import { hashInviteToken } from './organizations.utils';

/**
 * Điều mock không chứng minh được: nhiều người bấm cùng một link trong cùng một khoảnh khắc
 * khi chỉ còn một lượt. Cần `FOR UPDATE` thật trên Postgres thật.
 */
describe('InvitesService (Postgres thật)', () => {
  let db: DatabaseService;
  let invitesService: InvitesService;

  beforeAll(() => {
    db = createTestDatabaseService();
    const configService = { get: () => 'http://localhost:3000' } as unknown as ConfigService;
    invitesService = new InvitesService(db, configService);
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  beforeEach(async () => {
    await resetDatabase(db);
  });

  /**
   * Input: Số lượt tối đa của link mời.
   * Output: Org có sẵn 1 admin và một invite LINK với token thô để dùng ngay.
   */
  async function seedOrgWithInvite(maxUses: number | null) {
    const admin = await createUser(db, 'admin');
    const organization = await db.organization.create({ data: { name: 'Nhóm cầu lông', created_by: admin.id } });
    await db.organizationMember.create({
      data: {
        organization_id: organization.id,
        user_id: admin.id,
        role: MemberRole.ADMIN,
        status: MemberStatus.ACTIVE,
      },
    });
    const invite = await invitesService.create(organization.id, admin.id, { maxUses: maxUses ?? undefined });

    return { admin, organization, invite };
  }

  it('nhiều người cùng bấm link còn 1 lượt thì chỉ 1 người vào được', async () => {
    const { organization, invite } = await seedOrgWithInvite(1);
    const racers = await Promise.all(Array.from({ length: 5 }, (_value, index) => createUser(db, `racer-${index}`)));

    const results = await Promise.allSettled(racers.map((racer) => invitesService.accept(invite.token, racer.id)));

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    for (const result of results.filter((item) => item.status === 'rejected')) {
      expect(result.reason).toMatchObject({ code: 'INV_002' });
    }

    const members = await db.organizationMember.count({
      where: { organization_id: organization.id, status: MemberStatus.ACTIVE },
    });
    // 1 admin + đúng 1 người thắng cuộc đua.
    expect(members).toBe(2);

    const stored = await db.organizationInvite.findUniqueOrThrow({
      where: { token_hash: hashInviteToken(invite.token) },
    });
    expect(stored.used_count).toBe(1);
  });

  it('bấm lại link mình đã dùng thì không đốt thêm lượt', async () => {
    const { invite } = await seedOrgWithInvite(3);
    const user = await createUser(db, 'joiner');

    const first = await invitesService.accept(invite.token, user.id);
    const second = await invitesService.accept(invite.token, user.id);

    expect(first.alreadyMember).toBe(false);
    expect(second.alreadyMember).toBe(true);

    const stored = await db.organizationInvite.findUniqueOrThrow({
      where: { token_hash: hashInviteToken(invite.token) },
    });
    expect(stored.used_count).toBe(1);
  });

  it('người từng rời nhóm join lại thì bật lại row cũ, không tạo row mới', async () => {
    const { organization, invite } = await seedOrgWithInvite(null);
    const user = await createUser(db, 'returner');
    await invitesService.accept(invite.token, user.id);
    await db.organizationMember.updateMany({
      where: { organization_id: organization.id, user_id: user.id },
      data: { status: MemberStatus.LEFT },
    });

    await invitesService.accept(invite.token, user.id);

    const rows = await db.organizationMember.findMany({
      where: { organization_id: organization.id, user_id: user.id },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe(MemberStatus.ACTIVE);
    expect(rows[0].role).toBe(MemberRole.MEMBER);
  });

  it('link đã thu hồi thì không accept được', async () => {
    const { organization, invite } = await seedOrgWithInvite(null);
    await invitesService.revoke(organization.id, invite.id);
    const user = await createUser(db, 'late');

    await expect(invitesService.accept(invite.token, user.id)).rejects.toMatchObject({ code: 'INV_002' });
  });

  it('token thô không được lưu vào DB, chỉ có SHA-256', async () => {
    const { invite } = await seedOrgWithInvite(null);
    const stored = await db.organizationInvite.findUniqueOrThrow({
      where: { token_hash: hashInviteToken(invite.token) },
    });

    expect(stored.token_hash).not.toBe(invite.token);
    expect(stored.type).toBe(InviteType.LINK);
    expect(invite.url).toBe(`http://localhost:3000/invite/${invite.token}`);
  });

  it('preview trả tên nhóm kể cả khi link đã hết hiệu lực', async () => {
    const { organization, invite } = await seedOrgWithInvite(null);
    await invitesService.revoke(organization.id, invite.id);

    const preview = await invitesService.preview(invite.token);
    expect(preview.organization.name).toBe('Nhóm cầu lông');
    expect(preview.usable).toBe(false);
  });
});
