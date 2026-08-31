-- PLT-11 · Tres papeis, e o registro de quem desativou quem.
--
-- 1. "USER" vira "COMMON_USER". O PLT-09 fixou os tres nomes
--    (ADMIN · MANAGER · COMMON_USER) e so o nome do papel comum muda; MANAGER
--    e valor novo, que ninguem tem ainda.
--
--    ⚠️ O UPDATE vem ANTES do novo DEFAULT de proposito. Trocar o default
--    primeiro nao mexe em linha nenhuma que ja existe — as duas contas do
--    banco continuariam "USER", que a partir daqui nao e papel de nada, e
--    elas perderiam o acesso a leitura publica sem erro nenhum no log.
UPDATE "users" SET "role" = 'COMMON_USER' WHERE "role" = 'USER';

ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'COMMON_USER';

-- 2. Quem desativou, e quando (PLT-11).
ALTER TABLE "users" ADD COLUMN "deactivatedAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "deactivatedById" TEXT;

-- ON DELETE SET NULL e nao CASCADE: apagar o admin que desligou uma conta nao
-- pode levar a conta desligada junto.
ALTER TABLE "users"
  ADD CONSTRAINT "users_deactivatedById_fkey"
  FOREIGN KEY ("deactivatedById") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
