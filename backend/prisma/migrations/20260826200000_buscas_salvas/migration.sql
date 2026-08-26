-- Buscas salvas do modal de filtros avancados (JOB-41).
CREATE TABLE "savedsearches" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "filtros" JSONB,
    "porEmail" BOOLEAN NOT NULL DEFAULT false,
    "porTelegram" BOOLEAN NOT NULL DEFAULT false,
    "avisadoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "savedsearches_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "savedsearches_userId_idx" ON "savedsearches"("userId");

ALTER TABLE "savedsearches" ADD CONSTRAINT "savedsearches_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
