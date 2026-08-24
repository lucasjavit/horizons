-- Telegram como segundo canal de notificacao (JOB-32).
--
-- Duas tabelas, e nao colunas em `email_subscriptions`: os canais sao
-- independentes (um pode estar ligado com o outro desligado, e falhar num nao
-- pode avancar o carimbo do outro), e o convite pendente tem ciclo de vida
-- proprio — nasce, expira em 30 min e morre usado.

-- O vinculo. Uma linha por usuario, criada so depois do START no bot.
CREATE TABLE "telegram_links" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    -- BIGINT porque o chat_id do Telegram passa de 32 bits, e a documentacao
    -- avisa que pode passar de 2^53. Em INTEGER estouraria em silencio.
    "chatId" BIGINT NOT NULL,
    "username" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ultimoEnvioEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telegram_links_pkey" PRIMARY KEY ("id")
);

-- Um vinculo por pessoa.
CREATE UNIQUE INDEX "telegram_links_userId_key" ON "telegram_links"("userId");

-- **O mesmo chat_id nao vincula a duas contas** (decidido em 24/08). E o
-- banco que garante, e nao so a checagem no servico: duas vinculacoes
-- simultaneas passariam pela checagem e chegariam as duas aqui.
CREATE UNIQUE INDEX "telegram_links_chatId_key" ON "telegram_links"("chatId");

-- A varredura do envio le so os ativos.
CREATE INDEX "telegram_links_ativo_idx" ON "telegram_links"("ativo");

ALTER TABLE "telegram_links" ADD CONSTRAINT "telegram_links_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- O convite pendente: o <token> de t.me/<bot>?start=<token>.
CREATE TABLE "telegram_convites" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    -- Marcado, e nao apagado: e o que faz um token ja usado ser RECUSADO em
    -- vez de simplesmente nao ser encontrado.
    "usadoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telegram_convites_pkey" PRIMARY KEY ("id")
);

-- E por ele que o /start acha a conta. Colisao daria o vinculo de alguem a
-- outra pessoa.
CREATE UNIQUE INDEX "telegram_convites_token_key" ON "telegram_convites"("token");

-- A limpeza dos vencidos e a busca do convite aberto de uma pessoa.
CREATE INDEX "telegram_convites_userId_expiraEm_idx" ON "telegram_convites"("userId", "expiraEm");

ALTER TABLE "telegram_convites" ADD CONSTRAINT "telegram_convites_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
