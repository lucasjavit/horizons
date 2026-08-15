# JOB-02 · Desenho da tela `/vagas` (perfil de busca)

**Estado:** proposta de design (15/08/2026)
**Card:** [JOB-02](../backlog/cards/JOB-02-perfil-de-busca.md)
**Quem implementa:** tech-lead. Aqui não há código de produção — os trechos
são esboço para ler, não para colar.

Este documento responde: o fluxo, o layout nos dois estados, os campos, como
mostrar o que a IA leu do CV, o aviso de privacidade e os erros de borda.

---

## 1. O fluxo

### A decisão que organiza a tela

O card é explícito: **o currículo é um filtro a mais, o mais poderoso deles —
não um caminho separado.** Isso tem uma consequência de desenho que vale
escrever antes de qualquer mockup:

> **Não existe tela de escolha.** Nada de "quer subir o CV ou preencher na
> mão?". Uma pergunta dessas obriga a pessoa a decidir antes de saber o que
> cada caminho faz, e cria dois fluxos para manter.

A tela é **uma só, sempre a mesma**: um formulário de filtros com uma caixa de
upload em cima. O CV não leva a lugar nenhum — ele **preenche o formulário que
já estava ali**. Os três caminhos do card viram três comportamentos da mesma
tela, e nenhum deles precisa de código de navegação:

| Caminho do card | O que a pessoa faz | O que a tela faz |
|---|---|---|
| **só CV** | sobe o arquivo, confere, salva | preenche os campos e não exige mais nada |
| **CV + filtros** | sobe, corrige o que veio errado, acrescenta salário | os campos vêm preenchidos e são editáveis; editar é o Case B do prompt |
| **só filtros** | ignora a caixa de upload, digita | a caixa nunca bloqueia o botão de salvar |

O terceiro caminho é o teste do desenho: **se a caixa de upload puder ser
ignorada sem custo nenhum, o desenho está certo.** Ela não é um passo, é uma
oferta.

### Chegando sem perfil (estado vazio)

O estado vazio é a primeira tela de todo mundo e a única chance de explicar a
feature inteira. Ele mostra, de cima para baixo:

1. **O que vai acontecer**, em uma frase — a busca roda sozinha a cada 50
   minutos e a pessoa não precisa ficar olhando. Sem isso, salvar o perfil
   parece não ter feito nada (a lista de vagas fica vazia por até 50 min).
2. **A caixa de upload do CV**, com o aviso de privacidade **visível antes de
   qualquer botão de escolher arquivo** (§5) — não atrás de um link, não num
   modal que aparece depois de escolher.
3. **Os filtros essenciais**, já visíveis e vazios: cargo, tecnologias,
   remoto, senioridade, local.
4. **Os filtros avançados**, recolhidos (§3).
5. **O botão salvar**, habilitado desde o começo com uma ressalva: se tudo
   estiver vazio, ele explica o que falta em vez de ficar cinza (§Regras).

O estado vazio **não** usa o `EmptyState` de `States.tsx`. Aquele componente é
um parágrafo centralizado de uma linha — serve para "nenhuma aula por aqui",
não para uma tela que precisa ensinar. Aqui o estado vazio *é* o formulário.

### Depois de salvar

Salvar **não** troca de página. A pessoa continua no formulário, agora em modo
"perfil salvo":

- uma faixa de confirmação (`role="status"`, `aria-live="polite"`) diz que o
  perfil foi salvo e **quando a próxima rodada acontece**;
- o botão primário passa a ser **"Ver vagas"** (leva para JOB-04), e "Salvar
  alterações" fica secundário e desabilitado até algo mudar;
- o `grupo` calculado **não aparece na tela**. É detalhe de implementação do
  agrupamento; mostrar uma assinatura como `pleno|node,react|latam` só gera a
  pergunta "o que é isso?" sem nenhuma ação possível como resposta.

Voltar depois à `/vagas` cai no formulário preenchido com o que foi salvo, não
no estado vazio. É a mesma tela em modo edição.

### O ciclo do upload

```
ocioso ──escolhe arquivo──▶ enviando ──┬──▶ lido      (campos preenchidos, marcados)
                                       └──▶ recusado  (mensagem §6, campos intactos)
```

Duas regras que evitam o pior desfecho do card:

- **Recusa nunca preenche nada.** Se a IA não leu o CV, os campos ficam como
  estavam. Perfil inventado a partir de leitura falha é exatamente o que o
  card proíbe.
- **Erro de upload não perde o que foi digitado.** Quem já digitou três
  tecnologias e tenta subir um PDF quebrado continua com as três tecnologias.

---

## 2. Mockup ASCII (~76 colunas)

### Estado vazio — desktop (≥1024px)

```
┌────────────────────────────────────────────────────────────────────────┐
│  Horizons     Trilhas   Vagas   Invoice                      ☾  Lucas  │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  Seu perfil de busca                                                   │
│  A cada 50 minutos procuramos vagas que batem com este perfil.         │
│  Você não precisa ficar olhando — elas aparecem aqui sozinhas.         │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  ⬆  Comece pelo seu currículo (opcional)                         │  │
│  │                                                                  │  │
│  │  A gente lê e preenche os filtros abaixo. Você confere e corrige │  │
│  │  antes de salvar.                                                │  │
│  │                                                                  │  │
│  │  ┌────────────────────────────────────────────────────────────┐  │  │
│  │  │ ⚠  O arquivo é enviado para o provedor de IA para ser lido.│  │  │
│  │  │    Guardamos só o que ele entendeu: stack, senioridade e   │  │  │
│  │  │    anos de experiência. O arquivo e o texto do currículo    │  │  │
│  │  │    não ficam salvos em lugar nenhum.                       │  │  │
│  │  └────────────────────────────────────────────────────────────┘  │  │
│  │                                                                  │  │
│  │  [ Escolher arquivo ]   PDF ou DOCX · até 5 MB                   │  │
│  │                                                                  │  │
│  │  Prefere digitar? Só preencher os campos abaixo e ignorar isto.  │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│  ── O que você procura ───────────────────────────────────────────────  │
│                                                                        │
│  Cargos                                                                │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Backend Engineer ×    ⌷                                          │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│  Enter para adicionar. Ex.: Backend Engineer, Software Engineer        │
│                                                                        │
│  Tecnologias                                                           │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ ⌷                                                                │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│  Senioridade                        Trabalho remoto                    │
│  ┌──────────────────────────┐       ( ) Tanto faz                      │
│  │ Qualquer uma          ▾  │       (•) Só vagas remotas               │
│  └──────────────────────────┘       ( ) Só presencial/híbrido          │
│                                                                        │
│  Onde                                                                  │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ ⌷                                                                │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│  País, cidade ou região. Vazio = qualquer lugar.                       │
│                                                                        │
│  ▸ Mais filtros (salário, fuso, visto, palavras)                       │
│                                                                        │
│  ┌──────────────┐                                                      │
│  │    Salvar    │   Você pode mudar tudo isso depois.                  │
│  └──────────────┘                                                      │
└────────────────────────────────────────────────────────────────────────┘
```

### Preenchido depois do upload

```
┌────────────────────────────────────────────────────────────────────────┐
│  Seu perfil de busca                                                   │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  ✓ Lemos o seu currículo                    [ Trocar arquivo ]   │  │
│  │                                                                  │  │
│  │  Entendemos que você é uma pessoa desenvolvedora backend         │  │
│  │  pleno, com ~5 anos, focada em Node.js e AWS.                    │  │
│  │                                                                  │  │
│  │  Confira os campos marcados com “do currículo” e corrija o que   │  │
│  │  estiver errado — o que você editar vale mais que o currículo.   │  │
│  │                                                                  │  │
│  │  O arquivo já foi descartado. Não guardamos o texto dele.        │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│  ── O que você procura ───────────────────────────────────────────────  │
│                                                                        │
│  Cargos                                    ⟨do currículo⟩              │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Backend Engineer ×   Software Engineer ×   Node.js Developer ×   │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│  Veio do currículo. Editar substitui pelo que você escrever.           │
│                                                                        │
│  Tecnologias                               ⟨do currículo⟩              │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Node.js ×  TypeScript ×  AWS ×  PostgreSQL ×  Docker ×    ⌷      │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│  Senioridade      ⟨do currículo⟩    Trabalho remoto                    │
│  ┌──────────────────────────┐       ( ) Tanto faz                      │
│  │ Pleno                 ▾  │       (•) Só vagas remotas               │
│  └──────────────────────────┘       ( ) Só presencial/híbrido          │
│  5 anos de experiência                                                 │
│                                                                        │
│  Onde                                                                  │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ ⌷                                                                │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│  País, cidade ou região. Vazio = qualquer lugar.                       │
│                                                                        │
│  ▾ Mais filtros (salário, fuso, visto, palavras)                       │
│                                                                        │
│    Salário mínimo anual        Moeda                                   │
│    ┌────────────────────┐      ┌────────────────────┐                  │
│    │ 90000              │      │ USD             ▾  │                  │
│    └────────────────────┘      └────────────────────┘                  │
│    Vaga sem salário publicado continua aparecendo.                     │
│                                                                        │
│    Tipo de contrato        Publicadas nos últimos                      │
│    [×] CLT/Full-time       ┌────────────────────┐                      │
│    [ ] PJ/Contract         │ 15 dias         ▾  │                      │
│    [ ] Freelance                                                       │
│                                                                        │
│    Seu fuso                                                            │
│    ┌────────────────────────────────────────────────┐                  │
│    │ America/Sao_Paulo (UTC−3)                   ▾  │                  │
│    └────────────────────────────────────────────────┘                  │
│                                                                        │
│    [ ] Mostrar só vagas que patrocinam visto                           │
│                                                                        │
│    Palavras que a vaga deve ter                                        │
│    ┌────────────────────────────────────────────────────────────────┐  │
│    │ ⌷                                                              │  │
│    └────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│    Palavras que eliminam a vaga                                        │
│    ┌────────────────────────────────────────────────────────────────┐  │
│    │ júnior ×   estágio ×   ⌷                                       │  │
│    └────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│  ┌──────────────┐  ┌──────────────┐                                    │
│  │    Salvar    │  │   Cancelar   │                                    │
│  └──────────────┘  └──────────────┘                                    │
└────────────────────────────────────────────────────────────────────────┘
```

### Celular (390px)

Uma coluna, mesma ordem. Três diferenças que importam:

```
┌────────────────────────────────┐
│ Seu perfil de busca            │
│ A cada 50 min procuramos       │
│ vagas. Elas aparecem aqui.     │
│                                │
│ ┌────────────────────────────┐ │
│ │ ⬆ Currículo (opcional)     │ │
│ │ ⚠ O arquivo vai para o     │ │
│ │   provedor de IA. Só o     │ │
│ │   perfil fica salvo.       │ │
│ │ [   Escolher arquivo   ]   │ │
│ └────────────────────────────┘ │
│                                │
│ Cargos        ⟨do currículo⟩   │
│ ┌────────────────────────────┐ │
│ │ Backend Engineer ×         │ │
│ │ Software Engineer ×        │ │
│ └────────────────────────────┘ │
│                                │
│ Senioridade   ⟨do currículo⟩   │
│ ┌────────────────────────────┐ │
│ │ Pleno                   ▾  │ │
│ └────────────────────────────┘ │
│                                │
│ ▸ Mais filtros                 │
├────────────────────────────────┤
│ ┌────────────────────────────┐ │  ← barra fixa no rodapé
│ │          Salvar            │ │
│ └────────────────────────────┘ │
└────────────────────────────────┘
```

1. **Senioridade e "Trabalho remoto" deixam de ser lado a lado.**
2. **O botão salvar vira barra fixa no rodapé** (`sticky bottom-0`, fundo
   `--surface`, borda superior). Sem isso, com "Mais filtros" aberto a página
   passa de 2.000px e o botão fica longe demais do polegar.
3. **O selo `⟨do currículo⟩` desce para baixo do rótulo** quando não cabe na
   mesma linha, em vez de espremer o rótulo.

---

## 3. Os campos

Todos os filtros são opcionais no formato do prompt. "Opcional no JSON" não
significa "todos com o mesmo peso na tela" — por isso a divisão abaixo.

### Visíveis de cara

| Rótulo visível | Controle | Obrigatório | Campo no JSON |
|---|---|---|---|
| Cargos | lista de fichas (chips) + texto | não¹ | `job_titles` |
| Tecnologias | lista de fichas + texto | não¹ | `technologies` |
| Senioridade | select (Qualquer / Júnior / Pleno / Sênior / Staff+) | não | `seniority` |
| Trabalho remoto | rádio (Tanto faz / Só remotas / Só presencial) | não | `remote` |
| Onde | lista de fichas + texto | não | `locations` |

### Recolhidos em "Mais filtros"

| Rótulo visível | Controle | Obrigatório | Campo no JSON |
|---|---|---|---|
| Salário mínimo anual | texto `inputMode="decimal"` | não | `salary_min` |
| Salário máximo anual | texto `inputMode="decimal"` | não | `salary_max` |
| Moeda | select (USD / EUR / GBP / BRL) | não² | `currency` |
| Tipo de contrato | checkboxes (CLT/Full-time, PJ/Contract, Freelance, Estágio) | não | `employment_types` |
| Publicadas nos últimos | select (7 / 15 / 30 dias) | não | `posted_within_days` |
| Seu fuso | select de fusos | não | `timezone` |
| Mostrar só vagas que patrocinam visto | checkbox | não | `visa_required` |
| Palavras que a vaga deve ter | lista de fichas | não | `keywords` |
| Palavras que eliminam a vaga | lista de fichas | não | `exclude_keywords` |

¹ Nenhum campo é individualmente obrigatório, mas **o formulário todo vazio
não salva** — ver Regras, abaixo.
² Obrigatório *condicionalmente*: se houver `salary_min` ou `salary_max`, a
moeda precisa estar escolhida. Um número sem moeda não é filtro, é ruído.

### Por que essa divisão

O critério não foi "quantos campos cabem" e sim **o que o card diz que decide a
busca**. O `grupo` sai de "senioridade, tecnologias ordenadas e região" — os
três estão visíveis. `job_titles` entra junto porque é o que o Firecrawl
efetivamente pesquisa, e `remote` porque para o dev brasileiro que quer
trabalhar fora essa é praticamente a premissa da feature.

O resto foi recolhido por um motivo por campo:

- **Salário, moeda, contrato, dias, fuso** — refinamento de quem já viu
  resultado ruim. Ninguém sabe pedir "USD 90k" antes de ver o que aparece.
- **Visto** — importante, mas é caso de minoria e a pergunta é confusa antes
  de a pessoa ver vagas que exigem visto.
- **`keywords` / `exclude_keywords`** — são as mais avançadas de todas. Exigem
  entender que a busca é textual. Postas de cara, viram um campo em branco que
  a pessoa encara sem saber o que escrever.

**Deixados de fora da tela** (existem no formato, não têm campo): `companies` e
`industries`. Não estão na lista que a tarefa pediu e, mais importante, exigem
que a pessoa já tenha empresa-alvo em mente — é filtro de quem procura numa
empresa específica, que não é o problema desta feature. O JSON aceita os dois;
a tela simplesmente não os oferece por ora. **Isso é decisão de produto e vale
confirmar** (§Perguntas).

### Regras de validação

| Situação | O que a tela faz |
|---|---|
| Tudo vazio, sem CV | Não salva. Mensagem no botão: *"Preencha pelo menos um filtro, ou suba o seu currículo — senão a busca não sabe o que procurar."* |
| `salary_min` > `salary_max` | Erro nos dois campos: *"O mínimo está acima do máximo."* |
| Salário sem moeda | Erro na moeda: *"Escolha a moeda do salário."* |
| Salário não numérico | Erro: *"Use só números, sem pontos nem vírgulas. Ex.: 90000"* |

O botão **nunca fica cinza e mudo**. Botão desabilitado sem explicação é o
padrão que mais gera abandono em formulário opcional: a pessoa não descobre o
que falta. Ele fica habilitado, e ao clicar explica — com `aria-invalid` e
texto, nunca só cor.

---

## 4. Como mostrar o que a IA leu do CV

O card nomeia o pior desfecho: *"um CV lido errado que produz busca ruim, sem
ela ver o porquê"*. A tela precisa deixar **impossível** confundir o que a IA
supôs com o que a pessoa afirmou. JOB-04 já estabelece o mesmo princípio para
os cartões de vaga ("extraído versus inferido não podem ter a mesma
tipografia") — vale usar a mesma lógica aqui, para a aplicação ter um idioma
só.

### Três sinais redundantes, nenhum deles cor

A regra do projeto proíbe sinalizar só por cor. A proposta usa **três sinais
que sobrevivem sozinhos** — em preto e branco, para daltônicos, e no leitor de
tela:

**1. Um selo de texto ao lado do rótulo.** Literalmente as palavras
`do currículo`, dentro de uma cápsula com borda. É texto, então é lido e é
traduzível.

```
Tecnologias                               ⟨do currículo⟩
```

**2. Uma borda esquerda de 3px no campo.** Forma, não cor — mesmo em
monocromático a barra aparece. É o mesmo recurso que `SettingsPage.tsx` já usa
no aviso (`border-l-4` com `WARN_INK`), então não é padrão novo.

**3. Uma linha de ajuda abaixo do campo**, só nos campos preenchidos pela IA:
*"Veio do currículo. Editar substitui pelo que você escrever."*

Para leitor de tela, o selo entra no `aria-describedby` do campo, de forma que
ao focar o campo a pessoa ouça *"Tecnologias, Node.js TypeScript AWS,
preenchido a partir do seu currículo"* — sem depender de enxergar o selo.

### O selo some quando a pessoa edita

Esta é a parte que faz o desenho honesto, e é o Case B do prompt virando
interface:

> **Editar um campo remove o selo daquele campo, na hora.** Passou a ser dado
> da pessoa, e filtro explícito vence o CV.

Sem isso o selo mente: diria "do currículo" sobre um valor que a pessoa
digitou. E "reverter para o que veio do CV" **não** existe como botão — é
funcionalidade rara que custa guardar o valor original e explicar mais um
controle. Quem se arrepender sobe o arquivo de novo.

### O resumo em uma frase, no topo

Acima dos campos, o bloco pós-upload diz **em português corrido** o que a IA
entendeu:

> Entendemos que você é uma pessoa desenvolvedora backend pleno, com ~5 anos,
> focada em Node.js e AWS.

Isso existe porque campo a campo é fácil errar de olhar. A frase inteira, lida
de uma vez, torna óbvio o erro grosso — é onde a pessoa percebe "espera, eu sou
frontend". Também é o que atende ao caso de borda *"arquivo que não é CV: a IA
classifica, e a pessoa vê o que ela entendeu"*: se o arquivo era uma fatura, a
frase diz isso, e a pessoa vê o motivo em vez de um formulário com lixo.

### O que NÃO fazer

- **Fundo colorido no campo** — cor sozinha, proibido; e ainda por cima
  atrapalha a leitura do valor.
- **Ícone de robô sem texto** — exige aprender uma convenção.
- **Dourado (`--accent`) como texto do selo** — medido: 2,38:1 sobre branco,
  reprova em AA. Se o selo usar dourado, tem que ser `--accent-ink`, medido em
  **6,24:1** no claro e **10,47:1** no escuro (gold-300 sobre slate-900).
  Ambos passam.

---

## 5. O aviso de privacidade

Critério de aceite: a tela avisa **antes do upload**. Então ele fica dentro da
caixa de upload, acima do botão de escolher arquivo — não em rodapé, não em
tooltip, não em modal depois da escolha. Um aviso que aparece depois de
escolher o arquivo chega tarde: a decisão já foi tomada.

### Texto exato (antes do upload)

> **O arquivo é enviado para o provedor de IA para ser lido.**
> Guardamos só o que ele entendeu: stack, senioridade e anos de experiência.
> O arquivo e o texto do currículo não ficam salvos em lugar nenhum.

Três frases, 37 palavras. A primeira é o custo, a segunda é o que fica, a
terceira é o que não fica. Sem "nos termos da nossa política", sem "podemos vir
a compartilhar", sem link para ler depois.

### Texto exato (depois do upload)

> O arquivo já foi descartado. Não guardamos o texto dele.

Fecha o ciclo. Dizer antes que não guarda e nunca mais tocar no assunto deixa
a dúvida de pé.

### Marcação

O bloco é um `<p>` normal com borda esquerda, **não** um `role="alert"`: alert
interrompe o leitor de tela, e isto é informação de contexto, não urgência. O
`<input type="file">` recebe `aria-describedby` apontando para o aviso, então
quem chega pelo teclado ouve o aviso ao focar o botão — que é exatamente o
"antes do upload" para quem não vê a tela.

O ícone `⚠` é decorativo e leva `aria-hidden` — o texto já diz tudo.

---

## 6. Os estados de erro

Todos seguem a mesma regra: **borda + `aria-invalid` + texto**, nunca só cor,
com `WARN_INK`. Todos aparecem dentro da caixa de upload, com `role="alert"`, e
**nenhum deles preenche campo nenhum**.

Cada mensagem diz o que houve **e o que fazer** — mensagem que só diagnostica
deixa a pessoa parada.

| Caso de borda | Mensagem exata |
|---|---|
| PDF que é imagem escaneada | **Esse PDF é uma imagem — não tem texto para ler.** Costuma acontecer com currículo escaneado ou fotografado. Exporte o currículo direto do editor (Word, Google Docs, LinkedIn) e tente de novo, ou preencha os filtros na mão. |
| PDF protegido por senha | **Esse PDF está protegido por senha e não abre.** Salve uma cópia sem senha e suba de novo. |
| DOCX corrompido | **Não conseguimos abrir esse arquivo.** Ele pode estar incompleto ou corrompido. Tente exportar de novo como PDF, ou preencha os filtros na mão. |
| Arquivo acima de 5 MB | **Esse arquivo tem {X} MB e o limite é 5 MB.** Currículo costuma ter menos de 1 MB — se o seu está grande, provavelmente tem imagem em alta resolução. Exporte de novo em PDF comum. |
| Arquivo que não é CV | **Isso não parece um currículo.** Entendemos que é {o que a IA classificou}. Se você quis subir outro arquivo, escolha de novo; se acha que erramos, preencha os filtros na mão. |
| Tipo não suportado | **Aceitamos PDF e DOCX.** Esse arquivo é {extensão}. |
| Falha do provedor de IA | **Não conseguimos ler o currículo agora** — a falha foi nossa, não do seu arquivo. Tente de novo em alguns minutos, ou preencha os filtros na mão. |

Duas observações:

- **O tamanho é checado no front e no back.** O front evita subir 40 MB à toa;
  o back é quem recusa de verdade (o card manda). A mensagem é a mesma nos
  dois, e o `{X}` vem do arquivo real.
- **Toda mensagem termina oferecendo "preencha os filtros na mão"**, menos as
  que têm conserto trivial (senha, extensão). O CV é opcional — um erro de
  upload nunca pode parecer um beco sem saída.

Os dois últimos casos não estão na lista do card, mas caem no mesmo lugar da
tela: tipo não suportado é o mais frequente na prática (alguém sobe `.pages` ou
`.txt`), e falha do provedor é inevitável. Valem como sugestão.

---

## 7. O que reusar e o que é novo

### Reusar como está

| O quê | Onde | Para quê |
|---|---|---|
| `Recolhivel` | `components/Recolhivel.tsx` | o bloco "Mais filtros". Já resolve `inert` quando fechado, `prefers-reduced-motion` e a animação sem medir altura. |
| `LoadingState` | `components/States.tsx` | carregar o perfil salvo ao abrir a página |
| `ErrorState` | `components/States.tsx` | falha ao **carregar** o perfil (com `onRetry` → `reload`) |
| `WARN_INK` | `components/blocks/BlockRenderer.tsx` | borda e texto de todo erro |
| `useAsync` / `useDocumentTitle` | `lib/` | dados e título |
| Máquina `ocioso/salvando/salvo/erro` | padrão de `SettingsPage.tsx` | tanto o upload quanto o salvar do perfil |
| Aviso com `border-l-4` | padrão de `SettingsPage.tsx` (linhas 70–85) | o aviso de privacidade |

### Copiar e adaptar

**`Field.tsx` → `components/vagas/Field.tsx`.** JOB-04 já decidiu isso
("o padrão de `Field.tsx`, copiado para `components/vagas/`, não promovido a
global ainda"), e esta tela deve seguir a mesma decisão para as duas não
divergirem. `TextField` e `SelectField` servem quase sem mudança; o `Envelope`
precisa aceitar um **adorno à direita do rótulo** (o selo `⟨do currículo⟩`) e
compor o `aria-describedby` com mais de um id.

O que **não** copiar da invoice: o acordeão numerado. JOB-04 já explica o
porquê e vale igual aqui — numerar sugere uma ordem que não existe entre
filtros opcionais.

### Novo

| Componente | Por quê |
|---|---|
| `CampoFichas` (chips) | Não existe nada parecido no projeto. É o controle de `job_titles`, `technologies`, `locations`, `keywords`, `exclude_keywords` — cinco campos, então vale um componente. Cuidados: `<ul>` de fichas com botão "remover {valor}" (`aria-label` com o valor, alvo ≥24px), Enter e vírgula adicionam, Backspace no campo vazio remove a última, e a lista precisa de `aria-live="polite"` para anunciar o que entrou e saiu. |
| `CaixaUploadCV` | Botão de arquivo + aviso + estados + mensagens de erro. É específico demais para ser genérico. Se usar arrastar-e-soltar, o `<input type="file">` continua obrigatório — arrastar não é acessível por teclado. |
| `SeloOrigem` | A cápsula `do currículo`. Trivial, mas centraliza o texto e o `id` que o `aria-describedby` referencia. |
| `EmptyState` da `/vagas` | O de `States.tsx` é um parágrafo de uma linha. Aqui o vazio precisa ensinar, e é o próprio formulário — não é o mesmo componente. |

---

## 8. Recomendação e o que ficou em aberto

**A recomendação é a tela única acima**: upload como oferta no topo, filtros
sempre visíveis, avançados recolhidos, salvar fixo no rodapé do celular. Ela
sai direto do card — "o currículo é um filtro a mais" — e é a única forma dos
três caminhos não virarem três fluxos para manter.

Considerei e descartei duas alternativas:

- **Assistente em passos** (CV → confirmar → filtros → salvar). Faz o caminho
  "só filtros" atravessar telas que não interessam a ele, e esconde o
  formulário de quem quer só digitar. Descartado.
- **Duas colunas com prévia do perfil à direita**, como a invoice. Aqui o
  "artefato" é o próprio formulário preenchido — uma prévia repetiria os
  mesmos dados ao lado, gastando metade da tela para não dizer nada novo. A
  prévia útil é a lista de vagas, que é JOB-04.

### Perguntas que ficaram

1. **`companies` e `industries` ficam de fora da tela?** Estão no formato do
   prompt e não na lista da tarefa. Deixei sem campo. **É decisão de produto.**
2. **O agrupamento pode fazer o filtro pessoal não valer.** O `grupo` sai de
   senioridade + tecnologias + região; `salary_min` **não entra na assinatura**.
   Então duas pessoas com o mesmo grupo e salários mínimos diferentes recebem a
   mesma rodada — o salário precisa ser aplicado **na exibição**, por perfil,
   não na busca. Se isso não for verdade, a tela está prometendo um filtro que
   o motor ignora. **Vale confirmar com quem for implementar JOB-03.**
3. **Quantos perfis por pessoa?** O card fala em "o perfil", no singular, mas
   quem procura backend e quem procura SRE precisaria de dois. Desenhei para
   **um só**. Se forem vários, a tela ganha um seletor no topo e isso muda o
   layout. **Decisão de produto.**
4. **O aviso "avisamos quando aparecer algo" promete e-mail**, que o card do
   e-mail diz estar fora de escopo. Enquanto não existir, o texto deve ser
   *"as vagas aparecem aqui"*, não *"avisamos"* — senão a tela mente. Ajustei
   o mockup para a versão honesta; a frase com "avisamos" só entra quando o
   e-mail existir.
