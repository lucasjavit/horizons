# JOB-06 · Token do Firecrawl em Configurações

**Estado:** feito (15/08/2026)
**Tamanho:** P
**Decisão do stakeholder (15/08/2026):** *"eu não sei como conectar no
Firecrawl, mas se for por token, pode colocar o setup do token na config"*.

## Por quê

A busca de vagas depende do Firecrawl, e o Firecrawl depende de um token. Sem
um lugar para cadastrá-lo, a feature inteira fica presa numa variável de
ambiente que exige redeploy para mudar.

## Como o Firecrawl autentica

Verificado na documentação oficial (`docs.firecrawl.dev`), não assumido:

- **Token com prefixo `fc-`**
- **`Authorization: Bearer fc-…`**
- Base: `https://api.firecrawl.dev`
- Onde criar: `firecrawl.dev → app → API keys`

É o mesmo mecanismo das chaves de IA — token de terceiro, no cabeçalho. Por
isso entrou no `ApiProvider` existente em vez de ganhar tabela própria, com um
comentário no schema dizendo que **não é provedor de IA**: mora ali porque o
mecanismo é o mesmo, não porque a natureza seja.

## O que faz

- `FIRECRAWL` no enum `ApiProvider`, cifrado em repouso como os outros
- Cartão na tela de Configurações, com link direto para as API keys
- Interruptor **"Buscar vagas na web"**, ao lado do de leitura de CV

A regra é a mesma do JOB-02: **só liga se houver token**. Um interruptor que
liga sem a dependência não liga nada — só empurra a falha para o momento do
uso.

O texto do interruptor diz que **cada rodada consome créditos** da conta
cadastrada. Medido no JOB-01: ~67 créditos por rodada na estratégia de duas
fases.

Os dois interruptores nasceram do mesmo componente (`Interruptor`), porque a
regra é idêntica: recurso, dependência, e o que dizer quando falta.

## Verificado (15/08/2026)

| O que | Resultado |
| --- | --- |
| Ligar a busca sem token | **400**: *"Cadastre o token do Firecrawl antes de ligar a busca de vagas."* |
| Cadastrar o token | 200 |
| Ligar com token | `buscaVagasAtiva: true` |
| **Apagar o token com a busca ligada** | volta a `false` |
| **Recadastrar o token** | religa **sozinho** — a intenção do admin ficou guardada |
| Tela | cartão presente, link para `firecrawl.dev`, dois interruptores refletindo o estado real |
| Erros de console | zero |

## O que isto NÃO faz

**Não busca nada.** Isto é só o cadastro do token e o interruptor. O código que
chama o Firecrawl é o [JOB-03](JOB-03-busca-em-segundo-plano.md), que não
começou.

Cadastrar o token e ligar o interruptor hoje não faz vaga nenhuma aparecer.

## Corrigido de passagem

O subtítulo da tela dizia *"Chaves de API dos provedores de IA usados pela
aplicação"*. O Firecrawl não é IA — virou *"Chaves e tokens dos serviços que a
aplicação usa"*.
