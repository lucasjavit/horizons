# JOB-45 · Paginação sob demanda, com cache de 10 minutos

**Estado:** feito (27/08/2026)
**Tamanho:** M

## De onde veio

Pedido do stakeholder, com o desenho já definido por ele:

> "Eu não quero receber de uma vez, quero que fique armazenado em um cache por
> uns 10 min, para que o usuário possa ir buscando aos poucos assim que clicar
> na próxima página, até acabar."

## O problema, medido

`busca-freehire.service.ts` tinha `const LIMITE = 60`, e nenhuma segunda
chamada. O log dizia a verdade inteira:

```
freehire devolveu 60 vagas de 400054 no filtro
```

Com `POR_PAGINA = 25`, 60 vagas dão 3 páginas. A pessoa refinava, paginava, e
continuava vendo as mesmas 60 de 400 mil.

## O `offset` funciona — medido antes de escrever qualquer linha

Contra a API real (`https://freehire.me/api/v1/agent/jobs/search`), em
27/08/2026, com `regions=latam&limit=3`:

| `offset` | `meta` devolvido                          | Primeiro título                        |
| -------: | ----------------------------------------- | -------------------------------------- |
|        0 | `{limit:3, offset:0, total:49859}`        | HR Business Partner (Bradesco)         |
|       60 | `{limit:3, offset:60, total:49859}`       | Onboarding Operations Spec. (Twilio)   |
|      120 | `{limit:3, offset:120, total:49859}`      | Analista de Qualidade Sênior (btgpactual) |
|      580 | `{limit:2, offset:580, total:49859}`      | 2 vagas devolvidas                     |

**O `ignored_params` veio VAZIO em todas.** Isso é o que decide, porque o
serviço ignora parâmetro desconhecido em silêncio em vez de recusar. O controle
prova que a checagem funciona e não é um vazio por acaso:

```
offsetzz=60  →  meta: {"ignored_params":[{"param":"offsetzz"}], "offset":0, ...}
```

Nome errado aparece na lista; `offset` não aparece. A guarda `checarIgnorados`
já cobria — e continua cobrindo, agora numa consulta que **sempre** carrega o
parâmetro.

## As quatro decisões, e o porquê de cada uma

### 1. O cache vive na memória do processo

O que se guarda é efêmero por natureza: as URLs já entregues numa sessão de
busca, mais o offset alcançado. Vida útil de 10 minutos, e o custo de perder é
uma vaga repetida que a pessoa nem nota.

Postgres custaria migration, tabela, índice, rotina de limpeza e um round-trip
por página — para um dado que morre antes do próximo deploy. Não paga.

**Sobre o `docker-compose.prod.yml`:** com várias instâncias e sem sticky
session, a página 2 pode cair noutra instância e recomeçar do offset 0. O pior
caso é vaga repetida, não erro nem página em branco — degradação silenciosa e
tolerável, ao contrário de perder o resultado. Está escrito no código, no lugar
onde alguém iria mexer.

### 2. O que invalida: a assinatura de TODOS os filtros

**Não é o `assinaturaDoGrupo` do `grupo.ts`.** Aquele é deliberadamente
grosseiro — sai de cinco campos (senioridade, stack, cargos, regime, locais)
porque agrupa perfis que podem compartilhar uma busca. O `FiltrosDto` tem mais
de quarenta campos.

Usá-lo como chave de cache faria a página 2 de `countries=['br']` vir da busca
de `countries=['mx']`, porque `countries` não entra na assinatura de grupo. O
bug seria invisível: vagas plausíveis, do filtro errado.

A chave nova (`chaveDoCache`, em `cache-de-busca.ts`) percorre as chaves do
objeto em ordem, normaliza cada valor (minúsculas, sem acento, listas ordenadas
e sem repetido) e descarta campo vazio. `{a:['X','y']}` e `{a:['Y','x']}` dão a
mesma chave; `{}` e `{a:[]}` também.

### 3. Os três motores: a paginação é do freehire, e só dele

**A busca não roda três motores em paralelo — é uma cascata que PARA no
primeiro que acha algo** (`busca.service.ts`, o `return` depois de cada motor).
Ordem: freehire → ATS → Firecrawl/IA.

Consequência que dispensa metade do trabalho temido: quando o freehire devolve
resultado, o ATS e a IA **nem rodam**. Paginar o freehire não mistura motores,
porque não há mistura para começar.

O que foi feito, então:

- **A sessão de cache grava qual motor a serviu.** Só a sessão de origem
  `freehire` sabe pedir mais. Se a busca caiu para o ATS ou para a IA, a sessão
  nasce **esgotada** — não há offset a pedir, e a tela não oferece o botão. Um
  ATS que devolve 487 vagas de uma vez já entrega tudo na primeira resposta.
- **O dedup atravessa as páginas** e é por `url`, não por `id`: o `id` do
  freehire é `public_slug`, e vaga republicada por dois agregadores tem slug
  diferente com a mesma URL. O conjunto de URLs entregues vive na sessão, e
  `mais()` filtra contra ele antes de devolver.
- **A repescagem** — quando um lote inteiro é duplicata ou é peneirado pelos
  filtros locais (`exclude_keywords`, `locations`), a sessão avança o offset e
  tenta de novo, até 3 vezes. Sem isso, um filtro apertado devolveria "0 novas"
  e a tela concluiria "acabou" com 49 mil vagas no filtro.

### 4. Quando parar: teto de 300, e não o `meta.total`

O `meta.total` diz 49.859 (LATAM) ou 400.054 (o do log original). Esse número é
**o tamanho do filtro, não a meta**: paginar até o fim seriam 6.600 chamadas, e
ninguém lê 400 mil vagas.

O teto é **300 vagas — 5 chamadas de 60**. De onde sai:

- São **12 páginas** de 25 na tela. Quem chega à página 12 de uma busca de
  vagas já refinou o filtro ou desistiu; o teto não é o que o limita.
- São no máximo **5 requisições** ao serviço de terceiro por sessão de busca,
  contra o orçamento publicado de 300 req/min. Um teto alto num serviço grátis e
  sem SLA é o tipo de coisa que faz o serviço fechar a porta.
- O teto é NOSSO, e a tela diz isso: quando ele é alcançado, a mensagem é
  "Showing the first 300 matches — refine the filters to see different jobs",
  e não "acabou". A diferença importa: "acabou" com 49 mil no filtro seria
  mentira.

O `meta.total` continua sendo lido, e o que vier PRIMEIRO encerra: se o filtro
só tem 80 vagas, a sessão esgota em 80 e a tela diz "That's all 80 jobs" — aí
é o fim de verdade.

## Duas coisas que a medicao revelou, e que nao estavam no pedido

### A API repete a mesma URL dentro de uma resposta

Medido em 27/08, `regions=latam` + `q=Backend Engineer`: **60 linhas, 59 URLs
distintas**. As duas coincidentes:

| `public_slug`                          | titulo                |
| -------------------------------------- | --------------------- |
| `backend-engineer-encora-xyuro6y6`     | Backend Engineer      |
| `backend-engineer-mid-encora-ssjb25ol` | Backend Engineer Mid  |

Os dois apontam para `job-boards.greenhouse.io/encora10/jobs/5195751007`. Na
tela eram duas linhas que abrem a mesma pagina — um bug **anterior a este
card**, que so apareceu porque a paginacao obrigou a contar URLs unicas.

Corrigido no motor (`semRepetirUrl`), e nao no cache: a repeticao acontece
DENTRO de uma resposta, e no motor a correcao vale tambem para a busca agendada
e o alerta de busca salva, que nao passam pelo cache.

**Deduplicar por `id` nao pegaria nada**: o `id` e o `public_slug`, e os dois
slugs sao diferentes. E o que justifica o `Set<string>` de URLs da sessao.

### O `meta.total` mente quando ha busca textual

| Consulta                              | `meta.total` | linhas em `offset=60` |
| ------------------------------------- | -----------: | --------------------: |
| `countries=uy&q=Backend&limit=60`     |       **60** |                     0 |
| `countries=uy&limit=60` (sem `q`)     |          505 |                     — |
| `regions=latam&q=Engineer&limit=60`   |       15.010 |                    60 |

Com `q=` **e** poucos resultados, o `total` vem igual ao `limit` — o tamanho da
pagina, e nao o do filtro. Nao quebrou a paginacao, e por sorte na direcao
segura: naquela consulta o `offset=60` devolveu zero linhas, entao o filtro
tinha mesmo 60 e parar ali estava certo.

Fica anotado no campo `totalNoFiltro` porque o proximo uso pode nao ter essa
sorte: "showing 60 of N" na tela usaria o numero errado.

## O que a cascata faz com um filtro local apertado

Descoberto ao tentar exercitar a repescagem, e **e comportamento anterior a este
card**: quando `exclude_keywords` ou `locations` peneira as 60 do freehire ate
ZERO, a cascata conclui "o freehire nao achou nada" e cai para o ATS — mesmo
havendo 15 mil vagas no filtro da API deles.

Medido: `regions=latam` + `locations=['Montevideo']` devolveu 15 vagas, todas de
`greenhouse.io`/`lever.co`/`ashbyhq.com`. Nenhuma do freehire.

**Nao foi mexido aqui**, porque nao e o que o card pede e mudar a cascata e
mudar o que toda busca faz. Fica registrado: a saida provavel e o freehire
paginar internamente ate juntar um minimo antes de declarar zero.

## O interruptor

`jobs.paginacao` em `/config/vagas`, dentro de Job sources. **Ligado por
padrão**, como o ATS e o freehire: não gasta crédito nem chama provedor pago.

Desligado, a busca volta a ser exatamente a de antes — uma chamada de 60,
`temMais: false`, e a tela não mostra o botão. É o que a casa manda: desligar um
motor não derruba a feature.

## Como a página 2 anda no SSE

**Rota nova, e não o mesmo stream.** `POST /jobs/search/mais`, com JSON de uma
vez em vez de SSE.

O SSE existe porque a primeira busca leva de 2s (freehire) a ~60s (Firecrawl), e
tela parada por um minuto parece travamento. A página 2 do freehire é **uma
requisição HTTP de ~1,5s**: streaming ali só acrescentaria o custo de manter
uma conexão aberta e a complexidade de dois caminhos de leitura na tela, sem
nada a mostrar no meio.

O `inicio | vaga | fim` do stream original ficou intacto. O que ele ganhou foi
um campo no `fim`: `sessao` (o id da sessão de cache) e `temMais`.

## O que a tela ganhou

A `Paginacao` recebeu duas props novas (`temMais`, `carregandoMais`) e um botão
`Load more jobs` que só aparece na **última página** — que é onde a pergunta
"tem mais?" nasce. As demais páginas continuam fatiando o que está em memória,
sem nenhuma chamada.

A distinção que o card pedia está no rodapé da navegação, em uma linha:

- `Load more jobs` — há mais para buscar
- `That's all N jobs` — o filtro acabou de verdade
- `Showing the first 300 matches…` — o nosso teto

## Critérios de aceite

- [x] A primeira página não ficou mais lenta (2,34s → 2,25s de mediana, 3 corridas)
- [x] Página 2, 3, 4 e 5 trazem vagas novas, sem repetir
- [x] Uma requisição ao freehire por clique em `Load more`, e zero ao paginar
      dentro do que já está em memória
- [x] Mudar qualquer filtro recomeça do zero, sem misturar com o cache anterior
- [x] O cache expira em 10 minutos, e a sessão vencida recomeça em vez de errar
- [x] `checarIgnorados` cobre o `offset` em toda consulta
- [x] O ATS e a IA continuam funcionando; a sessão deles nasce esgotada
- [x] Interruptor em `/config/vagas`, ligado por padrão
- [x] `scripts/qa-rapido.py` passa

## O que NÃO foi verificado

- **Cache vencendo por relógio real.** O teste de expiração foi feito com o TTL
  reduzido para 5 segundos e restaurado depois — não esperei 10 minutos.
- **Comportamento com várias instâncias.** A degradação descrita na decisão 1 é
  raciocínio sobre o código, não medição: o compose de desenvolvimento roda uma
  instância só.
- **O teto de 300 alcançado numa busca de tela.** Verificado por curl (6
  chamadas até `motivo: teto`, 299 URLs únicas), não clicando 12 vezes no
  navegador.
- **A repescagem com dado real.** O cenário — um lote inteiro peneirado — não se
  produz sob demanda: um filtro local que zera o freehire faz a cascata cair
  para o ATS antes de a sessão existir (ver a seção acima). Foi exercitada com
  um motor falso, num script isolado que já foi removido: dois lotes vazios
  seguidos avançaram o offset (60 → 120 → 180) mantendo `temMais: true`, em vez
  de declararem o fim.


---

## O QA achou dois (27/08)

**[MÉDIO] A mensagem de erro nascia 900px fora da tela — corrigido.**

Com a pessoa no rodapé (`scrollY≈1195`), clicar em "Load more" com a sessão
vencida escrevia a explicação em `y=-897`. O botão sumia e o texto que dizia
por quê estava fora da janela: o clique parecia não ter feito nada.

A causa era o reuso do `erroSalva`, que renderiza no topo da página. **São dois
gestos em lugares diferentes**: salvar acontece na linha, paginar acontece no
rodapé — e os dois estados ainda se sobrescreviam.

Agora há um `erroDeMais` próprio, desenhado dentro da `Paginacao`, junto ao
botão. Medido depois: `y=916` com a janela em `0..1000` — **visível**.

Vale para os dois caminhos: sessão expirada e falha de rede.

**[PERGUNTA] Recarregar a página descarta as até 300 vagas.**

F5 ou voltar pelo navegador zera a lista, e a sessão de cache — ainda válida —
fica órfã. **É anterior a este card**: a busca nunca esteve na URL. Mas o card
muda o custo: antes se perdiam 60 vagas de uma busca de 2s; agora até 300, que
custaram 5 chamadas ao serviço de terceiro.

Fica registrado como decisão em aberto, não como defeito deste card. Pôr a
busca na URL é trabalho próprio — e resolveria também compartilhar uma busca
por link.

## O que o QA confirmou no navegador

Botão só na última página; "Load more" acrescenta **sem deslocar** a página
atual (`aria-current` intacto, linhas idênticas ao voltar); teto de 300 com a
frase certa; trocar de filtro zera sem misturar; **300 URLs em 5 lotes, zero
repetidas**; clique duplo dispara **uma** requisição; duas abas não interferem
uma na outra; a estrela (Saved) não ganha o botão, por guarda estrutural.

Contraste nos dois temas: 6,15:1 claro e 5,30:1 escuro no botão — acima de AA.
Alvo 141×36px, alcançável por Tab, foco visível, Enter aciona.

E um falso positivo que ele investigou antes de reportar: "Showing the first
**299** matches" com 300 entregues — uma das vagas estava no histórico de
descartadas e é corretamente ocultada.
