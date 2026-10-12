-- CreateTable
CREATE TABLE "AiUsageLog" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "principalKind" TEXT NOT NULL,
    "principalId" TEXT NOT NULL,
    "task" TEXT NOT NULL,
    "model" TEXT,
    "promptVersion" INTEGER NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "costUsd" DECIMAL(10,6) NOT NULL DEFAULT 0,
    "latencyMs" INTEGER NOT NULL,
    "cacheHit" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiUsageLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiUsageLog_principalKind_principalId_createdAt_idx" ON "AiUsageLog"("principalKind", "principalId", "createdAt");

-- CreateIndex
CREATE INDEX "AiUsageLog_task_createdAt_idx" ON "AiUsageLog"("task", "createdAt");

-- CreateIndex
CREATE INDEX "Booking_tutorId_startTime_idx" ON "Booking"("tutorId", "startTime");

-- CreateIndex
CREATE INDEX "Booking_studentId_startTime_idx" ON "Booking"("studentId", "startTime");

-- CreateIndex
CREATE INDEX "Booking_tutorId_status_createdAt_idx" ON "Booking"("tutorId", "status", "createdAt");
