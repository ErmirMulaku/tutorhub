-- CreateTable
CREATE TABLE "TutorEmailVerification" (
    "id" TEXT NOT NULL,
    "tutorId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TutorEmailVerification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TutorEmailVerification_tutorId_idx" ON "TutorEmailVerification"("tutorId");

-- AddForeignKey
ALTER TABLE "TutorEmailVerification" ADD CONSTRAINT "TutorEmailVerification_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "Tutor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
