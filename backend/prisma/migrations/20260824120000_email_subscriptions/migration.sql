-- A assinatura do e-mail de vagas (JOB-24) e a cadencia de quem foi
-- contratado (JOB-25). Uma linha por usuario.
CREATE TABLE "email_subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cadencia" TEXT NOT NULL DEFAULT 'semanal',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "token" TEXT NOT NULL,
    "ultimoEnvioEm" TIMESTAMP(3),
    "contratadoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_subscriptions_pkey" PRIMARY KEY ("id")
);

-- Uma assinatura por pessoa.
CREATE UNIQUE INDEX "email_subscriptions_userId_key" ON "email_subscriptions"("userId");

-- O token e como a rota publica encontra a pessoa, sem sessao. Unico porque
-- e chave de busca, e colisao daria o link de alguem a outra pessoa.
CREATE UNIQUE INDEX "email_subscriptions_token_key" ON "email_subscriptions"("token");

-- A varredura do envio filtra por estes dois.
CREATE INDEX "email_subscriptions_ativo_cadencia_idx" ON "email_subscriptions"("ativo", "cadencia");

ALTER TABLE "email_subscriptions" ADD CONSTRAINT "email_subscriptions_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
