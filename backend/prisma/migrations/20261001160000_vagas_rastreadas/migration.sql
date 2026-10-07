-- JOB-50 — a copia local das vagas que o rastreador entrega.
--
-- Separada de "found_jobs" de proposito: aquela e cache de uma rodada de
-- busca (chave (grupo, url), morre por "expiresAt" de 15 dias); esta e o
-- acervo rastreado, que nao pertence a grupo nenhum e so morre por
-- fechamento ou por falta de confirmacao.
--
-- SEM foreign key para "saved_jobs" nem "job_history": apagar a vaga fechada
-- e o caso normal (JOB-49, decisao 6), e o que a pessoa guardou e um retrato
-- independente. Uma FK aqui faria "a vaga fechou" apagar o que ela salvou.
CREATE TABLE "tracked_jobs" (
    "id" TEXT NOT NULL,
    "fonte" TEXT NOT NULL,
    "idExterno" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "local" TEXT,
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
    "confirmadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tracked_jobs_pkey" PRIMARY KEY ("id")
);

-- A chave da idempotencia: o mesmo lote duas vezes nao duplica nada.
CREATE UNIQUE INDEX "tracked_jobs_fonte_idExterno_key" ON "tracked_jobs"("fonte", "idExterno");

-- A consulta da limpeza: quem nao e mencionado ha N dias.
CREATE INDEX "tracked_jobs_confirmadaEm_idx" ON "tracked_jobs"("confirmadaEm");

-- A busca do JOB-52 vai filtrar por aqui.
CREATE INDEX "tracked_jobs_company_idx" ON "tracked_jobs"("company");
