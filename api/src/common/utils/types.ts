import { ERROR_CODES, ErrorCodeItem } from '../constants/error-codes.constant';

export type { ErrorCodeItem };

export type ErrorCode = keyof typeof ERROR_CODES;
export type ErrorCodeValue = (typeof ERROR_CODES)[ErrorCode]['code'];

/** Response thành công chuẩn — mọi handler đều được ResponseInterceptor bọc về dạng này. */
export type ApiSuccessResponse<T> = {
  success: true;
  message: string;
  data: T;
  meta?: Record<string, unknown>;
};

/**
 * Response lỗi chuẩn — mọi exception đều được HttpExceptionFilter bọc về dạng này.
 * FE xử lý theo `code`; `details` chỉ có với lỗi validate (mảng message của ValidationPipe).
 */
export type ApiErrorResponse = {
  success: false;
  code: ErrorCodeValue;
  message: string;
  details?: unknown;
};

/** Một response API bất kỳ: thành công hoặc lỗi. */
export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * Profile thô do Google trả về sau OAuth (google.strategy.ts) — CHỈ những gì Google biết.
 * Không chứa dữ liệu do user tự khai ở onboarding.
 */
export type GoogleUser = {
  provider: 'google';
  providerUserId: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
};

/** Giới tính user tự khai ở bước onboarding. */
export const GENDERS = ['male', 'female', 'other'] as const;
export type Gender = (typeof GENDERS)[number];

/**
 * User trả cho FE ở /auth/me, /auth/refresh và /auth/onboarding. Là GoogleUser cộng thêm
 * phần user tự khai; `onboarded` là cờ FE/proxy dựa vào để quyết định cho vào app hay không.
 */
export type UserProfile = GoogleUser & {
  age: number | null;
  gender: Gender | null;
  phone: string | null;
  onboarded: boolean;
};

/** Vai trò của một user trong một tổ chức. Nguồn giá trị: ORGANIZATION_ROLES. */
export type OrganizationRole = 'owner' | 'member';

/**
 * Một tổ chức nhìn từ góc độ user đang hỏi — nên có `role` (quyết định FE hiện nút gì).
 * Cùng shape cho GET /organizations, POST /organizations và POST /organizations/join.
 */
/**
 * Thông tin tối thiểu để dựng màn hình "bạn được mời vào tổ chức này" TRƯỚC khi user bấm
 * tham gia. Cố tình KHÔNG có `joinCode`/`id`: người xem chưa phải thành viên.
 */
export type OrganizationPreview = {
  name: string;
  memberCount: number;
  /** true = user đang hỏi đã ở trong tổ chức này rồi, FE hiện lối vào thay vì nút tham gia. */
  alreadyMember: boolean;
};

export type OrganizationSummary = {
  id: string;
  name: string;
  role: OrganizationRole;
  /** null = tổ chức đang đóng cửa. Mọi thành viên đều thấy mã; chỉ owner bật/tắt được. */
  joinCode: string | null;
  joinByCodeEnabled: boolean;
  memberCount: number;
  /** Ảnh QR chuyển khoản của tổ chức; null = owner chưa cấu hình. Mọi thành viên đều thấy —
   *  người phải quét mã chính là member. */
  paymentQrUrl: string | null;
  /** Hệ số nam mặc định cho trận mới (nữ là mốc 1). */
  maleRatio: number;
  /** ISO 8601 — thời điểm user đang hỏi vào tổ chức này. */
  joinedAt: string;
};

/**
 * Một thành viên trong danh sách thành viên của tổ chức (GET /organizations/:id/members).
 *
 * Có `email` vì đây là danh bạ nội bộ của một tổ chức: người trong cùng tổ chức cần nhận ra
 * nhau, và ai vào được danh sách này thì đã là thành viên (service kiểm trước khi đọc).
 * KHÔNG có `age`/`gender`/`phone`: đó là dữ liệu onboarding của cá nhân, không phải thứ
 * người cùng tổ chức cần thấy.
 */
export type OrganizationMemberSummary = {
  /** id của user, không phải id row organization_members — FE dùng để so với chính mình. */
  userId: string;
  fullName: string | null;
  email: string;
  avatarUrl: string | null;
  role: OrganizationRole;
  /** ISO 8601 — thời điểm người này vào tổ chức. */
  joinedAt: string;
};

/**
 * Meta phân trang chuẩn — cùng shape với `Pagination` của hub để FE hai app đọc như một.
 * `page` đếm từ 1.
 */
export type Pagination = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

/** Trạng thái một trận. Nguồn giá trị: MATCH_STATUSES trong matches.constants.ts. */
export type MatchStatus = 'open' | 'settled' | 'canceled';

/**
 * Vì sao vote đang đóng. `null` = đang mở.
 *
 * Trả lý do chứ không trả một cờ boolean: FE phải nói được "đã đủ người" hay "đã bắt đầu",
 * chứ làm mờ nút mà không giải thích thì người dùng đứng đoán.
 */
export type VoteClosedReason = 'full' | 'started' | 'canceled' | null;

/** Một trận trong danh sách/bộ lịch, kèm phần thông tin riêng của user đang hỏi. */
export type MatchSummary = {
  id: string;
  organizationId: string;
  /** Chỉ có ở lịch cá nhân (xuyên tổ chức) — chip trên lịch phải nói rõ trận của tổ chức nào. */
  organizationName?: string;
  courtName: string;
  /** ISO 8601 có offset. */
  startAt: string;
  endAt: string;
  maxPlayers: number;
  playerCount: number;
  maleRatio: number;
  note: string | null;
  status: MatchStatus;
  /** User đang hỏi đã vote trận này chưa. */
  voted: boolean;
  voteClosedReason: VoteClosedReason;
  /** Số tiền của user đang hỏi ở trận này; null khi trận chưa chốt hoặc user không tham gia. */
  myAmount: number | null;
  myPaymentStatus: ChargePaymentStatus | null;
};

/** Một người đang tham gia trận. */
export type MatchParticipant = {
  userId: string;
  fullName: string | null;
  avatarUrl: string | null;
  gender: Gender | null;
  /** ISO 8601 — lần vote hiện tại, không phải lần vote đầu tiên trong lịch sử. */
  votedAt: string;
};

/** Chi tiết một trận: summary + danh sách người tham gia. */
export type MatchDetail = MatchSummary & {
  participants: MatchParticipant[];
  /** Còn huỷ vote được không (đã vote, và chưa tới mốc 2 giờ trước giờ chơi). */
  canCancelVote: boolean;
};

/** Một dòng lịch sử vote. Append-only nên chỉ có đọc. */
export type MatchVoteEventItem = {
  action: 'join' | 'cancel';
  userId: string;
  fullName: string | null;
  createdAt: string;
};

/** Một dòng chi phí. `unitPrice` là ĐƠN GIÁ; thành tiền do FE/BE nhân ra, không lưu. */
export type MatchExpenseItem = {
  name: string;
  quantity: number;
  unitPrice: number;
};

/** Trạng thái trả tiền của một khoản. */
export type ChargePaymentStatus = 'unpaid' | 'paid';

/** Số tiền của một người trong một trận. */
export type MatchChargeItem = {
  userId: string;
  fullName: string | null;
  avatarUrl: string | null;
  gender: Gender | null;
  ratio: number;
  amount: number;
  paymentStatus: ChargePaymentStatus;
};

/**
 * Bảng chia tiền của một trận. Dùng chung cho hai việc: xem lại sau khi chốt, và preview
 * trước khi chốt — cùng một shape nên FE chỉ dựng một bảng.
 */
export type MatchSettlement = {
  matchId: string;
  settled: boolean;
  maleRatio: number;
  expenses: MatchExpenseItem[];
  total: number;
  charges: MatchChargeItem[];
  /** Σ(tiền từng người) − tổng chi, sinh ra do làm tròn lên nghìn. Luôn ≥ 0. */
  surplus: number;
  /** Còn sửa được không: chỉ khi mọi khoản còn 'unpaid'. */
  editable: boolean;
};

/** Một khoản chưa/đã trả của user, kèm ngữ cảnh trận để hiển thị. */
export type UserChargeItem = {
  chargeId: string;
  matchId: string;
  courtName: string;
  startAt: string;
  amount: number;
  paymentStatus: ChargePaymentStatus;
};

/** Công nợ của user trong MỘT tổ chức — đơn vị mà một lần chuyển khoản có thể trả. */
export type OrganizationChargeGroup = {
  organizationId: string;
  organizationName: string;
  /** null = tổ chức chưa cấu hình QR, FE phải chặn nút thanh toán. */
  paymentQrUrl: string | null;
  unpaidTotal: number;
  charges: UserChargeItem[];
};

/**
 * Một lần chuyển khoản, gom nhiều khoản của nhiều trận.
 *
 * Không có `status`: không ai duyệt nữa, nên một row tồn tại đã là "đã chuyển".
 */
export type PaymentSummary = {
  id: string;
  organizationId: string;
  userId: string;
  fullName: string | null;
  avatarUrl: string | null;
  proofUrl: string;
  note: string | null;
  submittedAt: string;
  /** Σ amount của các khoản trong lần này — tính từ charges, không lưu cột riêng. */
  total: number;
  /** Các trận mà lần chuyển khoản này trả cho. */
  items: { matchId: string; courtName: string; startAt: string; amount: number }[];
};
