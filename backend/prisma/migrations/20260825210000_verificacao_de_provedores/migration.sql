-- Verificacao das chaves de IA, e a ordem da cadeia.
--
-- Motivo: a tela de Configuracoes mostrava "stored" para duas chaves MORTAS
-- (Anthropic 401, OpenAI 429, medido em 25/08/2026). "Ha chave cadastrada" e
-- uma pergunta diferente de "a chave funciona", e so a segunda interessa a
-- quem abre a tela para descobrir por que a busca nao acha vaga.
--
-- `provider_checks` guarda o resultado da ultima verificacao. Guardado, e nao
-- verificado a cada carga: seis chamadas reais por visita custam dinheiro nas
-- pagas. A verificacao roda ao salvar a chave e no botao "Test all keys".
CREATE TABLE "provider_checks" (
    "provider" "ApiProvider" NOT NULL,
    "status" TEXT NOT NULL,
    "httpStatus" INTEGER,
    "detalhe" TEXT NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_checks_pkey" PRIMARY KEY ("provider")
);

-- `provider_orders` guarda a ordem inteira da cadeia, e nao um unico
-- preferido. A tela ordena com setas ↑↓; uma preferencia so nao representa o
-- que a pessoa arrumou. Provedor sem linha cai no fim, na ordem do registro,
-- entao provedor novo nao precisa de migracao de dados.
CREATE TABLE "provider_orders" (
    "provider" "ApiProvider" NOT NULL,
    "posicao" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_orders_pkey" PRIMARY KEY ("provider")
);
