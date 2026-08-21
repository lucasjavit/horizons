-- Quando o perfil foi buscado pela ultima vez.
--
-- A fila da busca agendada passa a girar por este campo. Nulo significa
-- "nunca buscado" e vai na frente, entao perfil existente entra na fila com
-- prioridade em vez de ficar para tras.
ALTER TABLE "job_profiles" ADD COLUMN "buscadoEm" TIMESTAMP(3);

CREATE INDEX "job_profiles_ativo_buscadoEm_idx" ON "job_profiles"("ativo", "buscadoEm");
