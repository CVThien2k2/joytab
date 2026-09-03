/*
  Bỏ bước duyệt thanh toán: người trả tự ghi nhận đã chuyển tiền.

  - match_charges.payment_status còn hai mức 'unpaid' | 'paid'. Dữ liệu cũ: 'submitted' và
    'confirmed' đều thành 'paid' — cả hai đều nghĩa là tiền đã chuyển, khác nhau chỉ ở chỗ owner
    đã kiểm chưa, mà việc kiểm thì không còn nữa. Khoản của những lần bị từ chối đang là 'unpaid'
    nên không cần đụng tới.
  - payments mất status / reject_reason / confirmed_at / confirmed_by: một row tồn tại đã là
    "đã chuyển", không còn trạng thái nào để giữ. Dữ liệu ở bốn cột này mất hẳn.
*/

-- Dữ liệu trước: gộp hai mức "đã chuyển" thành một.
UPDATE "match_charges" SET "payment_status" = 'paid'
WHERE "payment_status" IN ('submitted', 'confirmed');

-- DropIndex
DROP INDEX "payments_organization_id_status_submitted_at_idx";

-- AlterTable
ALTER TABLE "payments" DROP COLUMN "confirmed_at",
DROP COLUMN "confirmed_by",
DROP COLUMN "reject_reason",
DROP COLUMN "status";

-- CreateIndex
CREATE INDEX "payments_organization_id_submitted_at_idx" ON "payments"("organization_id", "submitted_at");
