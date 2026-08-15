# JOB-04 · A tela das vagas encontradas

**Estado:** em andamento (15/08/2026) — a lista está no ar; ver
[O que já está entregue](#o-que-ja-esta-entregue-15082026) no fim do arquivo.
**Tamanho:** M

## Por quê

O valor da feature não é "buscar vagas" — é **não ler as 40 que não serviam**.
A tela é onde isso se prova ou se perde.

## O cartão

Responde as quatro perguntas que decidem o clique, **sem a pessoa abrir a vaga**:

1. **Quanto paga** — em USD/EUR, faixa anual
2. **Posso ser contratado daqui** — "contrata PJ no Brasil" / "só CLT local,
   exige visto". **É a pergunta que mata 70% das vagas e quase nenhum site
   responde na listagem** — é o dado mais valioso da tela
3. **O fuso me quebra** — "4h de overlap (PST)" é diferente de "6h em CET"
4. **Ainda está aberta** — publicada há 2 dias ou há 9

E diz **o que falta** no perfil. Um match que só elogia é propaganda; dizer
"pedem Rust, você não tem" é o que faz confiar no resto.

O **domínio de origem** aparece — busca por IA erra, e mostrar a fonte deixa a
pessoa calibrar a confiança sozinha.

## Extraído versus inferido

"USD 140k (do anúncio)" e "provavelmente aceita PJ" **não podem ter a mesma
tipografia**. Se aparecem iguais, viram a mesma coisa aos olhos — e é assim que
uma alucinação passa por fato.

O trecho de origem do salário e da elegibilidade fica disponível sob demanda.
Isso é verificável, não é confiança.

## Compatibilidade em rótulo, não em percentual

**Forte / Boa / Parcial**, não "92%". Um número percentual de IA sugere uma
precisão que o pipeline não tem.

## O que reusar da invoice

- `Recolhivel` — o painel recolhe no celular quando a lista carrega
- `States.tsx` — Loading / Error / Empty
- o padrão de `Field.tsx`, copiado para `components/vagas/` (não promovido a
  global ainda)
- o par **painel à esquerda / resultado à direita**, com `sticky top-[57px]`

**Não** reusar o acordeão numerado: na invoice há 15 campos em sequência, aqui
há 4 ou 5 opcionais e sem ordem. Numerar sugere uma sequência que não existe.

## Idioma

**Em português.** O usuário é o dev brasileiro; a invoice é que mira o público
global.

## O estado vazio

É a primeira tela de todo mundo, e a única chance de explicar que a busca roda
sozinha. Precisa dizer **explicitamente** que a pessoa será avisada quando
houver vagas — foi decisão do stakeholder que ninguém espera olhando.

## Critério de aceite

- [ ] Lista as vagas não vencidas do grupo da pessoa
- [ ] O cartão responde as quatro perguntas
- [ ] Vaga sem salário mostra "não informado", nunca um número
- [ ] Extraído e inferido são visualmente distintos
- [ ] O trecho de origem do salário fica acessível
- [ ] Estado vazio explica que a busca roda sozinha
- [ ] Acessibilidade: label em todo campo, alvo ≥24px, erro por borda +
      `aria-invalid` + texto
- [ ] Os dois temas

## Depende de

- JOB-03 (ter vaga para mostrar)


---

## ⚠️ Filtrar na exibição não é opcional (15/08/2026)

O agrupamento do [JOB-02](JOB-02-perfil-de-busca.md) deixa fora da assinatura
os filtros que não mudam *quais vagas existem*, só *quais interessam*:
`salary_min`, `exclude_keywords`, `posted_within_days`.

**Esta tela precisa reaplicá-los**, lendo o perfil de quem está olhando. Sem
isso, a pessoa que pediu "mínimo 12k" recebe vaga de 8k, porque outra pessoa do
mesmo grupo pediu 8k — e a interface estaria mentindo sobre um filtro que ela
mesma ofereceu.

É o tipo de defeito que não aparece em teste: a lista carrega, os cards são
reais, e só quem conferir salário por salário percebe.

---

## O que já está entregue (15/08/2026)

**A lista de vagas**, dentro da `/vagas`, convivendo com o formulário de perfil
que já existia — as vagas em cima, o perfil embaixo. Só frontend; o backend
(`GET /api/jobs`) já estava pronto.

Arquivos novos, todos em `frontend/src/components/vagas/`:
`ListaVagas.tsx`, `CartaoVaga.tsx`, `BarraFiltros.tsx`, `vaga-formato.ts`,
`vaga-filtro.ts`. Mais `api.listarVagas` e o tipo `Vaga` no espelho manual.

### Decisão do stakeholder: sem nota (15/08/2026)

A referência visual que ele mandou (captura do look4job) trazia um número na
lateral de cada vaga — 79, 75. **Ele dispensou:** "não precisa de nota."

Então não há percentual, nem barra de compatibilidade, nem rótulo
Forte/Boa/Parcial, **nem ordenação por nota**. A lista sai por data, que é como
o backend já entrega (`postedAt desc`, `foundAt desc`). Isto substitui a seção
"Compatibilidade em rótulo, não em percentual" acima, que fica registrada como
o desenho anterior.

O resto do desenho da referência foi seguido: busca por texto no topo, filtros
em pílulas, cartão horizontal enxuto com `empresa · local · via fonte · escopo`
e as skills embaixo, selo de idade ao lado do título.

### Critérios já atendidos

- [x] Lista as vagas não vencidas do grupo da pessoa
- [x] Vaga sem salário mostra "não informado", nunca um número
- [x] Extraído e inferido são visualmente distintos — extraído em peso médio,
      ausente em itálico apagado
- [x] O trecho de origem do salário fica acessível — botão "ver trecho" que
      revela o texto do anúncio numa `<blockquote>`, com `aria-expanded`
- [x] Estado vazio explica que a busca roda sozinha **e que a pessoa será
      avisada**
- [x] Acessibilidade: alvo ≥24px (o link do título precisou de
      `inline-block py-0.5`; como `inline` media 19px), rótulo no campo de
      busca, `aria-pressed` nas pílulas, contagem em `aria-live`
- [x] Os dois temas

### O que ficou de fora

- **O cartão responde as quatro perguntas** — responde três (quanto paga,
  contratação do Brasil, ainda está aberta). **O fuso não**: o backend não
  devolve overlap de fuso, e o `VagaDto` não tem o campo. Precisa de dado novo,
  não de tela.
- **"O que falta no perfil"** ("pedem Rust, você não tem") não existe: exigiria
  cruzar as skills da vaga com o `cvProfile`, e o stakeholder pediu para manter
  como está por ora.
- **O par painel à esquerda / resultado à direita** com `sticky top-[57px]` não
  foi feito — a lista ficou em coluna única, sobre o formulário. O stakeholder
  disse que a referência "é só um exemplo de como eu quero que mostre no
  front, pode continuar como está, qualquer coisa muda depois".
- A **reaplicação dos filtros de exibição** (o aviso de 15/08 acima) **já é
  feita pelo backend**, em `vagas.service.ts` — a tela não precisou repetir.

### Uma armadilha que voltou

A barra "Salvar alterações" do formulário é `sticky bottom-0` no celular. Com a
lista de vagas acima, a posição natural dela passou a cair **no meio do
formulário** — medido: barra em y=1986 cobrindo "Seu perfil de busca", "O que
você procura" e "Cargos". É exatamente o defeito que o comentário no código já
descrevia, com a premissa mudada.

Correção: o `sticky` agora vale **só quando não há perfil salvo**, que é o caso
em que o formulário é a página inteira e a barra precisa ficar no polegar. Com
perfil, ela solta e fica no fim.


---

## Verificado por mim (15/08/2026)

Com as 5 vagas de exemplo semeadas (mais uma vencida, de propósito):

| O que | Resultado |
| --- | --- |
| `GET /api/jobs` sem token | **401** |
| Lista | 5 cartões, ordenados por data |
| Vaga vencida | **não aparece** |
| Salário ausente | *"não informado"* em itálico — nunca um número |
| "ver trecho" | revela o texto do anúncio de onde o salário saiu |
| Contador com filtro | "2 de 5 vagas", batendo com os 2 cartões visíveis |
| Busca por texto | filtra no cliente |
| Pílulas | `aria-pressed`, OU dentro do grupo, E entre grupos |
| Tema escuro | correto |
| Erros de console | **zero** |

### Um bug que achei na revisão

**Seis skills apareciam nos cartões sem ter pílula de filtro.** As vagas usavam
18 skills distintas; a barra mostrava 12, e o teto cortava Kotlin, PostgreSQL,
RabbitMQ, TypeScript, Node.js e Python — sem nada indicando que existiam. Um
cartão dizia "Kotlin" e não havia como filtrar por Kotlin.

O teto em si é certo (a barra não pode virar um muro de pílulas), e o cuidado
de nunca esconder uma pílula *marcada* já estava lá. Faltava tornar o resto
**alcançável**: agora há um `+6` que expande o grupo. Medido depois: 22 → 28
pílulas, Kotlin clicável, filtro aplicando.

### Dois falsos positivos meus, que quase viraram bug

- Li "5 vagas" como se fosse o resultado do filtro e achei que o filtro não
  aplicava. O texto real era **"2 de 5 vagas"** — minha regex parava no primeiro
  número. O filtro estava certo desde o começo.
- Um teste meu procurava "nota" por padrão numérico e acusou `75`. Era o
  **salário** "EUR 75k–95k".

Registro os dois porque a lição é a mesma das outras vezes: a asserção precisa
medir o que a pessoa vê, não um padrão parecido.

## Estado

**Em andamento**, não feito. Falta do card original: fuso/overlap (não existe
no `VagaDto` — precisa de dado novo na captura) e "o que falta no perfil".

E vale dizer o que isto **não** é: a busca não roda sozinha. As vagas estão no
banco porque eu as semeei. O que existe é a estrutura (`FoundJob`, expiração de
15 dias, agrupamento) e a tela. O job de 50 minutos é o [JOB-03](JOB-03-busca-em-segundo-plano.md).

## Sem nota, por decisão do stakeholder (15/08/2026)

A referência visual que ele mandou (look4job) tinha um número de compatibilidade
(79, 75) na lateral. Perguntei se entrava, e a resposta foi **"não precisa de
nota"**.

Isso resolve na prática o que o card já discutia em "Compatibilidade em rótulo,
não em percentual": não há nota, nem número, nem barra, nem rótulo. A ordenação
é por data.


---

## O formato mudou: linhas densas, não cartões (15/08/2026)

O stakeholder viu o resultado (cartões com borda, pílulas de filtro, formulário
de perfil acima) e foi direto: *"você não entendeu. Eu quero um filtro igual a
esse do mesmo modelo e que mostre as vagas em uma tabela"*, com uma captura do
RemoteYeah.

Vale registrar **por que a primeira versão errou o alvo**: eu tinha o card, que
descreve o conteúdo do cartão (as quatro perguntas, extraído vs. inferido), e
tratei a referência visual como detalhe de acabamento. Não era — a densidade da
lista *é* o requisito. Um cartão com borda e três linhas de rótulo mostra 4
vagas por tela; a linha densa mostra 8.

### O que muda

| | antes | agora |
| --- | --- | --- |
| Filtros | pílulas soltas, filtram ao clicar | **8 dropdowns** com contador, e um botão **Filtrar** |
| Vagas | cartões com borda | **linhas densas**, divisória entre elas |
| Idade | badge ao lado do título | **solta no topo** da linha |
| Empresa | texto | **logo redonda**; iniciais quando falta |
| Experiência | não existia | **`Exp: 5 anos`** ao lado do título |
| Salário | linha rotulada | **chip verde** na faixa |
| País | texto | **bandeirinha** no fim da faixa |
| Perfil de busca | formulário na mesma página | **removido** — *"não vai precisar desse formulário, somente os filtros"* |
| Upload de CV | na página | removido daqui — *"a parte do CV vai ser outra coisa"* |

### Campos novos no banco

`area`, `anosExp`, `benefits`, `degree`, `logoUrl`, `paisIso`. Os oito
dropdowns da captura incluem **Benefits** e **Degree**, que não existiam.

O [JOB-03](JOB-03-busca-em-segundo-plano.md) foi atualizado com a obrigação de
preencher esses campos — sem isso a busca seria construída preenchendo metade
da linha.

### O que a remoção do formulário implica

Sem formulário não há como criar perfil, e sem perfil não havia `grupo` — a
lista ficaria eternamente vazia. A listagem passou a funcionar **sem perfil**:
mostra o que a rodada achou, e o perfil (quando existir) restringe ao grupo
dele.

O `JobProfile` e o agrupamento **continuam** — o stakeholder decidiu que o botão
Filtrar dispara busca ao vivo *e* pode salvar o perfil, que é o que a rodada de
50 min vai procurar.

### Entregue (15/08/2026)

Arquivos novos em `frontend/src/components/vagas/`: `DropdownFiltro.tsx`
(dropdown acessível de seleção múltipla) e `LinhaVaga.tsx` (a linha densa).
Reescritos: `BarraFiltros.tsx` (oito dropdowns), `ListaVagas.tsx`,
`vaga-filtro.ts` (oito eixos no lugar de cinco) e `vaga-formato.ts`.

**Apagados**, com o formulário: `CartaoVaga.tsx`, `CaixaUploadCV.tsx`,
`CampoFichas.tsx`, `Field.tsx`, `SeloOrigem.tsx`. Atenção ao homônimo — o
`components/invoice/Field.tsx` é outro arquivo e **continua em uso**.

`VagasPage.tsx` foi de **728 para 68 linhas**: era quase toda formulário.

`vaga-formato.ts` perdeu sete exports que só o cartão usava (`NAO_INFORMADO`,
`formatarSalario`, `formatarRegime`, `idadeEmDias`, `formatarIdade`,
`formatarElegibilidade`, `formatarFonte`). O `formatarIdadeRelativa` novo conta
em **horas**, não em dias de calendário: "há 15 horas" é o que distingue a vaga
publicada agora da de ontem, e era o que a captura mostrava.

#### Decisões que o card não previa

- **O filtro não aplica sozinho.** Os dropdowns editam um rascunho e só
  "Filtrar" o promove. Com oito eixos, aplicar a cada checkbox faria a lista
  saltar embaixo do dedo no meio da escolha.
- **Ausente não passa no filtro selecionado.** Quem marca "Bacharelado" pede as
  que exigem bacharelado; a vaga que não informou não é uma delas. Não
  contradiz "ausente permanece ausente" — aquilo vale para a *exibição*.
- **Salário compara pelo teto** (`salaryMax ?? salaryMin`): uma faixa 90K–160K
  atende quem pede 150K+, e olhar só o piso a descartaria.
- **Sem cor nova no tema.** O contador verde e o chip de salário usam
  `--brand`/`--brand-text`, que já são verdes. Medido: 6,15:1 no claro e 5,99:1
  no escuro para o badge preenchido — um `--success` novo não ganharia
  contraste.
- **Os emojis 🔍 e ✕ dos botões ficaram de fora.** Não há fonte de emoji nesta
  máquina (`fc-list | grep -c emoji` → **0**) e viravam quadrados vazios. A
  bandeirinha ficou, porque **nunca vem sozinha**: o nome do país anda junto, e
  sem a fonte o custo é um enfeite, não a informação.

#### Critérios atendidos

- [x] Lista as vagas do grupo da pessoa, por data
- [x] Campo ausente permanece ausente — sem salário, **sem chip**; sem
      `anosExp`, sem "Exp:"; sem `paisIso`, sem bandeira
- [x] Sem nota, número, barra ou percentual
- [x] Filtragem no cliente, sobre a lista carregada
- [x] Contador "N vagas encontradas" e "12 de 240" com filtro
- [x] Dropdown acessível: `aria-expanded`/`aria-haspopup`, Esc fecha e devolve
      o foco ao botão, clique fora fecha, checkbox de verdade dentro
- [x] Os dois temas e 390px

#### Verificado por mim (15/08/2026)

Com as 5 vagas semeadas com os campos novos (`logoUrl` vazio em todas — o que
se vê é a queda para iniciais; a imagem em si **não foi exercitada**):

| O que | Resultado |
| --- | --- |
| `npm run build` | limpo |
| Funções puras | **61 casos** (33 de formato, 28 de filtro), 0 falhas |
| Barra | 8 dropdowns, na ordem da captura |
| Linha | idade no topo, `Exp: N anos`, chip verde, bandeira no fim |
| Vaga sem salário/exp/país | os chips **somem**, nada de "não informado" |
| Dropdown | badge "1", Esc devolve o foco, clique fora fecha |
| Contador | "5 vagas encontradas" → **"4 de 5 vagas"** ao filtrar |
| Limpar filtros | volta a 5 |
| 390px | `scrollWidth == innerWidth` (390), painel não vaza |
| Tema escuro | correto |
| Erros de console | **zero** |
| `scripts/qa-rapido.py` | tudo certo |
| Trilhas / Invoice / Configurações | seguem de pé |

#### O que não fiz

- **`logoUrl` não foi testado com imagem real** — nenhuma vaga semeada tem uma.
  O `onError` que cai nas iniciais está escrito e é o caminho que roda hoje,
  mas a imagem carregando de fato não foi vista.
- Os filtros **Benefícios** e **Formação** têm poucas opções nas 5 vagas de
  exemplo (4 e 2 vagas preenchidas); o comportamento com dezenas de opções e
  rolagem no painel não foi exercitado com dado real.
- O card original ainda tem em aberto **fuso/overlap** e **"o que falta no
  perfil"** — nenhum dos dois entrou aqui, e os dois seguem precisando de dado
  novo, não de tela.


### Verificado por mim (15/08/2026)

| O que | Resultado |
| --- | --- |
| Oito dropdowns, na ordem da captura | ✅ |
| Rascunho **não** aplica sozinho | badge vira 1, contador segue "5 vagas" |
| Botão **Filtrar** | "3 de 5 vagas" |
| **Limpar** (só aparece quando há o quê) | volta a 5 |
| Linha densa | idade solta, iniciais na logo, `Exp: N anos`, chips, país |
| Campo ausente | sem salário → sem chip; sem `anosExp` → sem "Exp:" |
| Dois temas, 390px | sem vazamento, zero erro de console |

**Dois ajustes que fiz depois do agente:**

1. **No celular os oito dropdowns ocupavam ~400px** antes da primeira vaga — a
   tela inteira de filtro, com a lista abaixo da dobra. Agora ficam recolhidos
   atrás de um botão "Filtros" com contador, usando o `Recolhivel` que já
   existia. Sempre abertos a partir de `sm`.
2. **O parágrafo de introdução ocupava 104px** (quatro linhas no celular).
   Virou uma linha. A primeira vaga saiu de y=430 para **y=362**, dentro da
   dobra de 780.

**Um falso positivo meu:** medi "8 dropdowns visíveis" com o painel fechado e
achei que o recolhimento não funcionava. O `Recolhivel` usa `grid-rows-[0fr]`
com `overflow-hidden` — altura zero, mas `offsetParent` não-nulo. Medindo a
altura do painel: **0px fechado, 344px aberto**. Funcionava desde o começo.

**Decisões do agente que mantive:** os emojis 🔍/✕ ficaram de fora dos botões
porque esta máquina não tem fonte de emoji e viravam quadrados; a bandeirinha
ficou porque nunca vem sozinha (o nome do país acompanha), então sem a fonte
perde-se o enfeite, não a informação.

**O que não foi exercitado:** `logoUrl` está vazio nas cinco vagas, então só o
caminho das iniciais rodou — a imagem carregando não foi vista.
