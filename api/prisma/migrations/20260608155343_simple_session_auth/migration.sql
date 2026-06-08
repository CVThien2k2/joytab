-- DropForeignKey
ALTER TABLE "refresh_tokens" DROP CONSTRAINT "refresh_tokens_session_id_fkey";

-- DropTable
DROP TABLE "refresh_tokens";

-- Session cũ không có token_hash; xoá sạch để mọi user đăng nhập lại (chấp nhận được ở môi trường dev).
DELETE FROM "user_sessions";

-- AlterTable
ALTER TABLE "user_sessions" ADD COLUMN     "token_hash" TEXT NOT NULL;

-- DropIndex
DROP INDEX "devices_device_fingerprint_key";

-- AlterTable
ALTER TABLE "devices" DROP COLUMN "device_fingerprint";

-- CreateIndex
CREATE UNIQUE INDEX "user_sessions_token_hash_key" ON "user_sessions"("token_hash");
