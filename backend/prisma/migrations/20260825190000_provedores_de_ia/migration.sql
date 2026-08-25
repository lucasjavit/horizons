-- Provedores de IA gratuitos, como fallback dos pagos.
--
-- Motivo: em 25/08/2026 as duas chaves pagas cadastradas estavam mortas
-- (Anthropic 401 "API key is invalid", OpenAI 429 "exceeded your current
-- quota"), e a leitura de CV nao existia nesta instalacao. Um provedor
-- gratuito sem cartao faz a feature existir de novo.
--
-- `ADD VALUE` e aditivo: nenhuma linha existente muda, e a coluna continua
-- aceitando ANTHROPIC/OPENAI/FIRECRAWL como antes.
ALTER TYPE "ApiProvider" ADD VALUE IF NOT EXISTS 'GEMINI';
ALTER TYPE "ApiProvider" ADD VALUE IF NOT EXISTS 'GROQ';
ALTER TYPE "ApiProvider" ADD VALUE IF NOT EXISTS 'CEREBRAS';
ALTER TYPE "ApiProvider" ADD VALUE IF NOT EXISTS 'MISTRAL';
