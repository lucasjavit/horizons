# JOB-36 · Configurações vira quatro telas, e a de IA responde "o que funciona"

**Estado:** feito (25/08/2026)
**Tamanho:** G

## Por quê

O [JOB-33](JOB-33-cadeia-de-ia.md) entregou seis provedores encadeados. A tela
não acompanhou: `/config` tinha **864 linhas** num rolo só, e com seis
provedores no formato de cartão daria **~3.190px** de rolagem. O desenho
aprovado mede **2.070px**.

Mas o problema de tamanho era o menor. **A tela mentia.** Ela mostrava
`stored` para as duas chaves cadastradas — e as duas estavam mortas (Anthropic
401, OpenAI 429, medido em 25/08). Quem abria a tela para descobrir por que a
busca não achava vaga saía sem a resposta, porque *ter chave* e *a chave
funcionar* são perguntas diferentes e só a segunda interessa.

## O que mudou

### Quatro sub-páginas, com barra de abas dentro de Configurações

| Rota | O que tem |
| --- | --- |
| `/config/ia` | As duas cadeias, o painel de saúde, as chaves de IA |
| `/config/vagas` | Firecrawl, ATS, busca agendada + chave do Firecrawl |
| `/config/notificacoes` | E-mail semanal, métricas, Telegram (movidos intactos) |
| `/config` | Features: leitura de CV e histórico |

**Não é aba da navegação principal.** Tracks/Jobs/Saved/Invoice são produto
para todos; isto é admin atrás da engrenagem, que já não aparece para usuário
comum. `/config` continua sendo a rota da aba Features para não quebrar o link
da engrenagem.

**O Firecrawl foi para Job sources, e não para a página de IA.** Ele é
implementação concorrente do mesmo passo de leitura que a cadeia faz — o
agrupamento honesto é *de onde vêm as vagas*. A página de IA termina com um
ponteiro curto para ele.

`CartaoProvedor` e `Interruptor` viraram componentes compartilhados em
`components/settings/`. **`EscolhaDeIa` foi deletado**: ele codificava dois
radios e um `iaEfetiva === 'openai' ? 'ChatGPT' : 'Claude'`, e não estende
para seis.

### O painel de saúde, que exigiu backend novo

Antes de qualquer cartão, a página responde à pergunta com que se chega nela.
Uma frase — *"Resume reading works. Job search does not."* — e três blocos, um
por uso, nomeando **quem está de fato servindo**.

Isso não existia e não dava para fingir. Foi preciso:

- `ProviderCheck` — o resultado da última verificação por provedor (status,
  código HTTP, quando), migration `20260825210000_verificacao_de_provedores`
- `IaService.verificar()` — uma chamada real e mínima, no mesmo dialeto que a
  cadeia usa
- `SaudeDaIaService` — guarda o resultado e responde *quem serve* uma
  capacidade (o primeiro da ordem cuja última verificação deu `funcionando`)

### Cinco estados, e as falhas se explicam

| Estado | Selo | Extra |
| --- | --- | --- |
| Sem chave | cinza `No key` | formulário |
| Verificando | dourado `Checking…` | — |
| Funcionando | verde `Working` | "checked 2 min ago"; quem serve diz "currently serving" |
| Recusada | warn `Key refused` | *401 — API key is invalid. Revoked or mistyped.* |
| Sem cota | warn `Out of quota` | *429 — valid key, no credit. Add billing…* |

**401 e 429 separados de propósito.** A cadeia trata os dois igual (cai para o
próximo), mas a ação de quem lê é oposta: um pede trocar a chave, o outro pede
pagar. Um selo só mandaria metade dos admins pelo caminho errado.

Apareceram mais dois estados que o desenho não previa e a implementação
exigiu: **`Not tested`** (chave cadastrada antes desta feature — chamar de
erro acusaria uma chave que pode estar boa) e **`Failed`** (500/timeout, que
não é culpa da chave).

Nunca só cor: o texto do selo carrega o estado, a bolinha é decoração.

### Ordenação por setas ↑↓

A ordem inteira passou a ser gravada (`ProviderOrder`), no lugar da
preferência única `jobs.iaDaBusca` — que resolvia para dois provedores, mas
com seis a segunda e a terceira posições decidem quem atende quando o topo
cai.

Dois detalhes que só apareceram implementando:

1. **O vizinho é o VISÍVEL, e não o adjacente na lista completa.** A cadeia de
   busca mostra 3 dos 6. Se a ordem fosse `Claude, Groq, ChatGPT`, mover
   ChatGPT para cima trocando com o adjacente o poria acima do Groq — que não
   aparece ali. A tela não mudaria e o botão pareceria quebrado.
2. **O foco cai para a seta irmã quando a usada fica desabilitada.** Mover uma
   linha para a ponta desabilita justamente a seta que a levou lá, e botão
   `disabled` não aceita foco.

## Decisão de produto: quando verificar as chaves

**Ao salvar: sempre.** É o único momento em que a pessoa espera resposta sobre
aquela chave.

**Na carga da página: nunca.** Seriam seis chamadas reais a cada visita, e nas
pagas isso **custa dinheiro** — a tela de admin viraria torneira aberta. A tela
lê o resultado guardado e diz **quando** foi verificado. Passadas 24h vira
"checked yesterday" em vez de fingir frescor. Quem quer o valor de agora tem o
botão `Test all keys`.

## O que a verificação achou no primeiro uso real

Ela existe para expor chave morta, e expôs duas coisas que ninguém sabia:

**1. O modelo do Gemini estava aposentado.** A chave real cadastrada recebia
**404**, com a própria API dizendo: *"models/gemini-2.5-flash is no longer
available to new users. Please update your code to use models/gemini-3.6-flash"*.
A cadeia só registrava "erro" e caía para o próximo — o provedor estava
inútil e ninguém tinha como saber. Corrigido em `provedores.ts`.

**2. `maxTokens: 16` reprovava uma chave boa.** Com o modelo novo, a
verificação voltava 200 com texto **vazio** e `finishReason: MAX_TOKENS`. O
Gemini 3.6 gasta **49–79 tokens de raciocínio interno** antes do primeiro
caractere. Medido com chave real:

| maxTokens | resultado |
| ---: | --- |
| 16 | `""` (MAX_TOKENS) |
| 64 | `"H"` (MAX_TOKENS) |
| **256** | `{"ok":true}` (STOP) |

Uma verificação apertada demais reprova chave boa, que é o pior erro que esta
tela pode cometer. Ficou em 256.

**A Anthropic não está mais 401.** O card JOB-33 registrava 401; a chave foi
trocada em 25/08 às 18:25 e agora responde 200. Quem descobriu foi o
`Test all keys`.

## O que foi verificado

Aplicação de pé, `docker compose up -d --build`, bundle servido conferido a
cada leva (`index-BxNs5qxw.js` no fim).

| O quê | Resultado |
| --- | --- |
| `Test all keys` contra provedores REAIS | ANTHROPIC `funcionando` 200 · OPENAI `sem_cota` 429 · GEMINI `funcionando` 200 · três `sem_chave` — **4,1s** |
| Cinco estados na tela | exercitados com cenário sintético; os selos, os motivos e os formulários corretos em cada um |
| "checked yesterday" | resultado de 24h+ não finge frescor |
| Setas ↑↓ | ordem muda, **grava** e sobrevive ao reload |
| Foco no teclado | segue a linha; na ponta cai para a seta irmã (medido: antes ia para `<body>`) |
| `aria-live` | *"Gemini (Google) moved to position 1 of 3."* — anuncia a posição, não "moved" |
| Acessibilidade | 19 botões, **0** sem `type="button"`, **0** sem nome acessível, **0** input sem label |
| 390px | `docW == vw == 390` nas quatro páginas — **zero** rolagem horizontal |
| Dois temas | conferidos nos dois; todos os tokens resolvem |
| Busca por ATS | **1 vaga real** do Ashby, com salário e elegibilidade |
| Busca por IA | **15 vagas reais** pela cadeia (Greenhouse, Workera, Kalepa…) |
| Leitura de CV | PDF real → stack de 8 itens, `senior`, 8 anos |
| `scripts/qa-rapido.py` | **tudo certo** — inclusive centavos do invoice e trilhas |

### Um bug que só a tela renderizada mostrou

Os números diziam que estava tudo certo. Olhando o print: **Groq, Cerebras e
Mistral não tinham NENHUM formulário de chave.** O formulário estava atrás de
um `comFormulario` que só a cadeia de busca passava, e esses três não aparecem
nela. Não dava para cadastrar a chave dos três provedores gratuitos — que são
a razão de a cadeia existir. Corrigido: o formulário aparece na cadeia onde o
provedor de fato mora.

## Critérios de aceite

- [x] `/config/ia` como sub-rota com barra de abas, `@AdminOnly()` como `/config`
- [x] `/config` dividida em quatro sub-páginas, sem perder nada
- [x] `CartaoProvedor` e `Interruptor` compartilhados; `EscolhaDeIa` deletado
- [x] Painel de saúde no topo, com backend de verificação por trás
- [x] Cinco estados, com 401 e 429 separados e o motivo dito
- [x] Ordenação por setas, foco acompanha, posição anunciada em `aria-live`
- [x] `Trains on your data` na linha, em cor de aviso, nunca atrás de clique
- [x] `Paid` / `Free tier`, sem preço nem taxa por token
- [x] 390px sem rolagem horizontal
- [x] Verificação ao salvar; na carga usa o guardado + `Test all keys`
- [x] ATS, busca por IA e leitura de CV sem regressão

## O que NÃO foi verificado, e por quê

**Não houve clique de gente num navegador de verdade.** O Chromium deste
ambiente não alcança a rede — nem `localhost`, nem externa (medido: `example.com`
também não carrega) — e trava a conexão CDP em páginas grandes. A verificação
foi feita de três formas que, juntas, cobrem o que o navegador cobriria:

1. **jsdom rodando o bundle REAL** servido pelo nginx, com as respostas da API
   capturadas do servidor de verdade — prova que os componentes montam, o que
   escrevem, e exercita clique nas setas, foco e `aria-live`.
2. **Chromium sobre o HTML renderizado** (snapshot estático + o CSS real) —
   prova layout, os dois temas e a ausência de rolagem horizontal em 390px.
3. **curl direto na API** — prova o transporte HTTP e as chaves reais.

O que fica sem prova: animação, `:hover`, `:focus-visible` desenhado, e o
comportamento do `Checking…` durante os 4s reais do `Test all keys` (o estado
foi exercitado, o intervalo de tempo real não).

**O `Test all keys` gasta.** São até seis chamadas reais. Cada rodada de
verificação custou ~4s e alguns tokens; não foi medido em dinheiro.


## O QA achou 4 (25/08), todos corrigidos

Ele aprovou para commit — nenhum perdia dado — mas os quatro valiam antes.

**[MÉDIO] O foco ia para o `<body>` ao mover um provedor para a ponta.**
Medido: 9 em 10. O `requestAnimationFrame` rodava ANTES do commit do React que
aplica `disabled`, então a seta usada ainda parecia habilitada, o `focus()`
tinha sucesso, e o `return` pulava o fallback — só depois o navegador expulsava
o foco do botão recém-desabilitado. O rastro de eventos mostrava a ordem:
FOCUSIN, FOCUSOUT para BODY, e só então `disabled=true`.

Corrigido com **dois** `requestAnimationFrame`: o segundo quadro roda depois do
commit, quando `disabled` já reflete a nova posição. Medido: **8 de 8**, contra
1 de 10.

Só acontecia ao chegar na ponta — mover para o meio sempre preservou o foco.

**Token de só espaços era aceito com 200.** `@MinLength(8)` conta espaço.
`@Transform(trim)` antes dele. A cadeia não era envenenada (o serviço apara na
leitura), mas a pessoa via "salvei" e a tela seguia dizendo "No key". Agora
`"  gsk_teste12345678  "` grava limpo — colar chave com espaço em volta é
engano comum, e passou a funcionar em vez de falhar em silêncio.

**A mensagem de erro da busca citava 2 de 7 opções** — "Firecrawl token or an
Anthropic key", escrita quando eram dois provedores. Agora cita as famílias, não
os nomes: uma lista de nomes aqui envelhece a cada provedor novo.

**Os interruptores usavam `<label>` envolvente sem `htmlFor`.** Funcionava — o
nome acessível saía certo —, mas a convenção da casa é `<label htmlFor>`, e uma
regra de acessibilidade seguida em 40 lugares e dispensada em 1 é uma regra que
não vale. Os seis checkbox das quatro sub-páginas agora têm `id`.

## O que o QA confirmou que não quebrou

A cadeia, que é o coração da mudança: ordem respeitada e persistida; mover com
um inelegível no meio troca com o vizinho **visível**; inelegíveis **ausentes**
da cadeia de busca em vez de presentes-e-desabilitados; `sem_chave` no topo é
pulado a custo zero (5,7s com dois sem chave à frente, contra 9,5s); cadeia
esgotada com mensagem única, separando "nenhum tem chave" de "todos falharam".

E a regressão que mais preocupava — as 864 linhas partidas em quatro: os
interruptores gravam e leem de volta, `leitura-cv` desligado **recusa no
servidor** (400) e não só na tela, métricas de e-mail presentes, tutorial do
Telegram íntegro.
