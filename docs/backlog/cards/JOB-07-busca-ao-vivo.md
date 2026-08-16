# JOB-07 · A busca acontece quando a pessoa clica

**Estado:** feito (15/08/2026)
**Tamanho:** M

## Por quê

A tela prometia uma coisa e fazia outra. Dizia *"we search every 50 minutes —
jobs show up here on their own"* e chamava de **"No jobs yet"** um estado que
era, na verdade, *"você ainda não buscou"*.

O stakeholder foi direto: *"o usuário vai entrar na aba jobs, vai estar liberado
para ele colocar os filtros, fazer a busca — e aí vai ser feita a varredura na
internet de no máx 1 min usando o prompt e o firecrawl. As outras coisas de
esperar por 50 min, vamos resolver depois, pois é uma funcionalidade diferente."*

## O fluxo

```
filtros → [Filter] → search (12s) → abre cada anúncio → vagas entram uma a uma
```

**Streaming, não espera.** Uma busca leva perto de um minuto, e um minuto de
tela parada parece travamento. A vaga aparece quando fica pronta: a primeira em
~15s, e a pessoa vê a lista crescer. Foi escolha explícita do stakeholder entre
"progresso com etapas" e "resultados aparecendo aos poucos".

SSE por `POST` + `fetch`/`ReadableStream`, e não `EventSource`: os filtros vão
no corpo, e o `EventSource` do navegador só faz GET e não aceita cabeçalho de
autorização.

## Duas fases, porque o JOB-01 mediu

O `search` **não devolve vagas** — devolve Indeed, Glassdoor e LinkedIn. E
abrir cada página custa ~36s. Então:

1. `search` acha os anúncios (12s), e o filtro de domínio corta os agregadores
   — a página deles é uma *busca*, não um anúncio, e custaria os mesmos 5
   créditos para extrair nada.
2. As páginas restantes são abertas em paralelo, com extração por schema.

## As defesas contra a IA inventar

Todas as quatro do card original, agora em código:

| Defesa | Onde |
| --- | --- |
| Campo ausente permanece ausente | `null` autorizado no schema; a tela escreve "not stated" |
| Trecho de origem | `salaryTrecho` e `elegibilidadeTrecho` guardam o **texto exato** da página |
| Validação por faixa | salário fora de 10k–2M vira `null` — foi assim que *"Mais de 100 candidatos"* virou salário no JOB-01 |
| Prompt injection | conteúdo raspado entra delimitado; CV e página nunca na mesma chamada |

Mais uma que nasceu do desenho da tela: **`paisIso` é validado contra uma lista
fechada de ISO**. Código fora da lista vira `null` — melhor sem bandeira que com
a errada, e a IA normalizando "Remote (US)", "USA" e "Estados Unidos" erra.

E `ehVaga: false` descarta página que não é anúncio (lista, busca, login).

## Os dois bloqueadores que estavam mapeados

Ambos matariam o streaming em silêncio, e foram corrigidos:

- **`timeout: 10_000` no axios** cortaria a busca aos 10s. A busca não passa
  por lá — é `fetch` com `AbortController` —, e o comentário no `api.ts` agora
  diz isso.
- **`nginx` sem `proxy_buffering off`** seguraria o stream inteiro no buffer e
  entregaria de uma vez no fim, anulando o streaming. Somado a
  `proxy_read_timeout 300s`, porque o default de 60s cortaria a conexão no meio.

## Verificado (15/08/2026)

| O que | Resultado |
| --- | --- |
| Busca com o recurso desligado | erro explicado, **checado no servidor** — não só na tela |
| Busca com token inválido | *"Search failed. Try again in a moment."* — não trava |
| Durante a busca | `Searching…` no texto **e** no botão, que fica desabilitado |
| Estado inicial | *"Search for jobs"*, dizendo o que fazer |
| A tela promete 50 min? | **não** |
| Erros de console | zero |

## O que NÃO foi verificado

**Uma busca real, com token válido do Firecrawl.** Não tenho um. O caminho foi
exercitado até a API rejeitar a chave falsa — que é exatamente o ponto em que
só uma chave real continua.

Isso significa que **a qualidade da extração não foi medida**: quantas vagas
voltam por busca, quantas vêm sem URL, se o salário sai limpo. O JOB-01 mediu
isso com a ferramenta por fora; aqui é o mesmo prompt, mas não é a mesma coisa
que ver rodando.

## O que fica para depois

A busca automática a cada 50 minutos, com perfil salvo e aviso por e-mail. É a
outra metade do [JOB-03](JOB-03-busca-em-segundo-plano.md) — o stakeholder
separou explicitamente: *"é uma funcionalidade diferente"*.
