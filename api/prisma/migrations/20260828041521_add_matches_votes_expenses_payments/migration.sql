-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "male_ratio" DECIMAL(4,2) NOT NULL DEFAULT 1.0,
ADD COLUMN     "payment_qr_url" TEXT;

-- CreateTable
CREATE TABLE "matches" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "court_name" VARCHAR(120) NOT NULL,
    "start_at" TIMESTAMPTZ(6) NOT NULL,
    "end_at" TIMESTAMPTZ(6) NOT NULL,
    "max_players" SMALLINT NOT NULL,
    "male_ratio" DECIMAL(4,2) NOT NULL,
    "note" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'open',
    "created_by" UUID NOT NULL,
    "settled_at" TIMESTAMPTZ(6),
    "settled_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_votes" (
    "id" UUID NOT NULL,
    "match_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "voted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_vote_events" (
    "id" UUID NOT NULL,
    "match_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "action" VARCHAR(10) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_vote_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_expenses" (
    "id" UUID NOT NULL,
    "match_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "quantity" SMALLINT NOT NULL,
    "unit_price" INTEGER NOT NULL,
    "position" SMALLINT NOT NULL,

    CONSTRAINT "match_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_charges" (
    "id" UUID NOT NULL,
    "match_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "gender_at_settle" VARCHAR(10),
    "ratio" DECIMAL(4,2) NOT NULL,
    "amount" INTEGER NOT NULL,
    "payment_status" VARCHAR(20) NOT NULL DEFAULT 'unpaid',
    "payment_id" UUID,

    CONSTRAINT "match_charges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "proof_url" TEXT NOT NULL,
    "note" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'submitted',
    "reject_reason" TEXT,
    "submitted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmed_at" TIMESTAMPTZ(6),
    "confirmed_by" UUID,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "matches_organization_id_start_at_idx" ON "matches"("organization_id", "start_at");

-- CreateIndex
CREATE INDEX "match_votes_user_id_idx" ON "match_votes"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "match_votes_match_id_user_id_key" ON "match_votes"("match_id", "user_id");

-- CreateIndex
CREATE INDEX "match_vote_events_match_id_created_at_idx" ON "match_vote_events"("match_id", "created_at");

-- CreateIndex
CREATE INDEX "match_expenses_match_id_position_idx" ON "match_expenses"("match_id", "position");

-- CreateIndex
CREATE INDEX "match_charges_user_id_payment_status_idx" ON "match_charges"("user_id", "payment_status");

-- CreateIndex
CREATE UNIQUE INDEX "match_charges_match_id_user_id_key" ON "match_charges"("match_id", "user_id");

-- CreateIndex
CREATE INDEX "payments_organization_id_status_submitted_at_idx" ON "payments"("organization_id", "status", "submitted_at");

-- CreateIndex
CREATE INDEX "payments_user_id_submitted_at_idx" ON "payments"("user_id", "submitted_at");

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_votes" ADD CONSTRAINT "match_votes_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_votes" ADD CONSTRAINT "match_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_vote_events" ADD CONSTRAINT "match_vote_events_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_expenses" ADD CONSTRAINT "match_expenses_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_charges" ADD CONSTRAINT "match_charges_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_charges" ADD CONSTRAINT "match_charges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_charges" ADD CONSTRAINT "match_charges_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
