-- Thay ảnh QR tĩnh bằng tài khoản ngân hàng (VietQR).
--
-- Ảnh QR cũ KHÔNG chuyển đổi được: từ một file PNG trên S3 không suy ngược ra BIN và số tài
-- khoản. Tổ chức nào đang dùng ảnh sẽ về trạng thái "chưa cấu hình" và owner nhập lại một lần
-- — đổi lại, từ đây mã QR mang sẵn đúng số tiền phải trả.
ALTER TABLE "organizations" ADD COLUMN "bank_bin" VARCHAR(6);
ALTER TABLE "organizations" ADD COLUMN "bank_account_no" VARCHAR(24);
ALTER TABLE "organizations" DROP COLUMN "payment_qr_url";
