# JOB-14 · O interruptor é do Firecrawl, não da busca

**Estado:** feito (18/08/2026)
**Tamanho:** P

## Por quê

O stakeholder desmarcou *"Buscar vagas na web"* esperando desligar o Firecrawl,
e a busca inteira parou. A leitura dele estava certa e o produto é que estava
errado: depois do [JOB-13](JOB-13-busca-pela-ia.md) existem **dois motores**, e
um interruptor que mata os dois não representa mais o sistema.

Pior, o que ele viu na tela foi `0 jobs found` com a explicação embaixo — a
mensagem existia (`role="alert"`), mas perdia para o número zero logo acima.

## A mudança

**`Ativar Firecrawl`**, e o desligado passa a significar *busca pela IA*:

| Interruptor | Motor | Antes |
| --- | --- | --- |
| Ligado | Firecrawl abre cada anúncio | igual |
| Desligado | **IA com `web_search`** | busca bloqueada |
| Desligado, sem chave de IA | erro dizendo o que cadastrar | "turned off" |

No backend a flag deixou de significar "a busca está ligada":

- `firecrawlAtivo` — o motor escolhido
- `buscaPossivel` — existe **algum** motor utilizável; é o que o controller
  checa antes de recusar

A chave `jobs.buscaVagas` no banco **não foi renomeada**: já há linha gravada
com esse nome, e renomear pediria migração para não perder a escolha de quem já
mexeu no interruptor.

`busca.service.ts` passou a ler a flag, e não só a existência da chave. Sem
isso o interruptor não significaria nada: a chave continua cadastrada quando
alguém desliga o Firecrawl, e o motor antigo seguiria rodando.

## O terceiro estado do `Interruptor`

O componente só tinha dois textos, escolhidos pela **chave** (`ajudaLigada` /
`ajudaSemChave`). Faltava o caso que esta mudança cria: **desligado com chave**.
Sem ele, quem desligasse o Firecrawl continuaria lendo "a busca abre cada
anúncio…" — descrevendo o que já não acontece.

`ajudaDesligada` é opcional de propósito: recurso cujo desligado é só ausência
(a leitura de CV) não precisa de terceiro texto.

## Critérios de aceite

- [x] O rótulo é "Ativar Firecrawl"
- [x] Desligado com chave de IA, a busca roda pela IA (log: `Firecrawl desligado — buscando pela IA`)
- [x] Desligado sem chave nenhuma, a mensagem diz o que cadastrar
- [x] O texto de ajuda muda ao desligar, explicando que a IA assume
- [x] Ligar exige token do Firecrawl (não mais "Firecrawl ou Anthropic")

## O que continua aberto

Herdado do JOB-13: **não há chave da Anthropic nesta máquina**, então o caminho
da IA foi provado com chave inválida de propósito — o roteamento e o tratamento
de falha estão certos, mas **nenhuma busca real pela IA foi vista**.

E o `0 jobs found` continua aparecendo acima da mensagem de erro. Não mexi:
é da tela de vagas, não do interruptor, e merece card próprio.
