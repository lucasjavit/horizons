-- Vaga que a pessoa guardou. Sai da regra dos 15 dias do `found_jobs`.
CREATE TABLE "saved_jobs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "local" TEXT,
    "fonte" TEXT,
    "regime" TEXT,
    "skills" TEXT[],
    "area" TEXT,
    "anosExp" INTEGER,
    "benefits" TEXT[],
    "degree" TEXT,
    "logoUrl" TEXT,
    "paisIso" TEXT,
    "snapshot" JSONB,
    "postedAt" TIMESTAMP(3),
    "foundAt" TIMESTAMP(3) NOT NULL,
    "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_jobs_pkey" PRIMARY KEY ("id")
);

-- Salvar a mesma vaga duas vezes nao duplica.
CREATE UNIQUE INDEX "saved_jobs_userId_url_key" ON "saved_jobs"("userId", "url");
CREATE INDEX "saved_jobs_userId_savedAt_idx" ON "saved_jobs"("userId", "savedAt");

ALTER TABLE "saved_jobs" ADD CONSTRAINT "saved_jobs_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
