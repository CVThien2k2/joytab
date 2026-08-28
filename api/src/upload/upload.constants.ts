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
 * Tiền tố chung của mọi object joytab ghi lên bucket. Bucket đang dùng chung với hub, nên tách
 * prefix để hai app không trộn file vào nhau — và sau này xoá/đếm theo app cũng dễ.
 */
export const UPLOAD_KEY_PREFIX = 'joytab';

/** Dung lượng tối đa mỗi ảnh (5MB) — S3 tự enforce qua content-length-range của POST policy. */
export const UPLOAD_MAX_BYTES = 5 * 1024 * 1024;

/** Thời hạn POST policy (giây). 15 phút: đủ cho mạng chậm, ngắn để link không đi xa. */
export const UPLOAD_POLICY_EXPIRES_SECONDS = 900;

/**
 * Loại ảnh được nhận. Chốt danh sách chứ không chỉ kiểm tiền tố `image/`: `image/svg+xml` là
 * ảnh nhưng chứa script chạy được khi mở trực tiếp từ bucket.
 */
export const UPLOAD_IMAGE_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
