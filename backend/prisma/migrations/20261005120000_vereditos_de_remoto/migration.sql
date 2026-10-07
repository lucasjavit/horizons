-- O veredito da IA sobre "da para fazer esta vaga remotamente morando em X?"
-- (JOB-55). Uma linha por vaga + pais, reusada por todo mundo: a mesma vaga
-- nao e lida duas vezes para o mesmo pais.
CREATE TABLE "remote_verdicts" (
    "id" TEXT NOT NULL,
    "vagaId" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "veredito" TEXT NOT NULL,
    "trecho" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "remote_verdicts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "remote_verdicts_vagaId_country_key" ON "remote_verdicts"("vagaId", "country");
