# JOB-37 · O catálogo aprende com o que a busca encontra

**Estado:** feito (25/08/2026)
**Tamanho:** M

## A ideia

Do stakeholder, em 25/08: **quando a busca encontra uma vaga de uma empresa,
fonte ou slug que não está nos arquivos, gravar.**

O catálogo hoje é estático — 26.095 slugs em oito arquivos, montados por
importação e curadoria manual. Cada busca passa por dezenas de empresas e
**joga fora tudo o que aprendeu**. O motor de ATS ([JOB-20](JOB-20-motor-de-ats.md))
só consegue consultar quem já está na lista, então o catálogo é o teto da
busca: nenhuma vaga vem de empresa que ele desconhece.

Um catálogo que cresce sozinho é o tipo de vantagem que não se copia num fim de
semana — é acúmulo, e é exatamente o que o [JOB-18](JOB-18-niveis-de-busca.md)
identificou como a defesa real do produto ("catálogo + tempo + acúmulo", não
profundidade de leitura).

## ⚠️ A medição abaixo estava ERRADA — leia primeiro (25/08/2026)

**As três empresas que justificavam este card já estavam no catálogo.** A
medição original casou vagas com catálogo **pelo nome da empresa**; o catálogo é
indexado por **(ats, slug)**, que é como o motor consulta. Refeito pela chave
certa, contra as mesmas 67 URLs: **0 pares fora do catálogo**.

O que enganou foi a URL. As três publicam em domínio próprio, com Greenhouse por
baixo, e o `?gh_jid=` entrega:

```
careers.duolingo.com/jobs/...?gh_jid=...   → greenhouse:duolingo   (80 vagas)
epicgames.com/careers/jobs/...?gh_jid=...  → greenhouse:epicgames  (164)
app.careerpuck.com/job-board/udemy/...     → greenhouse:udemy      (14)
```

**E `careerpuck` não é um ATS novo** — `boards-api.greenhouse.io/v1/boards/careerpuck`
dá **404**. Era o exemplo que sustentava o argumento inteiro ("um ATS novo vale
todas as empresas que hospeda"), e ele não existe. É uma camada de apresentação
sobre o Greenhouse.

**A lição, que vale mais que o card:** a chave de identidade do catálogo é
`(ats, slug)`, e medir por nome de empresa produz um falso positivo que parece
uma oportunidade. Foi o que aconteceu aqui.

## O que foi medido antes de escrever este card — pela chave ERRADA

Contra as vagas que a busca já encontrou:

| | |
| --- | ---: |
| slugs no catálogo | **26.095** |
| empresas distintas nas vagas encontradas | 42 |
| **dessas, fora do catálogo** | **3** |

As três:

```
Duolingo      careers.duolingo.com/jobs
Udemy         app.careerpuck.com/job-board/udemy
Epic Games    epicgames.com/careers
```

**E o número pequeno é a descoberta, não a decepção.** Ele diz que a hipótese
está certa *e* que o ganho não vem de onde parecia:

- **39 de 42 já estavam no catálogo.** A curadoria funciona — a colheita não vai
  encher o catálogo de empresas novas por si só.
- **As 3 que faltavam não são ATS conhecido.** Duolingo e Epic Games têm quadro
  próprio no domínio da empresa; a Udemy usa `careerpuck`, um ATS que o produto
  não conhece. **Nenhuma das três seria alcançada por `slugs-greenhouse.json`.**

Ou seja: o valor não é "mais slugs de Greenhouse". É **descobrir ATS que ainda
não sabemos que existem** — o `careerpuck` é o exemplo. Um ATS novo não vale uma
empresa: vale todas as empresas que ele hospeda.

## Correção: a medição acima estava errada (25/08, na implementação)

**As três já estavam no catálogo.** A medição original casou as vagas com o
catálogo **pelo NOME da empresa**; o catálogo é indexado por **(ats, slug)**, e
é por (ats, slug) que o motor consulta. Refeito pela chave certa, contra as
mesmas 67 URLs:

| | |
| --- | ---: |
| pares (ats, slug) fora do catálogo | **0** |
| hosts sem slug na URL | 2 |

O que enganou foi a URL. As três publicam em **domínio próprio com o Greenhouse
por baixo**, e o `?gh_jid=` na query o entrega:

```
careers.duolingo.com/jobs/8734207002?gh_jid=8734207002        → greenhouse:duolingo
epicgames.com/careers/jobs/6134271004?gh_jid=6134271004       → greenhouse:epicgames
app.careerpuck.com/job-board/udemy/job/6142399004?gh_jid=...  → greenhouse:udemy
```

Confirmado contra a API real: `boards-api.greenhouse.io/v1/boards/duolingo`
responde 200 com **80 vagas**, `/udemy` com **14**, `/epicgames` com **164**. Os
três slugs estão em `empresas.json`.

**E o `careerpuck` não é um ATS novo** — é o mesmo Greenhouse com outra roupa,
servido de um domínio de terceiro. `boards-api.greenhouse.io/v1/boards/careerpuck`
dá 404, porque `careerpuck` nunca foi um board.

Isso derruba o exemplo que sustentava o card ("um ATS novo vale todas as
empresas que hospeda") sem derrubar o mecanismo: a fila e a verificação
continuam sendo o jeito de descobrir um ATS de verdade **se ele existir**. O que
mudou é a expectativa — ver "O que a colheita realmente rendeu", abaixo.

## Como funciona — o desenho do stakeholder (25/08)

> "O usuário vai fazer a busca e aí vão vir os dados da pesquisa: fontes,
> empresas e slug. E aí você itera entre eles, ou **salva num banco de dados
> para iterar de madrugada e verificar um por um**."

**São dois tempos, e separá-los é a decisão que faz isto funcionar.**

### Tempo 1 — a busca só ANOTA (barato, síncrono)

Toda vaga que entra já traz `url` e `company`. Dela saem host, caminho e slug,
sem nenhuma chamada de rede a mais. Se o par (host, slug) não está no catálogo,
vira linha numa fila de descobertas: quando, de qual busca veio, e um contador
de aparições.

**Anotar não pode custar nada.** A busca já leva ~58s; se a captura falhar ou
demorar, a vaga entra do mesmo jeito — o registro é efeito colateral, nunca
caminho crítico.

### Tempo 2 — de madrugada, VERIFICA uma por uma (caro, assíncrono)

Aqui está o motivo de o stakeholder ter separado os dois, e ele está certo:
**verificar é caro e não pode acontecer enquanto alguém espera.**

Cada descoberta é testada contra o ATS de verdade — o slug existe? devolve
vaga? quantas? A peça já existe: `busca-ats.service.ts:225` (`daEmpresa`)
consulta um slug e devolve as vagas dele; `greenhouse`, `ashby` e `lever` são os
três dialetos. Verificar uma descoberta é chamar isso e olhar o resultado.

O projeto já tem dois crons (`busca-de-vagas` a cada 50 min, `email-de-vagas` de
hora em hora), então o mecanismo é conhecido. Este é o terceiro, e o único que
roda em horário fixo — de madrugada, porque:

- **não compete com a busca do usuário** pelos mesmos limites de taxa dos ATS
- pode ser **lento de propósito** — uma consulta a cada N segundos não irrita
  ninguém, e é o que evita levar 429 do provedor
- se travar, ninguém está esperando

### Tempo 3 — promover é decisão humana

A verificação não grava em `backend/data/ats/`. Ela **classifica**: confirmada
(o slug existe e rende vagas), morta (404 ou zero vaga), ou desconhecida (host
que ainda não sabemos consultar). Alguém olha e decide.

Gravar automático deixaria dado curado e versionado à mercê de uma extração
ruim da IA. E o número que a verificação produz — *quantas vagas este slug
rendeu* — é justamente o que torna a decisão humana rápida.

### O que a verificação responde, e a anotação não

| Pergunta | Só anotando | Verificando |
| --- | --- | --- |
| Este slug existe? | não se sabe | sim/não |
| Rende quantas vagas? | não se sabe | número |
| O host é um ATS ou quadro próprio? | palpite pela URL | testado |
| Vale escrever adaptador para ele? | — | **quantas vagas já rendeu** |

**Agrupar por host é onde está o valor.** Três empresas em `app.careerpuck.com`
valem mais que trinta em `job-boards.greenhouse.io`: as primeiras revelam um ATS
inteiro por descobrir, as segundas só confirmam o que já se sabe.

## Onde isso encosta

- `backend/src/jobs/busca-ats.service.ts` — o motor que lê o catálogo
- `backend/src/jobs/busca.service.ts` — por onde toda vaga passa antes de virar
  `FoundJob`, e o ponto natural de captura
- `backend/data/ats/` — os oito arquivos, que continuam sendo a verdade
- [JOB-17](JOB-17-catalogo-de-ats.md) mediu o catálogo do look4job; este card é
  o inverso: em vez de importar de fora, colher de dentro

## O que decidir antes de implementar

- **A fila fica no banco** (decidido: o stakeholder pediu explicitamente, e a
  captura é em tempo de execução). **Mas a promoção precisa virar commit** — o
  catálogo é versionado em git, e uma descoberta que só existe no banco morre
  no próximo banco novo. Provavelmente um script que exporta as confirmadas
  para o `.json`, rodado à mão.
- **Guardar empresa que já está no catálogo?** Contar aparições de quem já se
  conhece dá outra coisa: quais empresas de fato publicam vaga, contra as 26 mil
  que estão lá e talvez nunca publiquem nada. Isso é um segundo card, e talvez
  mais valioso que este.
- **ATS desconhecido vira suporte novo?** Descobrir `careerpuck` não serve de
  nada sem alguém escrever o adaptador. A fila precisa dizer *quanto* cada host
  desconhecido já rendeu, para a decisão ser sobre número.

## Critérios de aceite

**Anotar:**
- [x] Vaga de empresa fora do catálogo gera registro com host, slug e origem
- [x] Aparição repetida incrementa contador, não cria linha nova
- [x] A captura não atrasa a busca — se falhar, a vaga entra do mesmo jeito
- [x] Nenhuma chamada de rede a mais no caminho da busca

**Verificar (o cron da madrugada):**
- [x] Cada descoberta é consultada no ATS real e classificada: confirmada, morta
      ou host desconhecido
- [x] Confirmada guarda **quantas vagas** o slug rendeu — é o número que decide
- [x] Ritmo limitado: uma consulta a cada N segundos, sem levar 429
- [x] Uma descoberta que falha não trava a fila — volta na próxima rodada, como
      já faz o `busca-agendada.service.ts` (marca em `finally`)
- [x] Não roda junto com a busca do usuário
- [x] Desligado por interruptor, como toda funcionalidade da casa

**Promover:**
- [x] Há como listar as descobertas por host, ordenadas por vagas rendidas
- [x] Nada é gravado nos arquivos de `backend/data/ats/` sem decisão humana

## O que foi entregue

| Peça | Onde |
| --- | --- |
| Extrator de (host, ats, slug), sem rede | `backend/src/jobs/descobertas.ts` |
| Captura (tempo 1) | `backend/src/jobs/descobertas.service.ts` |
| Cron das 3h (tempo 2) | `backend/src/jobs/verificacao-de-ats.service.ts` |
| Listagem por host + rota | `descobertas.controller.ts`, `GET /api/jobs/descobertas` |
| Fila no banco | `AtsDiscovery` / `ats_discoveries` |
| Interruptor `jobs.descobertas` | `RecursosService`, `/config/vagas` |
| Promoção (tempo 3) | `scripts/exportar-descobertas.py` |

Duas peças foram **reusadas em vez de reescritas**: `BuscaAtsService.vagasDoSlug`
chama o mesmo `daEmpresa` da busca (uma segunda implementação dos três
endpoints divergiria da primeira no primeiro dia), e o cron copia o padrão do
`busca-agendada.service.ts` — guarda `rodando`, teto por rodada, `checkedAt`
marcado mesmo no `catch`.

## O que foi medido rodando

Contra a aplicação de pé, com busca real (`docker compose`, 25/08):

| O que | Resultado |
| --- | --- |
| Busca ampla (`filtros: {}`) | 487 vagas, **3 descobertas** anotadas |
| Aparições agrupadas | 4 + 4 + 4, em **3 linhas** — não 12 |
| Ritmo do cron | 23:27:41 → 23:27:46 → 23:27:51 (**5s**, como configurado) |
| 429 dos ATS | **nenhum** |
| Rodada seguinte, 20s depois | "fila vazia" — não reprocessa nem sobrepõe |
| Cron às 3h dispara sozinho | sim (verificado com a expressão em `*/20s`) |

**A tabela entrou por `import()` dinâmico.** Embutida, ela levava o bundle
principal a 450,3 KB contra o teto de 450 KB do `qa-rapido.py` — o teto existe
porque quem só quer ler uma aula baixa esse arquivo. Em chunk separado: principal
446,75 KB, `CatalogoDescoberto` 3,95 KB, carregado só em `/config/vagas`.

**A captura não atrasa nem quebra a busca** (o critério que o briefing pediu
para provar, não afirmar). Com um `throw` forçado dentro de `gravar`:

```
vagas entregues: 487     erros na busca: 0
WARN [DescobertasService] captura de descobertas falhou: ANDAIME QA: falha forcada
```

A busca terminou com `fim` normal. Duas escolhas produzem isso: a captura roda
no `finally` do gerador (**depois** de a última vaga já ter saído) e sem
`await`, e `anotar()` embrulha tudo num `catch` que só registra.

**Com o interruptor desligado**: 487 vagas entregues, **0 gravadas**, e
`POST /jobs/descobertas/verificar` responde **403**.

## O que a colheita realmente rendeu — e por que isso importa

As três descobertas de uma busca de 487 vagas:

| Host | Slug adivinhado | Vagas | Classificação |
| --- | --- | ---: | --- |
| `careers.roblox.com` | `roblox` | 235 | **já no catálogo** |
| `epicgames.com` | `epicgames` | 164 | **já no catálogo** |
| `careers.duolingo.com` | `duolingo` | 80 | **já no catálogo** |

**Zero a promover.** As três são domínio próprio de empresa que o catálogo já
cobre pelo slug de Greenhouse — o que era novo era o *host*, não a empresa.

Isso obrigou um quarto estado, `ja_no_catalogo`, que não estava no desenho: **o
slug só aparece na verificação** quando a URL não o carrega, então a captura não
tinha como saber. Sem esse estado a fila mostraria "confirmada, 479 vagas" para
sempre, e quem fosse promover descobriria na mão que não havia nada a promover.
Na listagem, host cujo único desfecho é `ja_no_catalogo` **vai para o fim** —
ordenar só por vagas rendidas faria `careers.roblox.com` liderar a lista sem
haver o que fazer com ele.

**Um bug que a medição pegou.** A primeira versão punha o teste de `?gh_jid=`
antes do teste de host conhecido, e
`boards.greenhouse.io/applovin/jobs/...?gh_jid=...` caía no ramo "domínio
próprio": o slug `applovin` estava ali no caminho e era jogado fora. **Oito**
vagas da AppLovin viraram uma descoberta sem slug. Host conhecido passou a
ganhar do `gh_jid`, que só decide quando o host não diz nada.

## Por que pode não valer

Registrado antes de implementar, e **a medição confirmou**:

**Se todas as descobertas forem quadro próprio de empresa**
(`careers.empresa.com`), o catálogo não ganha nada. Foi exatamente o que
aconteceu: 3 de 3 são quadro próprio de empresa **já catalogada**, e a
`careerpuck`, que era o caso que justificava o card, não é um ATS — é Greenhouse
servido de outro domínio.

**O que o card entrega, então:** um mecanismo que funciona e ainda não achou
nada. Ele é honesto sobre isso — a tela diz "already in the catalog" em vez de
inflar um contador. A pergunta em aberto é se, com mais buscas e filtros mais
variados, aparece um ATS de verdade desconhecido. **Isso agora se responde por
medição:** a fila acumula, o cron conta vagas por host, e a lista ordena por
quanto cada um rendeu.

**O que decide se este card pagou** é uma linha com `ats: null` e muitas
aparições — um host que não sabemos consultar e que insiste em aparecer. Não
apareceu nenhuma em 487 vagas. Se em um mês de colheita continuar não
aparecendo, o card virou o contador bonito sem uso que ele mesmo previu — e é
melhor saber por medição do que por opinião.

## O que NÃO foi feito

- **Contar aparições de empresa que já está no catálogo.** O próprio card
  separa isso como um segundo card ("quais das 26 mil de fato publicam"), e ele
  ficou de fora. Hoje a captura descarta o par conhecido em vez de contá-lo.
- **Adaptador para ATS novo.** Não havia nenhum a escrever — nenhuma descoberta
  com `ats: null` sobreviveu à verificação.
- **A promoção nunca rodou sobre uma descoberta de verdade**, porque não houve
  nenhuma confirmada. `scripts/exportar-descobertas.py` foi exercitado com uma
  linha `confirmada` inserida à mão: o ensaio (padrão) listou-a, `--aplicar`
  gravou a entrada em `empresas.json` no formato certo, e rodar de novo não
  duplicou. Os dois foram desfeitos depois — `empresas.json` está intacto.


## Dois bugs que a medição pegou durante a implementação

**Ordem invertida no extrator.** `boards.greenhouse.io/applovin/jobs/...?gh_jid=...`
caía no ramo "domínio próprio" e o slug `applovin`, que estava ali no caminho,
era jogado fora — 8 vagas viravam uma descoberta sem slug. Host conhecido passou
a ganhar do `gh_jid`.

**Bundle estourado.** A tabela levou o principal a 450,3 KB contra o teto de
450 KB do `qa-rapido.py`. Baseline em worktree limpo: 445,5 KB — a regressão era
do card. Resolvido com `import()` dinâmico: chunk de 3,95 KB só em
`/config/vagas`.

## O interruptor para o que gasta, não a leitura

`jobs.descobertas` desligado interrompe a **captura** e o **cron** — o que sai
para a rede. A listagem (`GET /jobs/descobertas`) continua respondendo, porque é
`@AdminOnly()` e só lê o que já está no banco. Desligar é "pare de gastar", não
"esconda o que já foi colhido".

## O que ficou de fora

- **Contar aparições de empresa já catalogada** — o próprio card separa como
  segundo card, e a medição acima o torna mais interessante que este: descobrir
  **quais das 26 mil empresas de fato publicam vaga** é a pergunta que sobrou.
- **Adaptador para ATS novo** — não havia nenhum. Nenhuma descoberta com
  `ats: null` sobreviveu.
- **Promoção sobre descoberta real** — não houve nenhuma confirmada. O script
  foi exercitado com uma linha inserida à mão (ensaio listou, `--aplicar` gravou
  no formato certo, rerodar não duplicou) e desfeito: `empresas.json` tem 0
  linhas de diff.
