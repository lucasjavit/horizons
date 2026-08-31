-- PLT-10 (segunda leva): o endereco de cobranca.
--
-- EM CLARO, e nao cifrado como o documento. Decisao do stakeholder em 31/08:
-- em claro da para consultar e agrupar depois (quantos usuarios em Sao Paulo),
-- e a cifra impediria isso. Contradiz o JOB-02, que trata endereco no mesmo
-- nivel do CPF — a contradicao esta registrada no card, nao e descuido.
--
-- Campos separados e nao um bloco de texto: a nota fiscal le a cidade sozinha
-- para calcular imposto, e reconstituir isso de texto livre e adivinhacao.
--
-- Todas nulas e sem default: nenhum campo e obrigatorio aqui. Perfil vazio
-- continua sendo perfil valido, e endereco pela metade tambem.
ALTER TABLE "users" ADD COLUMN "addressStreet" TEXT;
ALTER TABLE "users" ADD COLUMN "addressNumber" TEXT;
ALTER TABLE "users" ADD COLUMN "addressComplement" TEXT;
ALTER TABLE "users" ADD COLUMN "addressDistrict" TEXT;
ALTER TABLE "users" ADD COLUMN "addressCity" TEXT;
ALTER TABLE "users" ADD COLUMN "addressState" TEXT;
ALTER TABLE "users" ADD COLUMN "addressPostalCode" TEXT;
-- Separado de "country" de proposito: aquele e onde a pessoa MORA (decide
-- quais vagas a aceitam), este e para onde vai a NOTA. Quem mora em Portugal
-- e fatura no Brasil precisa dos dois.
ALTER TABLE "users" ADD COLUMN "addressCountry" TEXT;
