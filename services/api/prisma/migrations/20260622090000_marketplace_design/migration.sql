-- AlterTable
ALTER TABLE "Tutor"
    ADD COLUMN "headline" TEXT,
    ADD COLUMN "avatarColor" TEXT,
    ADD COLUMN "languages" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    ADD COLUMN "badges" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    ADD COLUMN "responseTime" TEXT,
    ADD COLUMN "totalLessons" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Student"
    ADD COLUMN "passwordHash" TEXT,
    ADD COLUMN "phone" TEXT,
    ADD COLUMN "avatarColor" TEXT,
    ADD COLUMN "walletCents" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "notifyEmail" BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN "notifySms" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "notifyReminders" BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN "notifyPromos" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Favorite" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "tutorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Favorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GiftCard" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "balanceCents" INTEGER NOT NULL,
    "design" INTEGER NOT NULL DEFAULT 0,
    "fromName" TEXT,
    "toName" TEXT,
    "message" TEXT,
    "ownerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GiftCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentMethod" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "last4" TEXT NOT NULL,
    "expMonth" INTEGER NOT NULL,
    "expYear" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentMethod_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Favorite_studentId_tutorId_key" ON "Favorite"("studentId", "tutorId");

-- CreateIndex
CREATE UNIQUE INDEX "GiftCard_code_key" ON "GiftCard"("code");

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "Tutor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftCard" ADD CONSTRAINT "GiftCard_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentMethod" ADD CONSTRAINT "PaymentMethod_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
