# JOB-49 · Rastreador de vagas: a arquitetura

**Estado:** decidido, em backlog (01/10/2026) — card-mãe; o código está nos filhos.
O stakeholder ainda tem outras coisas na frente; nenhum filho começa agora.
**Tamanho:** G

Desenho com os passos numerados: <https://claude.ai/artifact/H7ArTpC8LT9mAypAChoYjU>

## Por quê

Stakeholder, 01/10: *"dá para fazer o mesmo que o freehire faz, para não
ficarmos dependentes dele no futuro?"*

O [JOB-40](JOB-40-catalogo-aprende-com-o-freehire.md) resolveu metade: o motor
de ATS passou a usar as 457 empresas colhidas, e a busca com sessão sobrevive
sem o freehire (0 → 682). Sobraram dois buracos que ele mesmo registra:

- **O motor de ATS consulta ao vivo, durante a busca.** O
  [JOB-39](JOB-39-freehire-como-motor-de-busca.md) mediu 128.366 ms contra
  2.567 ms do freehire. Catálogo maior não conserta isso; o `TETO_EMPRESAS`
  de 200 consultas existe por causa disso.
- **O anônimo fica com 0 vaga sem o freehire** (JOB-47: a cascata para em
  `somenteFreehire` antes do ATS, porque o ATS ao vivo é caro demais para
  quem não entrou).

Os dois têm a mesma causa: **rastreamos na hora da busca**. O freehire
rastreia antes, por agenda, e a busca dele só consulta um índice.

## Como o freehire faz (lido em 01/10, não rodado)

Fonte: README, `docs/architecture.md` e os cabeçalhos de `cmd/*/main.go` de
[strelov1/freehire](https://github.com/strelov1/freehire).

- Um catálogo `boards` (empresa + ATS + id do board) é a lista do que rastrear.
- `cmd/ingest <provider>` roda por cron e lê todos os boards daquele ATS pela
  API pública: fetch → normaliza → dedup por `(source, external_id)` → upsert.
- A vaga não vista por **48h** num board que respondeu é fechada. Board sem
  rastreio bem-sucedido por **60 dias** tem as vagas fechadas por outro worker.
- O catálogo cresce por ferramentas `harvest-*`: uma fonte externa dá slugs
  candidatos, e cada um só entra depois de responder na API oficial do ATS.
- O servidor só serve a API. Todo o resto é worker que roda uma passada e sai.

**O catálogo deles não está no repositório.** A pasta `sources/` devolve 404
(conferido em 01/10); os boards vivem no banco deles. Hospedar uma cópia do
freehire daria o código sem as 294 mil empresas, mais Go, Meilisearch, Redis,
pgvector e S3 para manter. Descartado.

## O que foi decidido (stakeholder, 01/10)

1. **Aplicação à parte, com banco próprio.** O rastreador rastreia por agenda
   e guarda tudo no Postgres dele.
2. **O Horizons não consulta o rastreador.** De tempos em tempos o rastreador
   **envia** os registros, e o Horizons busca na própria cópia.
3. **Mesmo servidor.** Outra aplicação no Coolify, falando com o Horizons pela
   rede interna.
4. **TypeScript com Node.** O trabalho é esperar rede e gravar no banco; os
   três adaptadores (Greenhouse, Lever, Ashby) já existem em TypeScript e
   são reaproveitados. Java custaria mais RAM num servidor dividido e não traria
   ganho.
5. **A busca agendada passa a ler só da cópia local.**
6. **Vaga fechada é apagada do Horizons.** É seguro: `SavedJob` guarda um
   retrato e `JobHistory` guarda só a URL; nenhum dos dois referencia a tabela
   de vagas.
7. **O motor de ATS ao vivo não é removido.** Fica como reserva, ligado e
   desligado pelo interruptor que já existe em `/config/vagas` (`jobs.ats`).
8. **Repositório próprio para o rastreador.** Coerente com ele poder virar
   produto. Custo aceito: os três adaptadores de ATS ficam **copiados** nos
   dois lados, porque o motor ao vivo continua no Horizons. Correção feita num
   lado precisa ser levada ao outro à mão.
9. **Não há mensagem de volta.** Quem descobre o fechamento é o rastreador,
   que é quem fala com o ATS. O único retorno do Horizons é a resposta da
   própria chamada de envio ("recebi este lote").

### A alternativa que foi pesada e recusada: banco único

Levantada em 01/10, depois de ver que a colheita, a verificação de slug, o
cron das 3h e os adaptadores **já existem no Horizons** (JOB-40). Um worker no
mesmo repositório e no mesmo banco entregaria o mesmo resultado na busca com
bem menos peça: sem endpoint de ingestão, sem token, sem fila de envio, sem
reconfirmação, sem prazo de validade, e sem o JOB-53.

**Recusada pelo stakeholder:** *"vai ser melhor separados porque eu posso fazer
dois produtos no futuro"*. O rastreador é pensado como produto próprio, e não
como peça interna do Horizons.

O custo aceito com isso: mover código que funciona (JOB-53) e manter um
contrato entre duas aplicações.

O que a decisão exige do desenho, para o motivo valer:

- **O rastreador não conhece regra do Horizons.** Elegibilidade, LATAM, moeda
  forte: nada disso entra nele. O filtro grosso (só tecnologia) é
  configuração, não código fixo.
- **O destino do envio é configuração.** A URL e o token do Horizons entram
  por variável de ambiente; o rastreador envia para "um assinante", que hoje
  é um só.
- **O contrato de envio é a API do produto.** Vale versionar desde o começo.

## O fluxo

**Aprender empresas (diário)**
1. A colheita consulta o freehire e recebe vagas com a URL real do ATS.
2. Da URL sai o par (ATS, slug); o que o catálogo já tem é descartado.
3. O slug é testado na API do próprio ATS. Respondeu com vagas, entra.

**Rastrear (a cada poucas horas)**
4. O rastreio percorre o catálogo e lê as vagas abertas de cada board.
5. O banco do rastreador é atualizado: nova, alterada, ou fechada.
6. O que mudou entra na fila de envio.

**Entregar**
7. O rastreador envia lotes ao endpoint de ingestão, com token próprio, e só
   tira da fila o que o Horizons confirmou.
8. O Horizons aplica a elegibilidade e grava por `(fonte, id externo)`; as
   fechadas são apagadas.

**Buscar**
9. A API de busca consulta só o banco do Horizons.
10. Se a cópia não achar nada, cai nas reservas que estiverem ligadas: o
    freehire e, depois, o ATS ao vivo.

## Quando a vaga fecha

| Situação | Regra | Origem do número |
| --- | --- | --- |
| Sumiu da lista do ATS | fecha após **48h** sem ser vista, e só conta rastreio em que o board respondeu | freehire |
| Board parou de responder | fecha após **7 a 14 dias** sem sucesso | sugestão; o freehire usa 60 |
| Rastreador parou de falar | o Horizons apaga a vaga sem confirmação há **7 dias** | sugestão |
| Publicada há muito tempo | **não fecha**; a tela mostra a idade | — |

"Confirmação" é uma coluna de data na vaga do Horizons, atualizada toda vez
que o rastreador menciona a vaga: nova, alterada, ou reconfirmada (só o id,
sem conteúdo). Sem a reconfirmação o prazo apagaria vaga boa que não mudou.

No rastreador a vaga fechada **não é apagada na hora**: fica marcada e é limpa
depois de ~30 dias. A regra das 48h precisa da linha, e a vaga que some e
volta é reconhecida como a mesma.

**Nenhum desses prazos foi medido aqui.** O de 48h é emprestado; antes de
fixar, medir no nosso rastreio com que frequência os ATS têm ausência falsa.

## Quem é dono do quê

| Rastreador | Horizons |
| --- | --- |
| catálogo de boards e a colheita | a cópia das vagas que a busca lê |
| os adaptadores de ATS do rastreio | o motor de ATS ao vivo, como reserva |
| filtro grosso: só envia vaga de tecnologia | a regra de elegibilidade, aplicada ao receber |
| estado de cada board | vagas salvas, histórico, alertas |
| | os interruptores do freehire e do ATS ao vivo |

A elegibilidade fica no Horizons de propósito: é regra de produto (JOB-09, a
vaga só afirma o que cita), e assim mudar a regra não exige reenviar nada.

## O que o rastreador já herda

Ele não começa do zero. Medido no JOB-40 em 01/10:

- 526 empresas curadas em `empresas.json`;
- 457 `confirmada` em `ats_discoveries`, com 37.030 vagas atrás;
- o extrator e a verificação de slug (`descobertas.ts`,
  `verificacao-de-ats.service.ts`), agora com teste.

## O que corrige o que foi dito no chat

- **Gupy, Inhire e Solides não entram.** Cheguei a sugerir adaptador para eles;
  o JOB-40 mediu que não têm API pública (`portal.gupy.io` e
  `radix.inhire.app` devolvem HTML, `api.inhire.app` dá 406) e somam 52
  empresas. Lê-los seria raspagem.
- **O próximo adaptador, pelo número, é o Workday** (184 empresas, 18.086
  aparições) — mas a contagem por família está corrompida até o
  [JOB-48](JOB-48-host-multiempresa-colapsa-numa-linha.md) ser corrigido.
  Decidir adaptador novo depois dele.

## Em aberto

- **Os prazos** da tabela acima.
- **CPU e memória divididas.** O rastreador roda no mesmo servidor da busca;
  a concorrência dele precisa de teto.

## Os filhos, na ordem de dependência

1. [JOB-50](JOB-50-ingestao-de-vagas-rastreadas.md) — o Horizons recebe vagas
2. [JOB-51](JOB-51-rastreador-rastreio-e-fila-de-envio.md) — o rastreador
3. [JOB-52](JOB-52-busca-le-da-copia-local.md) — a busca lê da cópia local
4. [JOB-53](JOB-53-colheita-muda-para-o-rastreador.md) — a colheita muda de casa

## Critérios de aceite

- [ ] Os quatro filhos fechados
- [ ] Com o freehire desligado, a busca **anônima** devolve vaga (hoje: 0)
- [ ] A busca responde sem nenhuma chamada externa no caminho normal
- [ ] Rastreador parado por 24h: a busca continua servindo o que já chegou

## Relacionados

- [JOB-39](JOB-39-freehire-como-motor-de-busca.md) — o risco da dependência
- [JOB-40](JOB-40-catalogo-aprende-com-o-freehire.md) — a colheita que já existe
- [JOB-20](JOB-20-motor-de-ats.md) — o motor ao vivo, que fica como reserva
- [JOB-47](JOB-47-busca-sem-login.md) — por que o anônimo fica com 0
