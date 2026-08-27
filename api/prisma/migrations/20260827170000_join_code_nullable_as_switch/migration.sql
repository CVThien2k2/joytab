-- Mã tham gia trở thành công tắc: NULL = tổ chức đang kín. Cột `join_by_code_enabled` bị bỏ vì
-- nó là nguồn sự thật thứ hai cho cùng một câu hỏi, và có thể lệch với mã (enabled = true mà
-- mã rỗng thì nghĩa là gì?).

-- 1) Cho phép NULL trước, để bước 2 có chỗ ghi.
ALTER TABLE "organizations" ALTER COLUMN "join_code" DROP NOT NULL;

-- 2) Chuyển trạng thái cũ sang trạng thái mới: đang tắt = xoá mã. Phải chạy TRƯỚC khi drop cột,
--    vì sau đó không còn cách nào biết org nào từng tắt.
UPDATE "organizations" SET "join_code" = NULL WHERE "join_by_code_enabled" = false;

-- 3) Bỏ cột công tắc.
ALTER TABLE "organizations" DROP COLUMN "join_by_code_enabled";
