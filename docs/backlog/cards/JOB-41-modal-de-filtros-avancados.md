# JOB-41 · Modal de filtros avançados, com contagem ao vivo e buscas salvas

**Estado:** feito (26/08/2026)
**Tamanho:** G

## Por quê

A barra de filtros de hoje tem **8 dropdowns de valores fixos**. O catálogo de
cada eixo é escrito à mão em `vaga-filtro.ts` e não sabe nada sobre o que existe
de fato: "Brazil" aparece igual quando há 16.780 vagas e quando há zero.

O [JOB-39](JOB-39-freehire-como-motor-de-busca.md) ligou o freehire, e com ele
veio uma API de facetas que muda o que é possível — **25 facetas, cada valor com
contagem ao vivo, e a contagem responde aos outros filtros**.

Medido em 26/08:

| Consulta | `countries.br` |
| --- | ---: |
| sem filtro | 566.010 |
| `regions=latam` | **16.780** |
| `regions=latam&q=software engineer` | **2.850** |

O alvo é o modal "All filters" do freehire, que o stakeholder mandou como
referência visual.

## O que a referência tem, e a nossa tela não

- **Modal de tela cheia**, e não dropdowns na barra
- **Coluna esquerda de categorias**, agrupadas em três seções, com badge de
  quantos filtros ativos há em cada
- **Painel direito rolável**, uma seção por categoria
- **Chips com contagem**: `Software Engineering 699`, `Backend 639`
- **Chip com 0 aparece desabilitado** (`Network Engineering 0`, `Hardware 0`) —
  é assim que a referência resolve o "filtro que não filtra": mostra a ausência
  **antes** do clique
- **Busca dentro da categoria** ("Search roles", "Search specializations…")
- **Rodapé fixo**: `Clear all` à esquerda, `Show 699 jobs →` à direita, com o
  número atualizando conforme se marca
- **Buscas salvas** em `My filters`, com alerta por e-mail/Telegram

## O contrato da API, verificado

Lido do `openapi.yaml` deles em 26/08 — **44 parâmetros** em `/jobs/search`.

**A exclusão é o achado que muda o desenho.** A documentação de `advanced-search`
diz que 19 dos 20 filtros são de três estados (off → incluir → excluir → off), e
a spec confirma o mecanismo:

> `?source_exclude=adzuna` — `<facet>_exclude` removes matches. **Every** string
> facet in this schema supports its `_exclude` twin, whether or not it is
> declared.

Medido, com `q=engineer&regions=latam` (baseline **14.976**):

| Parâmetro | Total | Ignorado? |
| --- | ---: | --- |
| `skills_exclude=python` | **9.530** | não |
| `countries_exclude=br` | 11.710 | não |
| `source_exclude=whatjobs-br` | 14.401 | não |
| `company_type_exclude=outsource` | 12.454 | não |
| `collections_exclude=yc` | 14.752 | não |
| _(controle)_ `exclude_skills=python` | 14.976 | **sim** |
| _(controle)_ `not_skills=python` | 14.976 | **sim** |

Os dois controles são o que prova que os outros funcionaram: nome errado é
**ignorado em silêncio** e devolve o total intacto (a armadilha do
`ignored_params` do JOB-39). E `collections_exclude` funciona, apesar de a
documentação dizer que collections não tem exclusão — vale a medição.

Outros parâmetros úteis que a spec revelou: `ExperienceYearsMin/Max`,
`SkillsMode=and`, `Sort` (`created_at`, `posted_at`, `salary_min`, `salary_max`)
e `Order` (`asc`/`desc`).

## As 11 categorias, mapeadas nas facetas

Todas verificadas contra `/api/v1/jobs/facets?regions=latam&q=software engineer`.

| Categoria | Facetas | Existe? |
| --- | --- | --- |
| Role | `role`, `category`, `seniority`, `ai_archetype` | sim |
| Experience | `seniority`, `education_level`, `experience_years_min/max` | sim |
| Location | `countries`, `cities`, `regions`, `relocation` | sim |
| Work & employment | `work_mode`, `employment_type`, `company_type`, `company_size` | sim |
| Skills | `skills` (1.200 valores) | sim |
| Industry & collection | `domains`, `collections`, `is_tech` | sim |
| Company | `company_type`, `company_size`, `company_slug`, `source` | sim |
| Salary | `salary_currency`, `salary_period`, `salary_min/max` | sim |
| Language | `english_level`, `posting_language` | sim |
| Relocation | `relocation`, `visa_sponsorship` | sim |
| Posted | `reality`, `posted_within_days` | sim |

`skills`, `cities` e `role` têm 1.200 valores cada — **por isso a busca dentro
da categoria não é enfeite**: sem ela, a seção é impossível de usar.

## A decisão que trava o resto: categoria sem dado some

**Os outros motores não têm facetas.** O ATS devolve título e local; a IA lê a
descrição. Language, Relocation, Industry e Company size só existem enquanto o
freehire responde.

A regra da casa é explícita, e está escrita em `vaga-filtro.ts`:

> **Filtro que não filtra é pior que filtro ausente**, porque a pessoa acredita
> ter reduzido a lista. O QA mediu em 19/08: escolher "Degree: PhD" devolvia as
> mesmas 644 vagas de não escolher nada.

Foi por isso que `contratos`, `beneficios` e `formacoes` já saíram da barra.

**Decisão (26/08): a categoria sem dado é ESCONDIDA**, não desabilitada. Com o
freehire fora, o modal encolhe para as categorias que todos os motores
sustentam. Ninguém marca o que não vai valer, e não há texto de desculpa a ler.

O chip com contagem 0 resolve o caso menor — dentro de uma categoria viva, um
valor sem resultado aparece desabilitado com o zero à mostra, como na referência.

## Buscas salvas, com alerta

Entram nesta leva, por decisão de 26/08.

O gancho já existe: o e-mail semanal do [JOB-24](JOB-24-email-semanal.md) e o
Telegram do [JOB-32](JOB-32-telegram-como-canal.md) estão prontos e hoje mandam
o resultado de um filtro só. Uma busca salva é o mesmo envio, com o filtro que a
pessoa escolheu.

Precisa de:

- Modelo `SavedSearch` no Prisma (`userId`, `nome`, os filtros em `Json`, canais,
  `createdAt`/`updatedAt`) — e **migration**, porque o fluxo é `migrate deploy`
- `@@map("savedsearches")`, `onDelete: Cascade`, relação inversa em `User`
- Coluna `Json?` recebe `Prisma.DbNull`, nunca `null`
- Rotas de CRUD, todas protegidas pelo guard global
- A seção `SAVED / My filters` no topo da coluna esquerda do modal

**Busca salva exige sessão**, ao contrário de filtrar — que continua anônimo.
Sem login, a seção `SAVED` não aparece e o rodapé não oferece salvar.

## Como implementar

**Backend**

1. `FiltrosDto` ganha os eixos novos, cada um com `@IsOptional()` e validação —
   `forbidNonWhitelisted` rejeita campo sem decorador com 400
2. `busca-freehire.service.ts`: `montar()` traduz os eixos para os parâmetros
   deles, incluindo os `_exclude`. **Todo valor sai de `/jobs/facets`**, nunca
   de constante escrita à mão — valor inventado é ignorado em silêncio
3. Rota nova de facetas: recebe a seleção atual, devolve as contagens. É ela que
   alimenta os chips e o `Show N jobs`
4. Os outros motores ignoram os eixos que não sustentam — e é a rota de facetas
   que diz à tela quais categorias existem agora
5. `SavedSearch`: modelo, migration, serviço e controller

**Frontend**

6. `ModalFiltros.tsx`: duas colunas, rodapé fixo, `role="dialog"`,
   `aria-modal`, foco preso, Esc fecha, foco volta ao botão que abriu
7. `ChipFiltro.tsx`: três estados. **O estado não pode ser só cor** — incluir e
   excluir precisam de glifo ou borda distinta, e `aria-pressed` não basta para
   três estados (usar `aria-label` que diga o estado por extenso)
8. Busca dentro da categoria, para as de 1.200 valores
9. A barra de hoje continua, com um botão `All filters` que abre o modal
10. `frontend/src/types/api.ts` espelha os DTOs novos à mão

## Critérios de aceite

- [x] O modal abre, tem as 11 categorias e o badge de ativos por categoria
- [x] Cada chip mostra a contagem, e ela **muda** quando outro filtro é marcado
      — medido: `br` 566.137 → 16.780 (LATAM) → 2.850 (+ cargo)
- [~] Chip com 0 aparece desabilitado, e não some — **não verificável**: a API
      omite os zeros. Ver a nota abaixo
- [x] Os três estados funcionam e são distinguíveis **sem depender de cor** — glifo `+`/`−`, borda sólida/tracejada, e `aria-label` por extenso
- [x] O número **não** promete o que a lista não entrega — resolvido tirando o
      total de dentro do botão (ver a seção acima)
- [x] Categoria sem dado no motor ativo **não aparece** — testado com `FREEHIRE_API_URL` em host morto: `disponivel: false`, e a busca pela barra continua
- [x] Busca dentro da categoria existe em `skills`, `cities`, `role` e mais quatro
- [x] `Clear all` zera tudo, e o `N` volta ao total
- [x] Busca salva persiste — CRUD medido: cria, lista, muda canais, apaga, e
      apagar de novo dá 404
- [ ] A busca salva **dispara alerta** — **não feito.** O modelo guarda
      `porEmail`/`porTelegram`/`avisadoEm` e as rotas existem, mas o cron do
      e-mail semanal (JOB-24) e o do Telegram (JOB-32) continuam mandando o
      filtro único de hoje. É o que falta para a feature fechar o ciclo, e vira
      card próprio
- [~] Sem sessão, `SAVED` não aparece e filtrar continua funcionando — o
      código checa a sessão, mas **não foi testado**: `AUTH_DISABLED=true` nesta
      máquina significa que há sempre sessão, e não há como exercitar o caso
      anônimo sem religar o login
- [x] Teclado: Tab alcança tudo, Esc fecha, foco não escapa — trap adicionado depois do QA
- [ ] Os dois temas, cor sempre por token
- [x] Nenhum valor de filtro é constante escrita à mão — todos vêm de `facets`
- [ ] `meta.ignored_params` continua checado a cada chamada

## Uma decisão contra a referência: o total sai de dentro do botão

A referência escreve **`Show 699 jobs`** no botão, e lá isso é verdade — a
busca deles pagina o catálogo inteiro.

A nossa traz **60 por busca** (`LIMITE`, em `busca-freehire.service.ts`).
Medido em 26/08, depois de o modal já estar montado:

| Filtro | O modal contava | A busca entregava |
| --- | ---: | ---: |
| `engineer` + LATAM | 14.976 | **60** |
| \+ `skills_exclude=python` | 9.530 | **60** |
| \+ `english_level=c1` + `br` | 2.052 | **60** |

Copiar o rótulo da referência faria o botão prometer **250×** o que entrega, e
a pessoa descobriria contando as vagas na tela.

**O número saiu para fora do botão**: à esquerda, `14,976 matches` (quantas
existem); à direita, `Show jobs →` (o que vai acontecer). Duas afirmações
verdadeiras no lugar de uma falsa, sem perder a informação que faz o modal
valer a pena.

## O modal entra por `import()` dinâmico

Importado estaticamente, ele empurrou o bundle principal de **436 para 449 KB**,
estourando o limite de 440 que o `scripts/qa-rapido.py` mede.

A saída é a mesma do jsPDF no Invoice: `lazy()` + `Suspense`, e o chunk só é
baixado por quem clica em "All filters". Quem chega em `/vagas` e busca pela
barra nunca paga por ele.

| | Bundle principal | Chunk do modal |
| --- | ---: | ---: |
| antes do card | 436 KB | — |
| estático | 449 KB ✗ | — |
| **dinâmico** | **438 KB** ✓ | 11,3 KB |

## O que o QA achou, e o que cada bug ensinou

Um QA adversarial rodou o modal em 26/08 e achou **seis defeitos, três
graves** — todos meus. O relatório estava certo em todos.

**1. Metade das seções derrubava o modal (grave).** Marcar um chip em 7 das 22
seções dava 400. O modal é multi-seleção; a barra é de um valor só
(`regiao?: string`), e eu reusei os campos dela.

E o `employment_types`, que o QA não conseguiu diagnosticar, tinha causa
**diferente e pior**: o `@IsIn` do nosso DTO lista `clt, pj, contractor,
freelance` — vocabulário de contrato brasileiro — e a faceta do freehire fala
`full_time, contract, internship`. Duas listas incompatíveis com o mesmo nome.

Correção: cada eixo do modal tem campo próprio (`regions`, `work_modes`,
`seniorities`, `currencies`, `employment_kinds`, `visa_sponsorships`,
`ai_archetypes`, `sources`). E quando os dois existem, **o do modal ganha** —
somados, a API os juntaria com AND e "LATAM" da barra brigaria com "Europa" do
modal devolvendo zero. Medido: `{regiao: latam, regions: [eu]}` → 195.075, o
número da Europa.

**2. Excluir um chip o fazia sumir (grave).** A API não devolve na faceta o
valor excluído — ele deixou de ter resultado, por definição. Como os chips
saíam só da faceta, o chip desaparecia: o filtro ficava ativo, **invisível e
irreversível**, com o badge dizendo "Skills 1" e nenhum jeito de desfazer sem
`Clear all`. O terceiro estado do ciclo era inalcançável.

Correção: a tela reinjeta os valores selecionados que a faceta não trouxe, com
`total: null` — não sabemos quantas vagas teriam, e inventar um número seria
pior que omitir.

**3. "AI focus" gravava no campo errado (grave).** `ai_archetype` escrevendo em
`domains`, que é outro vocabulário: zero vagas, sempre. Agora dá 3.346.

**4. "Source" não filtrava nada (médio).** Eu tinha posto `campo: ''` achando
que só faria sentido excluir uma fonte. Mas o ciclo começa em incluir, então o
primeiro clique não gravava nada — **o "filtro que não filtra" que este card
proíbe**, cometido por mim dentro do próprio card. Incluir uma fonte é pedido
legítimo ("só Greenhouse"). Medido: `sources=workday` 291.186,
`sources_exclude=workday` 1.067.189, e a soma bate com o baseline de 1.358.375.

**5. O foco escapava do modal (médio).** `aria-modal` diz ao leitor de tela que
o resto é inerte, mas **não impede o Tab**. No 6º Tab o foco pulava para um link
atrás do overlay. Agora há trap de verdade, ciclando nas duas pontas.

**6. Rótulos crus em Region (baixo).** O fallback capitalizava o código e
produzia `Eu`, `Us`, `Apac` — "Eu" se lê como palavra. Adicionados os rótulos.

### O achado que valia mais que os seis

> O `.catch()` único trata 400, 500 e indisponibilidade do freehire com a mesma
> mensagem. Foi isso que transformou um erro de contrato numa tela que parece
> funcionar como projetado.

Exato, e é o que fez o bug 1 sobreviver aos meus próprios testes: eu tinha
verificado a rota de facetas por `curl` com o corpo certo, e a tela mostrava
"unavailable" — que eu li como degradação funcionando.

Agora 4xx é tratado como defeito nosso: loga no console com o corpo do erro e
mostra mensagem diferente de "motor fora". **A degradação graciosa não pode
engolir o defeito que ela deveria expor.**

### A segunda rodada: dois defeitos de rótulo, mesma causa

A reverificação confirmou os seis corrigidos — **22/22 seções, 0 escapes de
foco em 220 teclas**, e a identidade do Source com delta exatamente zero
(291.185 + 1.067.153 = 1.358.338 = baseline). E achou mais dois, ambos da mesma
causa raiz:

`ROTULOS` era um mapa plano consultado **antes** de olhar a faceta, então
`us: 'United States'` — criado para Region — também atendia `countries`. A lista
de países mostrava um com nome e 39 com sigla. E digitar "brazil" na busca não
achava nada, porque a busca casa com valor canônico e rótulo, e 39 países não
tinham rótulo.

O segundo era a cauda de Region: a faceta traz 146 valores e **mistura região de
verdade com código de país** (`ru`, `kr`, `br`) — coisa da API, não nossa. O
mapa cobria os 10 primeiros, e do 11º em diante voltava o fallback: `Brazil 12`
e `Br 47` na mesma lista, parecendo duplicata.

Correção: rótulos **por faceta**, e os 237 países saem do
`Intl.DisplayNames` do próprio navegador — tabela que ele já tem e nós não
precisamos manter. Resolve os dois de uma vez, e a busca por nome passa a
funcionar de graça.

### A terceira rodada: dois cosméticos, e um argumento que me fez mudar de ideia

O SAVED foi verificado ponta a ponta — salvar, recarregar a página, reabrir,
carregar o filtro, apagar do banco —, alcançável por teclado e com o botão de
apagar rotulado. Zero regressões nas 22 seções.

Dois achados baixos, ambos corrigidos:

- **`South korea 13` ao lado de `South Korea 535`.** O fallback genérico
  capitalizava só a primeira palavra. Agora capitaliza cada uma.
- **Nome de busca só com espaços criava linha sem rótulo.** `@IsNotEmpty` roda
  **antes** do trim, então `"   "` passava e era gravado vazio: a busca virava
  uma linha só com o `×` e `aria-label` truncado em "Delete saved filter ".
  Corrigido com `@Transform` antes da validação — medido: `"   "` agora dá 400,
  e `"  Nome valido  "` grava sem os espaços.

**E a pergunta que eu tinha levantado — esconder da seção Region os valores que
são ISO-2 — foi respondida com número, contra a minha intuição:**

| par | ISO-2 | nome longo |
| --- | ---: | ---: |
| Rússia | `ru` **1.000** | `russia` 29 |
| Coreia do Sul | `kr` **535** | `south_korea` 13 |
| Brasil | `br` **47** | `brazil` 12 |

Esconder o ISO-2 apagaria o valor **maior** do par em 2 de 6 casos. E eles são
genuinamente distintos, não duplicata a deduplicar: `regions=br` → 47,
`regions=brazil` → 12, os dois juntos → 59, exatamente aditivo.

**Decisão: não esconder.** Dois chips de rótulo idêntico continuam
indistinguíveis na tela — é o custo aceito. Se um dia incomodar, o caminho é
desambiguar o rótulo, nunca sumir com o valor.

### Um critério que estava escrito sobre suposição errada

`Chip com 0 aparece desabilitado, e não some` **não é verificável**: a API omite
os valores sem resultado em vez de devolvê-los com zero, e o teto de 40 opções
por faceta ordena por volume. O código trata o caso e fica, porque a fonte pode
mudar — mas o critério, como escrito, descrevia um comportamento que a fonte não
produz.

## O risco a vigiar

Este card **aprofunda a dependência do JOB-39**: hoje o freehire é um motor que
pode ser desligado sem perda de interface. Depois dele, o freehire passa a ser
também a fonte do vocabulário dos filtros.

A mitigação é a decisão de esconder categoria — o modal encolhe em vez de
quebrar. Mas vale dizer em voz alta: **a tela vai ficar visivelmente menor
quando o freehire estiver fora**, e isso é um custo aceito, não um efeito
colateral esquecido.

## Relacionados

- [JOB-39](JOB-39-freehire-como-motor-de-busca.md) — o motor que traz as facetas
- [JOB-04](JOB-04-tela-de-vagas.md) — a barra de 8 dropdowns que este card estende
- [JOB-24](JOB-24-email-semanal.md) e [JOB-32](JOB-32-telegram-como-canal.md) — os canais de alerta
- [JOB-02](JOB-02-perfil-de-busca.md) — o CV que preenche filtros; precisa continuar valendo
