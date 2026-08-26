-- AlterTable
ALTER TABLE "users" ADD COLUMN     "age" SMALLINT,
ADD COLUMN     "gender" VARCHAR(10),
ADD COLUMN     "onboarded" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "phone" VARCHAR(15);
