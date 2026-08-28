import { ERROR_CODES, ErrorCodeItem } from '../constants/error-codes.constant';
import { AppException } from '../exceptions/app.exception';
import { DatabaseService } from '../../database/database.service';
import { OrganizationRole } from './types';

/**
 * Chỉ cần đọc được bảng organization_members. Khai hẹp thế này để truyền được cả
 * DatabaseService lẫn client bên trong `$transaction` — kiểm quyền phải nằm CÙNG transaction
 * với thao tác ghi, nếu không thì giữa hai câu lệnh người đó có thể đã bị đuổi khỏi tổ chức.
 */
type MembershipReader = Pick<DatabaseService, 'organizationMember'>;

/**
 * Input: DatabaseService, userId đã xác thực, id tổ chức, và mã lỗi muốn ném khi không phải
 *        thành viên (mặc định ORG_001 — "không tìm thấy tổ chức").
 * Output: Vai trò của user trong tổ chức đó.
 *
 *         Người ngoài luôn nhận "không tồn tại" chứ không bao giờ nhận 403: 403 là đã xác
 *         nhận id đó có thật. Các module lịch/thanh toán ném MATCH_001 thay vì ORG_001 vì
 *         thứ người ngoài hỏi là một trận, không phải một tổ chức.
 *
 *         Là hàm rời chứ không phải service để ba module (organizations, matches, payments)
 *         dùng chung một định nghĩa "ai được vào" — ba bản chép tay sẽ có ngày lệch nhau.
 */
export async function requireMembership(
  databaseService: MembershipReader,
  userId: string,
  organizationId: string,
  notFound: ErrorCodeItem = ERROR_CODES.ORG_001,
): Promise<OrganizationRole> {
  const membership = await databaseService.organizationMember.findFirst({
    where: { organization_id: organizationId, user_id: userId },
    select: { role: true },
  });
  if (!membership) throw new AppException(notFound);
  return membership.role === 'owner' ? 'owner' : 'member';
}

/**
 * Input: như trên.
 * Output: Không trả gì; ném ORG_004 nếu user là thành viên nhưng không phải owner.
 *
 *         Hai mức lỗi khác nhau là cố ý: người ngoài nhận "không tồn tại", người trong nhà
 *         nhận "không đủ quyền".
 */
export async function requireOwner(
  databaseService: MembershipReader,
  userId: string,
  organizationId: string,
  notFound: ErrorCodeItem = ERROR_CODES.ORG_001,
): Promise<void> {
  const role = await requireMembership(databaseService, userId, organizationId, notFound);
  if (role !== 'owner') throw new AppException(ERROR_CODES.ORG_004);
}
