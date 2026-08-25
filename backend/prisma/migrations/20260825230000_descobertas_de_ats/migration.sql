-- A fila de descobertas do catalogo de ATS (JOB-37).
--
-- A busca ANOTA aqui todo par (host, slug) que o catalogo nao tinha; o cron da
-- madrugada verifica um por um contra a API do ATS e classifica. Nada e
-- gravado em backend/data/ats/ automaticamente — promover e decisao humana.
CREATE TABLE "ats_discoveries" (
    "id" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "ats" TEXT,
    -- String VAZIA, e nao NULL, quando a URL nao carrega o slug. No Postgres
    -- NULL nunca e igual a NULL, entao o UNIQUE abaixo com slug nulo NAO
    -- impediria duplicata: cada aparicao viraria linha nova e o contador de
    -- aparicoes nunca passaria de 1.
    "slug" TEXT NOT NULL,
    "empresa" TEXT NOT NULL,
    "exemploUrl" TEXT NOT NULL,
    "aparicoes" INTEGER NOT NULL DEFAULT 1,
    "estado" TEXT NOT NULL DEFAULT 'nova',
    "vagas" INTEGER,
    "slugTestado" TEXT,
    "detalhe" TEXT NOT NULL DEFAULT '',
    "checkedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ats_discoveries_pkey" PRIMARY KEY ("id")
);

-- Aparecer de novo incrementa o contador em vez de criar linha: e o upsert
-- do servico que depende deste indice.
CREATE UNIQUE INDEX "ats_discoveries_host_slug_key" ON "ats_discoveries"("host", "slug");
-- A consulta do cron: quem nunca foi verificado vem primeiro.
CREATE INDEX "ats_discoveries_estado_checkedAt_idx" ON "ats_discoveries"("estado", "checkedAt");
