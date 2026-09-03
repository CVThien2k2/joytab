import { Injectable, Logger } from '@nestjs/common';
import { ERROR_CODES } from '../common/constants/error-codes.constant';
import { AppException } from '../common/exceptions/app.exception';
import { requireMembership, requireOwner } from '../common/utils/membership';
import {
  Gender,
  GENDERS,
  MatchDetail,
  MatchParticipant,
  MatchSettlement,
  MatchStatus,
  MatchSummary,
  MatchVoteEventItem,
  ChargePaymentStatus,
  VoteClosedReason,
} from '../common/utils/types';
import { DatabaseService } from '../database/database.service';
import { MATCH_CANCEL_LOCK_MS, MATCH_RANGE_MAX_DAYS } from './matches.constants';
import { CreateMatchDto, MatchRangeQueryDto, SettleMatchDto, UpdateMatchDto } from './matches.dto';
import { splitExpenses } from './matches.utils';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Row `matches` kèm mấy mảnh phụ thuộc người đang hỏi mà mọi truy vấn danh sách đều cần. */
type MatchRow = {
  id: string;
  organization_id: string;
  court_name: string;
  start_at: Date;
  end_at: Date;
  max_players: number;
  male_ratio: unknown;
  note: string | null;
  status: string;
  organization?: { name: string } | null;
  _count: { votes: number };
  votes: { id: string }[];
  charges: { amount: number; payment_status: string }[];
};

/** Cột tối thiểu của một trận khi chỉ cần kiểm luật, không cần dựng response. */
type MatchCore = {
  id: string;
  organization_id: string;
  start_at: Date;
  end_at: Date;
  max_players: number;
  status: string;
};

@Injectable()
export class MatchesService {
  private readonly logger = new Logger(MatchesService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Input: userId owner + id tổ chức + thông tin trận.
   * Output: Trận vừa tạo.
   *
   *         `maleRatio` không gửi thì CHỤP LẠI mặc định của tổ chức. Chụp chứ không tham
   *         chiếu: owner đổi mặc định vào tháng sau không được phép làm đổi tiền của trận
   *         đã đá xong.
   *
   *         Không cho hai trận GIAO GIỜ trong cùng một tổ chức (xem `assertNoOverlap`).
   */
  async create(userId: string, organizationId: string, dto: CreateMatchDto): Promise<MatchSummary> {
    await requireOwner(this.databaseService, userId, organizationId);

    const { startAt, endAt } = this.parseSchedule(dto.startAt, dto.endAt, { allowPast: false });
    const organization = await this.databaseService.organization.findUnique({
      where: { id: organizationId },
      select: { male_ratio: true },
    });
    if (!organization) throw new AppException(ERROR_CODES.ORG_001);

    const match = await this.databaseService.$transaction(async (tx) => {
      // Khoá theo TỔ CHỨC: hai request tạo trận cùng lúc thì cả hai đều thấy "chưa có gì trùng"
      // rồi cùng ghi. Cùng khuôn với khoá theo user ở `vote`, chỉ khác trục.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${organizationId}))`;
      await this.assertNoOverlap(tx, organizationId, startAt, endAt);

      return tx.match.create({
        data: {
          organization_id: organizationId,
          court_name: dto.courtName,
          start_at: startAt,
          end_at: endAt,
          max_players: dto.maxPlayers,
          male_ratio: dto.maleRatio ?? Number(organization.male_ratio),
          note: dto.note ?? null,
          created_by: userId,
        },
        include: this.summaryInclude(userId),
      });
    });

    this.logger.log(`Match ${match.id} created in organization ${organizationId} by ${userId}`);
    return this.toSummary(match, new Date());
  }

  /**
   * Input: userId + id tổ chức + khoảng ngày.
   * Output: Các trận của tổ chức trong khoảng, sớm nhất trước.
   *
   *         Trả cả trận đã huỷ: bộ lịch phải hiện chúng ở dạng gạch mờ, vì "hôm đó có trận
   *         nhưng đã huỷ" là thông tin, còn ô trống thì không nói gì.
   */
  async listForOrganization(
    userId: string,
    organizationId: string,
    query: MatchRangeQueryDto,
  ): Promise<MatchSummary[]> {
    await requireMembership(this.databaseService, userId, organizationId);

    const { from, to } = this.resolveRange(query);
    const matches = await this.databaseService.match.findMany({
      where: { organization_id: organizationId, start_at: { gte: from, lt: to } },
      orderBy: [{ start_at: 'asc' }, { id: 'asc' }],
      include: this.summaryInclude(userId),
    });

    const now = new Date();
    return matches.map((match) => this.toSummary(match as MatchRow, now));
  }

  /**
   * Input: userId + id trận.
   * Output: Chi tiết trận kèm danh sách người tham gia.
   *
   *         Người không thuộc tổ chức nhận MATCH_001 chứ không phải 403: 403 là đã xác nhận
   *         id đó có thật.
   */
  async detail(userId: string, matchId: string): Promise<MatchDetail> {
    const match = await this.databaseService.match.findUnique({
      where: { id: matchId },
      include: {
        ...this.summaryInclude(userId),
        organization: { select: { name: true } },
        votes: {
          orderBy: [{ voted_at: 'asc' }, { id: 'asc' }],
          include: {
            user: { select: { id: true, full_name: true, avatar_url: true, gender: true } },
          },
        },
      },
    });
    if (!match) throw new AppException(ERROR_CODES.MATCH_001);
    await requireMembership(this.databaseService, userId, match.organization_id, ERROR_CODES.MATCH_001);

    const now = new Date();
    const votes = match.votes;
    const participants: MatchParticipant[] = votes.map((vote) => ({
      userId: vote.user.id,
      fullName: vote.user.full_name,
      avatarUrl: vote.user.avatar_url,
      gender: this.toGender(vote.user.gender),
      votedAt: vote.voted_at.toISOString(),
    }));

    // `votes` ở đây là TOÀN BỘ danh sách (để dựng participants), không phải một dòng của
    // riêng người hỏi như summaryInclude — nên tự tính `voted` thay vì để toSummary đoán.
    const voted = votes.some((vote) => vote.user_id === userId);
    const summary = this.toSummary(
      {
        ...(match as unknown as MatchRow),
        _count: { votes: votes.length },
        votes: voted ? [{ id: 'self' }] : [],
      },
      now,
    );

    return {
      ...summary,
      participants,
      canCancelVote: voted && now.getTime() < match.start_at.getTime() - MATCH_CANCEL_LOCK_MS,
    };
  }

  /**
   * Input: userId owner + id trận + các field cần đổi.
   * Output: Trận sau khi đổi.
   *
   *         Cũng là API đứng sau thao tác kéo thả trên lịch (chỉ gửi startAt/endAt). Vì vậy
   *         cho phép dời sang QUÁ KHỨ: owner nhập bù một buổi đã đá là việc có thật. Nhưng dời
   *         xong là chốt — trận lúc đó đã tới giờ nên lần sửa sau bị MATCH_015 chặn.
   *
   *         Chặn khi đã chốt tiền: đổi giờ của một trận đã chia tiền xong không còn nghĩa gì,
   *         mà lại làm sai lệch thứ người ta đã đối chiếu để trả tiền. Chặn cả khi trận ĐÃ TỚI
   *         GIỜ: xem MATCH_015.
   *
   *         Dời sang giờ đã có trận khác của cùng tổ chức thì cũng bị chặn (`assertNoOverlap`)
   *         — kéo thả trên lịch đi qua đúng API này.
   */
  async update(userId: string, matchId: string, dto: UpdateMatchDto): Promise<MatchSummary> {
    const match = await this.requireMatch(matchId);
    await requireOwner(this.databaseService, userId, match.organization_id, ERROR_CODES.MATCH_001);
    if (match.status === 'canceled') throw new AppException(ERROR_CODES.MATCH_003);
    if (match.status === 'settled') throw new AppException(ERROR_CODES.MATCH_011);
    // Đã tới giờ (đang đá hoặc đá xong) thì hết sửa. Xét GIỜ HIỆN TẠI của trận, không xét giờ
    // muốn dời tới: một trận sắp tới vẫn dời được về quá khứ (nhập bù buổi đã đá), nhưng sau
    // đó nó là chuyện đã xảy ra và đóng lại.
    if (new Date() >= match.start_at) throw new AppException(ERROR_CODES.MATCH_015);

    const startAt = dto.startAt ? new Date(dto.startAt) : match.start_at;
    const endAt = dto.endAt ? new Date(dto.endAt) : match.end_at;
    if (dto.startAt || dto.endAt) {
      this.parseSchedule(startAt.toISOString(), endAt.toISOString(), { allowPast: true });
    }
    // Giảm trần xuống dưới số người đã đăng ký thì hoặc phải đuổi ai đó, hoặc để trận âm
    // slot. Cả hai đều tệ hơn là không cho giảm.
    if (dto.maxPlayers !== undefined) {
      const voteCount = await this.databaseService.matchVote.count({ where: { match_id: matchId } });
      if (dto.maxPlayers < voteCount) throw new AppException(ERROR_CODES.MATCH_004);
    }

    const updated = await this.databaseService.$transaction(async (tx) => {
      // Chỉ khoá và kiểm khi GIỜ đổi: sửa tên sân hay ghi chú không thể tạo ra trùng giờ, mà
      // khoá cả tổ chức cho một lần sửa ghi chú là xếp hàng vô cớ.
      if (dto.startAt !== undefined || dto.endAt !== undefined) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${match.organization_id}))`;
        await this.assertNoOverlap(tx, match.organization_id, startAt, endAt, matchId);
      }

      return tx.match.update({
        where: { id: matchId },
        data: {
          ...(dto.courtName !== undefined ? { court_name: dto.courtName } : {}),
          ...(dto.startAt !== undefined ? { start_at: startAt } : {}),
          ...(dto.endAt !== undefined ? { end_at: endAt } : {}),
          ...(dto.maxPlayers !== undefined ? { max_players: dto.maxPlayers } : {}),
          ...(dto.maleRatio !== undefined ? { male_ratio: dto.maleRatio } : {}),
          ...(dto.note !== undefined ? { note: dto.note || null } : {}),
        },
        include: this.summaryInclude(userId),
      });
    });

    this.logger.log(`Match ${matchId} updated by ${userId}`);
    return this.toSummary(updated, new Date());
  }

  /**
   * Input: userId owner + id trận.
   * Output: Trận chuyển sang `canceled`.
   *
   *         Huỷ mềm chứ không xoá: người đã vote cần thấy trận biến mất CÓ LÝ DO, và lịch sử
   *         vote của họ vẫn phải tra được. Trận đã chốt tiền thì không huỷ được — tiền đã
   *         chia rồi, huỷ đi thì khoản nợ của mọi người treo lơ lửng không thuộc về đâu.
   *
   *         Trận đã TỚI GIỜ cũng không huỷ được (MATCH_016): xem chú thích của mã lỗi đó.
   */
  async cancel(userId: string, matchId: string): Promise<void> {
    const match = await this.requireMatch(matchId);
    await requireOwner(this.databaseService, userId, match.organization_id, ERROR_CODES.MATCH_001);
    if (match.status === 'settled') throw new AppException(ERROR_CODES.MATCH_011);
    if (match.status === 'canceled') return;
    // Đã tới giờ thì hết huỷ: huỷ là để nói "buổi này sẽ không diễn ra", còn buổi đã đá thì huỷ
    // chỉ làm nó biến mất khỏi lịch cùng với dấu vết ai đã đi.
    if (new Date() >= match.start_at) throw new AppException(ERROR_CODES.MATCH_016);

    await this.databaseService.match.update({
      where: { id: matchId },
      data: { status: 'canceled' },
    });
    this.logger.log(`Match ${matchId} canceled by ${userId}`);
  }

  /**
   * Input: userId + id trận.
   * Output: Không trả gì; ghi một dòng match_votes và một dòng lịch sử.
   *
   *         Ba luật cùng lúc: còn slot, chưa tới giờ, và KHÔNG trùng giờ với trận khác mà
   *         user đang vote — xét MỌI tổ chức, vì ràng buộc nằm ở con người chứ không ở sân.
   *
   *         Chống hai request song song bằng hai khoá, luôn theo THỨ TỰ NÀY để không deadlock:
   *          1. advisory lock theo user — mọi thao tác vote của cùng một người xếp hàng, nên
   *             không thể vote hai trận trùng giờ cùng lúc.
   *          2. `FOR UPDATE` trên chính row trận — hai người cùng giành slot cuối thì người
   *             sau đếm được số đã bao gồm người trước.
   */
  async vote(userId: string, matchId: string): Promise<void> {
    await this.databaseService.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;

      const match = await this.lockMatch(tx, matchId);
      await requireMembership(tx, userId, match.organization_id, ERROR_CODES.MATCH_001);

      const now = new Date();
      if (match.status === 'canceled') throw new AppException(ERROR_CODES.MATCH_003);
      if (now >= match.start_at) throw new AppException(ERROR_CODES.MATCH_005);

      const existing = await tx.matchVote.findFirst({
        where: { match_id: matchId, user_id: userId },
        select: { id: true },
      });
      if (existing) throw new AppException(ERROR_CODES.MATCH_007);

      const voteCount = await tx.matchVote.count({ where: { match_id: matchId } });
      if (voteCount >= match.max_players) throw new AppException(ERROR_CODES.MATCH_004);

      const conflict = await tx.matchVote.findFirst({
        where: {
          user_id: userId,
          match_id: { not: matchId },
          match: {
            status: { not: 'canceled' },
            // Giao nhau nửa mở: 19h-21h và 21h-23h KHÔNG tính là trùng.
            start_at: { lt: match.end_at },
            end_at: { gt: match.start_at },
          },
        },
        select: { id: true },
      });
      if (conflict) throw new AppException(ERROR_CODES.MATCH_006);

      await tx.matchVote.create({ data: { match_id: matchId, user_id: userId } });
      await tx.matchVoteEvent.create({
        data: { match_id: matchId, user_id: userId, action: 'join' },
      });
    });

    this.logger.log(`User ${userId} voted match ${matchId}`);
  }

  /**
   * Input: userId + id trận.
   * Output: Không trả gì; xoá dòng match_votes và ghi một dòng lịch sử 'cancel'.
   *
   *         Chặn trong 2 giờ cuối: tới lúc đó những người còn lại đã sắp xếp đi theo con số
   *         trên màn hình, rút lui lúc ấy là để lại một sân thiếu người và một hoá đơn chia
   *         cho ít người hơn.
   */
  async cancelVote(userId: string, matchId: string): Promise<void> {
    await this.databaseService.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;

      const match = await this.lockMatch(tx, matchId);
      await requireMembership(tx, userId, match.organization_id, ERROR_CODES.MATCH_001);

      const vote = await tx.matchVote.findFirst({
        where: { match_id: matchId, user_id: userId },
        select: { id: true },
      });
      if (!vote) throw new AppException(ERROR_CODES.MATCH_008);

      const now = new Date();
      if (match.status === 'canceled') throw new AppException(ERROR_CODES.MATCH_003);
      if (now >= match.start_at) throw new AppException(ERROR_CODES.MATCH_005);
      if (now.getTime() >= match.start_at.getTime() - MATCH_CANCEL_LOCK_MS) {
        throw new AppException(ERROR_CODES.MATCH_009);
      }

      await tx.matchVote.delete({ where: { id: vote.id } });
      await tx.matchVoteEvent.create({
        data: { match_id: matchId, user_id: userId, action: 'cancel' },
      });
    });

    this.logger.log(`User ${userId} canceled vote on match ${matchId}`);
  }

  /**
   * Input: userId + id trận.
   * Output: Lịch sử vote/huỷ, mới nhất trước.
   *
   *         Mọi thành viên đọc được, không riêng owner: chính những người cùng đá là người
   *         cần biết ai đã rút và rút lúc nào.
   */
  async history(userId: string, matchId: string): Promise<MatchVoteEventItem[]> {
    const match = await this.requireMatch(matchId);
    await requireMembership(this.databaseService, userId, match.organization_id, ERROR_CODES.MATCH_001);

    const events = await this.databaseService.matchVoteEvent.findMany({
      where: { match_id: matchId },
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
    });
    if (events.length === 0) return [];

    // Bảng lịch sử KHÔNG có quan hệ tới users (nó phải sống sót cả khi user bị xoá), nên tên
    // được tra rời ở đây; ai không còn thì `fullName` là null và FE hiện "Người đã rời".
    const users = await this.databaseService.user.findMany({
      where: { id: { in: [...new Set(events.map((event) => event.user_id))] } },
      select: { id: true, full_name: true },
    });
    const names = new Map(users.map((user) => [user.id, user.full_name]));

    return events.map((event) => ({
      action: event.action === 'cancel' ? 'cancel' : 'join',
      userId: event.user_id,
      fullName: names.get(event.user_id) ?? null,
      createdAt: event.created_at.toISOString(),
    }));
  }

  /**
   * Input: userId + id trận.
   * Output: Bảng chia tiền đã lưu. Trận chưa chốt thì MATCH_013 — FE tự dựng preview từ
   *         danh sách người tham gia, không có gì để đọc ở đây.
   */
  async getSettlement(userId: string, matchId: string): Promise<MatchSettlement> {
    const match = await this.requireMatch(matchId);
    await requireMembership(this.databaseService, userId, match.organization_id, ERROR_CODES.MATCH_001);
    if (match.status !== 'settled') throw new AppException(ERROR_CODES.MATCH_013);

    return this.readSettlement(matchId);
  }

  /**
   * Input: userId owner + id trận + danh sách chi phí và hệ số.
   * Output: Bảng chia tiền vừa lưu.
   *
   *         Người bị chia tiền là những người CÒN vote — huỷ vote đã bị chặn trong 2 giờ
   *         cuối nên danh sách này chính là những người đã cam kết đi.
   *
   *         Gọi lại được để sửa, NHƯNG chỉ khi mọi khoản còn `unpaid`. Một ảnh chuyển khoản
   *         có thể đang treo cho nhiều trận; đổi tiền một trận sẽ làm ảnh đó không khớp với
   *         bất kỳ tổng nào, và người đã trả không nên thấy con số đổi sau lưng mình.
   *
   *         Toàn bộ nằm trong MỘT transaction: xoá bảng cũ mà tạo bảng mới hỏng thì trận mất
   *         sạch chi phí, tệ hơn là không sửa được.
   */
  async settle(userId: string, matchId: string, dto: SettleMatchDto): Promise<MatchSettlement> {
    const match = await this.requireMatch(matchId);
    await requireOwner(this.databaseService, userId, match.organization_id, ERROR_CODES.MATCH_001);
    if (match.status === 'canceled') throw new AppException(ERROR_CODES.MATCH_003);
    if (new Date() < match.start_at) throw new AppException(ERROR_CODES.MATCH_010);

    const locked = await this.databaseService.matchCharge.findFirst({
      where: { match_id: matchId, payment_status: { not: 'unpaid' } },
      select: { id: true },
    });
    if (locked) throw new AppException(ERROR_CODES.MATCH_011);

    const votes = await this.databaseService.matchVote.findMany({
      where: { match_id: matchId },
      orderBy: [{ voted_at: 'asc' }, { id: 'asc' }],
      include: { user: { select: { id: true, gender: true } } },
    });

    const result = splitExpenses({
      participants: votes.map((vote) => ({
        userId: vote.user.id,
        gender: this.toGender(vote.user.gender),
      })),
      expenses: dto.expenses,
      maleRatio: dto.maleRatio,
    });
    if (result.charges.length === 0 || result.total <= 0) {
      throw new AppException(ERROR_CODES.MATCH_012);
    }

    const genderByUser = new Map(votes.map((vote) => [vote.user.id, vote.user.gender]));
    await this.databaseService.$transaction(async (tx) => {
      await tx.matchExpense.deleteMany({ where: { match_id: matchId } });
      await tx.matchCharge.deleteMany({ where: { match_id: matchId } });
      await tx.matchExpense.createMany({
        data: dto.expenses.map((expense, index) => ({
          match_id: matchId,
          name: expense.name,
          quantity: expense.quantity,
          unit_price: expense.unitPrice,
          position: index,
        })),
      });
      await tx.matchCharge.createMany({
        data: result.charges.map((charge) => ({
          match_id: matchId,
          user_id: charge.userId,
          gender_at_settle: genderByUser.get(charge.userId) ?? null,
          ratio: charge.ratio,
          amount: charge.amount,
        })),
      });
      await tx.match.update({
        where: { id: matchId },
        data: {
          status: 'settled',
          male_ratio: dto.maleRatio,
          settled_at: new Date(),
          settled_by: userId,
        },
      });
    });

    this.logger.log(
      `Match ${matchId} settled by ${userId}: total ${result.total}, ${result.charges.length} people, surplus ${result.surplus}`,
    );
    return this.readSettlement(matchId);
  }

  /**
   * Input: id trận đã chốt.
   * Output: Bảng chia tiền đọc thẳng từ DB — số tiền là SNAPSHOT, không tính lại.
   *
   *         Tính lại lúc đọc thì đổi giới tính hay sửa hệ số sẽ âm thầm làm đổi số tiền
   *         người ta đã chuyển khoản.
   */
  private async readSettlement(matchId: string): Promise<MatchSettlement> {
    const [match, expenses, charges] = await Promise.all([
      this.databaseService.match.findUnique({
        where: { id: matchId },
        select: { male_ratio: true, status: true },
      }),
      this.databaseService.matchExpense.findMany({
        where: { match_id: matchId },
        orderBy: [{ position: 'asc' }, { id: 'asc' }],
      }),
      this.databaseService.matchCharge.findMany({
        where: { match_id: matchId },
        orderBy: [{ amount: 'desc' }, { id: 'asc' }],
        include: { user: { select: { id: true, full_name: true, avatar_url: true, gender: true } } },
      }),
    ]);
    if (!match) throw new AppException(ERROR_CODES.MATCH_001);

    const total = expenses.reduce((sum, expense) => sum + expense.quantity * expense.unit_price, 0);
    const collected = charges.reduce((sum, charge) => sum + charge.amount, 0);

    return {
      matchId,
      settled: match.status === 'settled',
      maleRatio: Number(match.male_ratio),
      expenses: expenses.map((expense) => ({
        name: expense.name,
        quantity: expense.quantity,
        unitPrice: expense.unit_price,
      })),
      total,
      charges: charges.map((charge) => ({
        userId: charge.user.id,
        fullName: charge.user.full_name,
        avatarUrl: charge.user.avatar_url,
        gender: this.toGender(charge.user.gender),
        ratio: Number(charge.ratio),
        amount: charge.amount,
        paymentStatus: this.toPaymentStatus(charge.payment_status),
      })),
      surplus: collected - total,
      editable: charges.every((charge) => charge.payment_status === 'unpaid'),
    };
  }

  /**
   * Input: id trận.
   * Output: Vài cột đủ để kiểm luật; không có thì MATCH_001.
   */
  private async requireMatch(matchId: string): Promise<MatchCore> {
    const match = await this.databaseService.match.findUnique({
      where: { id: matchId },
      select: {
        id: true,
        organization_id: true,
        start_at: true,
        end_at: true,
        max_players: true,
        status: true,
      },
    });
    if (!match) throw new AppException(ERROR_CODES.MATCH_001);
    return match;
  }

  /**
   * Input: client của transaction đang chạy + id trận.
   * Output: Row trận, đã khoá tới hết transaction.
   *
   *         Phải là SQL thô vì Prisma không có `FOR UPDATE`. Không có khoá này thì hai người
   *         cùng bấm tham gia ở slot cuối sẽ cùng đếm ra "còn chỗ" rồi cùng ghi.
   */
  /**
   * Input: client (hoặc tx), id tổ chức, khoảng giờ mới, và id trận đang sửa nếu có.
   * Output: Không trả gì; ném MATCH_014 nếu tổ chức đã có trận khác giao giờ.
   *
   *         Giao nhau NỬA MỞ, cùng quy ước với `overlaps` và với luật trùng giờ của vote:
   *         19h-21h và 21h-23h không tính là trùng.
   *
   *         Trận đã HUỶ không chiếm giờ: huỷ rồi đặt lại đúng giờ đó là việc hay làm nhất khi
   *         đổi sân. Trận đã chốt tiền thì vẫn chiếm — nó là một buổi đã đá thật.
   *
   *         Chỉ xét TRONG MỘT tổ chức. Hai tổ chức đá cùng giờ là chuyện của họ; còn trùng giờ
   *         của một CON NGƯỜI thì đã có MATCH_006 lo, xuyên tổ chức.
   */
  private async assertNoOverlap(
    tx: Pick<DatabaseService, 'match'>,
    organizationId: string,
    startAt: Date,
    endAt: Date,
    excludeMatchId?: string,
  ): Promise<void> {
    const conflict = await tx.match.findFirst({
      where: {
        organization_id: organizationId,
        status: { not: 'canceled' },
        ...(excludeMatchId ? { id: { not: excludeMatchId } } : {}),
        start_at: { lt: endAt },
        end_at: { gt: startAt },
      },
      select: { id: true },
    });
    if (conflict) throw new AppException(ERROR_CODES.MATCH_014);
  }

  private async lockMatch(tx: Pick<DatabaseService, '$queryRaw'>, matchId: string): Promise<MatchCore> {
    const rows = await tx.$queryRaw<MatchCore[]>`
      SELECT id, organization_id, start_at, end_at, max_players, status
      FROM matches
      WHERE id = ${matchId}::uuid
      FOR UPDATE`;
    if (rows.length === 0) throw new AppException(ERROR_CODES.MATCH_001);
    return rows[0];
  }

  /**
   * Input: userId người đang hỏi.
   * Output: Mệnh đề `include` gắn vào mọi truy vấn trận: số người, "tôi đã vote chưa", và
   *         khoản tiền của riêng tôi.
   *
   *         Gom một chỗ vì bốn route đang cần đúng ba mảnh này; lệch nhau một mảnh là FE
   *         nhận hai shape khác nhau cho cùng một thứ.
   */
  private summaryInclude(userId: string) {
    return {
      _count: { select: { votes: true } },
      votes: { where: { user_id: userId }, select: { id: true }, take: 1 },
      charges: {
        where: { user_id: userId },
        select: { amount: true, payment_status: true },
        take: 1,
      },
    };
  }

  /**
   * Input: row trận (đã include) + thời điểm hiện tại.
   * Output: MatchSummary cho FE.
   */
  private toSummary(match: MatchRow, now: Date): MatchSummary {
    const playerCount = match._count.votes;
    const charge = match.charges[0];

    return {
      id: match.id,
      organizationId: match.organization_id,
      ...(match.organization ? { organizationName: match.organization.name } : {}),
      courtName: match.court_name,
      startAt: match.start_at.toISOString(),
      endAt: match.end_at.toISOString(),
      maxPlayers: match.max_players,
      playerCount,
      maleRatio: Number(match.male_ratio),
      note: match.note,
      status: this.toStatus(match.status),
      voted: match.votes.length > 0,
      voteClosedReason: this.voteClosedReason(match, playerCount, now),
      myAmount: charge ? charge.amount : null,
      myPaymentStatus: charge ? this.toPaymentStatus(charge.payment_status) : null,
    };
  }

  /**
   * Input: trận + số người đang vote + hiện tại.
   * Output: Vì sao vote đang đóng, hoặc null nếu còn mở.
   *
   *         SUY RA chứ không đọc cột: nếu lưu thành cột thì mỗi lần có người huỷ vote lúc còn
   *         slot lại phải nhớ mở lại, và sẽ có lúc quên.
   */
  private voteClosedReason(
    match: { status: string; start_at: Date; max_players: number },
    playerCount: number,
    now: Date,
  ): VoteClosedReason {
    if (match.status === 'canceled') return 'canceled';
    if (now >= match.start_at) return 'started';
    if (playerCount >= match.max_players) return 'full';
    return null;
  }

  /**
   * Input: hai mốc thời gian dạng ISO + có cho phép ở quá khứ không.
   * Output: Hai `Date` hợp lệ; sai thì MATCH_002.
   *
   *         Tạo mới thì cấm quá khứ (không ai mở đăng ký cho buổi hôm qua), nhưng SỬA thì
   *         cho: owner nhập bù một buổi đã đá xong là việc có thật.
   */
  private parseSchedule(
    startInput: string,
    endInput: string,
    options: { allowPast: boolean },
  ): { startAt: Date; endAt: Date } {
    const startAt = new Date(startInput);
    const endAt = new Date(endInput);
    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
      throw new AppException(ERROR_CODES.MATCH_002);
    }
    if (endAt <= startAt) throw new AppException(ERROR_CODES.MATCH_002);
    if (!options.allowPast && startAt <= new Date()) throw new AppException(ERROR_CODES.MATCH_002);
    return { startAt, endAt };
  }

  /**
   * Input: query khoảng ngày (cả hai đều tuỳ chọn).
   * Output: Khoảng đã chuẩn hoá.
   *
   *         Không gửi gì thì lấy quanh hôm nay, để lần mở trang đầu tiên FE không phải tính.
   *         Có TRẦN độ rộng vì đây là tham số client tự đặt: một request `from=1970` kéo cả
   *         bảng matches về.
   */
  private resolveRange(query: MatchRangeQueryDto): { from: Date; to: Date } {
    const now = Date.now();
    const from = query.from ? new Date(query.from) : new Date(now - 31 * DAY_MS);
    const to = query.to ? new Date(query.to) : new Date(now + 61 * DAY_MS);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) {
      throw new AppException(ERROR_CODES.MATCH_002);
    }

    const maxTo = new Date(from.getTime() + MATCH_RANGE_MAX_DAYS * DAY_MS);
    return { from, to: to > maxTo ? maxTo : to };
  }

  /** Cột VarChar nên giá trị lạ là có thể; quy về 'open' thay vì để lọt kiểu sai lên FE. */
  private toStatus(value: string): MatchStatus {
    return value === 'settled' || value === 'canceled' ? value : 'open';
  }

  private toPaymentStatus(value: string): ChargePaymentStatus {
    return value === 'paid' ? 'paid' : 'unpaid';
  }

  private toGender(value: string | null): Gender | null {
    return GENDERS.includes(value as Gender) ? (value as Gender) : null;
  }
}
