-- CreateEnum
CREATE TYPE "PromotionState" AS ENUM ('ACTIVE', 'SCHEDULED', 'ENDED');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENT', 'FIXED');

-- AlterTable
ALTER TABLE "GiftCard" ADD COLUMN     "tutorId" TEXT;

-- CreateTable
CREATE TABLE "Promotion" (
    "id" TEXT NOT NULL,
    "tutorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "discountType" "DiscountType" NOT NULL DEFAULT 'PERCENT',
    "discountValue" INTEGER NOT NULL,
    "state" "PromotionState" NOT NULL DEFAULT 'SCHEDULED',
    "startsAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "redemptions" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Promotion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Referral" (
    "id" TEXT NOT NULL,
    "tutorId" TEXT NOT NULL,
    "creditCents" INTEGER NOT NULL DEFAULT 1500,
    "referredCount" INTEGER NOT NULL DEFAULT 0,
    "issuedCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Promotion_code_key" ON "Promotion"("code");

-- CreateIndex
CREATE INDEX "Promotion_tutorId_idx" ON "Promotion"("tutorId");

-- CreateIndex
CREATE UNIQUE INDEX "Referral_tutorId_key" ON "Referral"("tutorId");

-- AddForeignKey
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "Tutor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "Tutor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftCard" ADD CONSTRAINT "GiftCard_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "Tutor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

