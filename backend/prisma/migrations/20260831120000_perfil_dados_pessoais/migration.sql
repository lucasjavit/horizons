-- PLT-10: os dados pessoais vivem no User, e nao numa tabela de checkout.
-- Se a compra criasse os proprios, a pessoa preencheria duas vezes e os dois
-- divergiriam.
--
-- Todas nulas: perfil vazio e um perfil valido. Nenhuma tem default, porque
-- "nao informado" e diferente de "informado como vazio".
ALTER TABLE "users" ADD COLUMN "country" TEXT;
ALTER TABLE "users" ADD COLUMN "phone" TEXT;
-- Cifrada com AES-256-GCM e salt proprio (SALT_DOCUMENTOS). Nunca sai da API.
ALTER TABLE "users" ADD COLUMN "documentEnc" TEXT;
ALTER TABLE "users" ADD COLUMN "documentHint" TEXT;
-- O pais vigente quando o documento foi gravado: e o que permite detectar que
-- a pessoa trocou de pais e o documento guardado nao vale mais.
ALTER TABLE "users" ADD COLUMN "documentCountry" TEXT;
