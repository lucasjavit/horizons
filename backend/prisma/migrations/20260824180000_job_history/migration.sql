-- Historico por usuario (JOB-26): o que a pessoa ja viu ou descartou.
--
-- Uma tabela com `estado`, e nao duas: visto e descartado sao estados do mesmo
-- par (usuario, vaga), e o @@unique abaixo e o que impede a mesma vaga estar
-- nos dois ao mesmo tempo.
CREATE TABLE "job_history" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "estado" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_history_pkey" PRIMARY KEY ("id")
);

-- Marcar a mesma vaga duas vezes nao duplica: vira upsert.
CREATE UNIQUE INDEX "job_history_userId_url_key" ON "job_history"("userId", "url");
-- A consulta quente e "todas as marcas desta pessoa".
CREATE INDEX "job_history_userId_estado_idx" ON "job_history"("userId", "estado");

ALTER TABLE "job_history" ADD CONSTRAINT "job_history_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
