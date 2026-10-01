# JOB-51 · O rastreador: rastreio por agenda e fila de envio

**Estado:** backlog (01/10/2026) — depende do [JOB-50](JOB-50-ingestao-de-vagas-rastreadas.md)
**Tamanho:** G
**Pai:** [JOB-49](JOB-49-rastreador-de-vagas-arquitetura.md)

## Por quê

É a aplicação nova: rastreia os ATS antes da busca, em vez de durante. Ver o
pai para a decisão e o desenho.

## O que fazer

**Repositório próprio** (decisão de 01/10). Os cards continuam neste quadro
até o repositório novo ter o dele.

**Banco próprio**, com três coisas:

- `boards` — (ats, slug, empresa, estado, último sucesso, falhas seguidas).
  Carga inicial: as 526 de `empresas.json` + as 457 `confirmada` de
  `ats_discoveries`.
- `vagas` — o que cada board devolveu, com `vistaEm`, `fechadaEm` e um hash
  do conteúdo para saber se mudou.
- `fila_de_envio` — o que ainda não foi aceito pelo Horizons.

**O rastreio**, um comando que roda uma passada e sai:

1. Para cada board vivo, chama a API do ATS (os três adaptadores de
   `busca-ats.service.ts`: Greenhouse, Lever, Ashby — **copiados, não
   movidos**: o motor ao vivo continua no Horizons com os dele).
2. Vaga nova ou com hash diferente: grava e enfileira `upsert`.
3. Vaga igual: atualiza `vistaEm`; enfileira `confirmar` se a última
   confirmação enviada tem mais de 2 dias.
4. Vaga não vista há 48h **num board que respondeu nesta passada**: marca
   `fechadaEm` e enfileira `fechar`.
5. Board que falhou: conta a falha, não fecha nada.

**O envio**, outro comando: lê a fila em lotes, chama
`POST /api/ingest/jobs` e apaga da fila só o que a resposta confirmou.

**A limpeza**: apaga vaga fechada há mais de 30 dias.

**Reenvio completo**: um comando que põe todas as vagas abertas de volta na
fila, para o dia em que o banco do Horizons for recriado.

## As armadilhas

- **Passada por cima de passada.** Se o rastreio demorar mais que o intervalo
  do cron, a seguinte começa junto. Advisory lock do Postgres, ou sair se já
  houver uma rodando.
- **Fechamento em massa por resposta ruim.** Um `[]` de um ATS com problema
  parece "a empresa fechou tudo". A regra das 48h é a defesa; o teste precisa
  cobrir board que devolve lista vazia uma vez e volta ao normal.
- **O servidor é dividido com a busca.** Concorrência com teto configurável.
  O `busca-ats.service.ts` mediu que 25 simultâneas não tomam 429; aqui o
  limite é a CPU do vizinho, não o ATS.
- **Filtro grosso.** Só vaga de tecnologia é enviada. O critério precisa
  estar escrito e testado, e mudá-lo pede reenvio completo.
- **`User-Agent` identificando o projeto**, como o JOB-39 já faz.

## Critérios de aceite

- [ ] Uma passada sobre o catálogo inicial termina e relata: boards lidos,
      falhas, vagas novas, alteradas, fechadas, tempo total
- [ ] **Medido:** quantas vagas a passada produz e em quanto tempo, com a
      concorrência escolhida
- [ ] Vaga some de um board que respondeu: só fecha depois de 48h
- [ ] Board falha: nenhuma vaga dele é fechada
- [ ] Vaga fechada que reaparece é reaberta como a mesma linha
- [ ] Horizons fora do ar: a fila acumula, e esvazia quando ele volta
- [ ] Duas passadas simultâneas: a segunda sai sem rastrear
- [ ] Reenvio completo repõe tudo, e o Horizons termina idêntico
- [ ] Testes automatizados com as APIs de ATS simuladas (teste que bate em ATS
      real mede o humor do Greenhouse, não o código)
- [ ] `docs/DEPLOY.md` explica como criar a aplicação e o cron no Coolify

## Em aberto

- O intervalo do cron. Decidir depois de medir quanto dura uma passada.
