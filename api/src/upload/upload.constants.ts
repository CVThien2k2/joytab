/**
 * Nguồn sự thật duy nhất cho hằng số của luồng upload ảnh.
 */

/**
 * Thư mục đích được phép trên S3. Client tự chọn `folder`, nên KHÔNG có allowlist thì ai cũng
 * ghi được vào bất kỳ prefix nào của bucket — kể cả prefix của app khác đang dùng chung bucket.
 * (Hub không chặn ở BE; đây là chỗ joytab làm chặt hơn.)
 */
export const UPLOAD_FOLDERS = ['avatars', 'org-logos', 'payment-qr', 'payment-proofs'] as const;
export type UploadFolder = (typeof UPLOAD_FOLDERS)[number];

/**
 * Thư mục thuộc SỞ HỮU của một tổ chức — key của chúng nằm dưới `orgs/<organizationId>/`, khác
 * `avatars` (dữ liệu của USER, một user có thể ở nhiều tổ chức nên không gắn được vào một id).
 *
 * Gắn theo tổ chức để một lần xoá tổ chức là xoá sạch theo PREFIX, không phải nhớ dọn từng loại
 * ảnh một (xem `UploadService.deleteOrganizationFolder`).
 */
export const ORG_SCOPED_UPLOAD_FOLDERS = ['org-logos', 'payment-qr', 'payment-proofs'] as const;

export function isOrgScopedFolder(folder: UploadFolder): boolean {
  return (ORG_SCOPED_UPLOAD_FOLDERS as readonly string[]).includes(folder);
}

/**
 * Tiền tố chung của mọi object joytab ghi lên bucket. Bucket đang dùng chung với hub, nên tách
 * prefix để hai app không trộn file vào nhau — và sau này xoá/đếm theo app cũng dễ.
 */
export const UPLOAD_KEY_PREFIX = 'joytab';

/** Tiền tố các folder thuộc một tổ chức. Một chỗ duy nhất định nghĩa hình dạng key, để
 *  `buildObjectKey` và `deleteOrganizationFolder` không lệch nhau. */
export function organizationKeyPrefix(organizationId: string): string {
  return `${UPLOAD_KEY_PREFIX}/orgs/${organizationId}`;
}

/** Dung lượng tối đa mỗi ảnh (5MB) — S3 tự enforce qua content-length-range của POST policy. */
export const UPLOAD_MAX_BYTES = 5 * 1024 * 1024;

/** Thời hạn POST policy (giây). 15 phút: đủ cho mạng chậm, ngắn để link không đi xa. */
export const UPLOAD_POLICY_EXPIRES_SECONDS = 900;

/**
 * Loại ảnh được nhận. Chốt danh sách chứ không chỉ kiểm tiền tố `image/`: `image/svg+xml` là
 * ảnh nhưng chứa script chạy được khi mở trực tiếp từ bucket.
 */
export const UPLOAD_IMAGE_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
