import { createHash, randomBytes } from 'node:crypto';
import { INVITE_TOKEN_BYTES } from './organizations.constants';

/** Phần trạng thái của một invite đủ để quyết định nó còn dùng được hay không. */
export type InviteUsabilityInput = {
  revoked_at: Date | null;
  expires_at: Date | null;
  max_uses: number | null;
  used_count: number;
};

/**
 * Input: Không nhận tham số.
 * Output: Chuỗi token thô (hex). Chỉ xuất hiện đúng một lần trong response lúc tạo invite —
 *         DB chỉ giữ SHA-256 nên không có đường lấy lại.
 */
export function generateInviteToken(): string {
  return randomBytes(INVITE_TOKEN_BYTES).toString('hex');
}

/**
 * Input: Token thô người dùng cầm.
 * Output: SHA-256 hex để tra `organization_invites.token_hash`.
 *
 * Hash trần không salt là đủ: token là 32 byte ngẫu nhiên, không phải mật khẩu người đặt
 * nên không có từ điển nào để dò.
 */
export function hashInviteToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

/**
 * Input: Trạng thái invite và mốc thời gian cần xét.
 * Output: true nếu invite còn dùng được — chưa revoke, chưa hết hạn, chưa hết lượt.
 *
 * Tách thành hàm thuần để test được bảng ca biên quanh mốc thời gian mà không cần DB.
 */
export function isInviteUsable(invite: InviteUsabilityInput, now: Date): boolean {
  if (invite.revoked_at !== null) return false;
  if (invite.expires_at !== null && now.getTime() >= invite.expires_at.getTime()) return false;
  if (invite.max_uses !== null && invite.used_count >= invite.max_uses) return false;

  return true;
}

/**
 * Input: FRONTEND_ORIGIN từ env (có thể rỗng) và token thô.
 * Output: URL FE để người được mời bấm vào.
 */
export function buildInviteUrl(frontendOrigin: string | undefined, rawToken: string): string {
  const baseUrl = (frontendOrigin?.trim() || 'http://localhost:3000').replace(/\/+$/, '');
  return new URL(`/invite/${rawToken}`, `${baseUrl}/`).toString();
}
