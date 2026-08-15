-- CreateTable
CREATE TABLE "found_jobs" (
    "id" TEXT NOT NULL,
    "grupo" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "local" TEXT,
    "fonte" TEXT,
    "regime" TEXT,
    "skills" TEXT[],
    "snapshot" JSONB,
    "postedAt" TIMESTAMP(3),
    "foundAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "found_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "found_jobs_grupo_foundAt_idx" ON "found_jobs"("grupo", "foundAt");

-- CreateIndex
CREATE INDEX "found_jobs_expiresAt_idx" ON "found_jobs"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "found_jobs_grupo_url_key" ON "found_jobs"("grupo", "url");
