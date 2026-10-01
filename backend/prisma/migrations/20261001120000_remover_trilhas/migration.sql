-- PLT-13 · As trilhas de estudo saem da aplicacao.
--
-- Decisao do stakeholder em 01/10: a umbrella passa de tres produtos a dois
-- (Jobs e Invoice). O conteudo autoral — 75 aulas, 7.226 linhas — fica
-- recuperavel pelo historico do git, e nao aqui.
--
-- ⚠️ **A ORDEM E O QUE FAZ ESTA MIGRATION RODAR.** Sao quatro tabelas ligadas
-- por FK em cadeia:
--
--     progress.lessonId -> lessons.id
--     progress.userId   -> users.id
--     lessons.moduleId  -> modules.id
--     modules.trackId   -> tracks.id
--
-- Entao a ordem e das folhas para a raiz: progress, lessons, modules, tracks.
-- Comecar por `tracks` falharia com *violates foreign key constraint* — e o
-- `migrate deploy` do compose aborta a subida inteira, deixando o banco na
-- versao anterior e a API sem subir.
--
-- Nao se usa CASCADE no DROP: ele apagaria em silencio qualquer objeto que
-- dependesse destas tabelas, inclusive um que ninguem previu. Apagar na ordem
-- certa falha alto se sobrar dependencia, que e o que se quer.
--
-- Isto DESTROI dados em producao, de proposito e com decisao registrada no
-- card PLT-13. Nao ha caminho de volta pelo `migrate`.

-- 1. O progresso: e folha, nada aponta para ela.
DROP TABLE "progress";

-- 2. As aulas: `progress` acabou de sair, entao nada mais as referencia.
DROP TABLE "lessons";

-- 3. Os modulos.
DROP TABLE "modules";

-- 4. As trilhas, a raiz da cadeia.
DROP TABLE "tracks";

-- 5. O tipo enum do `kind` das aulas.
--
-- Vai DEPOIS das tabelas: o Postgres recusa apagar um tipo que ainda e usado
-- por uma coluna, e `lessons.kind` era a unica.
DROP TYPE "LessonKind";
