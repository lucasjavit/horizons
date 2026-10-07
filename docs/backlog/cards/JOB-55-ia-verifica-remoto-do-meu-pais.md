# JOB-55 · A IA verifica se a vaga é remota para quem mora no meu país

**Estado:** fazendo (05/10/2026)
**Tamanho:** M
**Pedido pelo Lucas (05/10/2026):** "quero que a IA verifique se a vaga é home
office para trabalhar do meu país".

## Por quê

É a pergunta que o produto existe para responder. Hoje ela é respondida **só
pelo campo** (`elegibilidade.ts`): o `local` e o `regime` do anúncio. Isso erra
para o lado restritivo de propósito — "San Francisco HQ" vira "contrata nos
EUA" — e devolve `precisaLer: true` quando só a descrição resolve. Ninguém lê a
descrição: o passo de IA foi previsto e nunca ligado, porque ler o corpus
inteiro custaria US$ 341 (medido em 18/08).

O que mudou: não é preciso ler o corpus. Basta ler **as vagas que a pessoa está
vendo**, e guardar a resposta.

## Decisão

- **Quem:** pessoa com sessão e com país no perfil (`country`). Sem país, a
  tela pede para escolher um; anônimo não tem a verificação.
- **Quando:** para as vagas da página visível, depois que a lista aparece — a
  verificação **não atrasa a busca**. Enquanto roda, a vaga mostra que está
  sendo verificada.
- **O quê a IA responde**, lendo a descrição do anúncio: a vaga pode ser feita
  remotamente por quem mora em `<país>`? Três respostas, nunca duas:
  `sim` / `nao` / `nao_diz`.
- **Só afirma o que cita (JOB-09).** `sim` e `nao` exigem um trecho que exista
  literalmente na descrição; sem trecho válido, a resposta vira `nao_diz`.
  "Não mencionado" redigido não é citação.
- **Paga uma vez.** O veredito é guardado por vaga + país e reusado por todo
  mundo; a mesma vaga não é lida duas vezes para o mesmo país.
- **Pela cadeia.** `IaService.pedir('estruturada', …)`, nunca SDK direto. A
  descrição do anúncio é pública; o CV não é enviado.
- **Com interruptor** (Features): desligado, a tela volta à resposta por campo,
  sem erro.
- **Filtro:** um controle "Only jobs I can do from `<país>`" que mostra só as
  de veredito `sim`, dizendo quantas ficaram sem resposta.

## Critérios de aceite

- [x] Vaga da página visível ganha o veredito da IA, com o trecho que o sustenta
- [x] `sim`/`nao` sem trecho literal da descrição viram `nao_diz`
- [x] A segunda pessoa do mesmo país vendo a mesma vaga não gera chamada de IA
- [x] A lista aparece antes da verificação terminar
- [x] Falha de IA (sem chave, sem cota) não quebra a lista: fica a resposta por campo
- [x] Sem país no perfil, a tela diz como configurar *(teste automatizado e resposta real da API; a tela em si não foi aberta no navegador com um usuário sem país)*
- [x] O interruptor desliga a verificação inteira *(teste automatizado; no navegador só o estado LIGADO foi conferido)*
- [x] O filtro mostra só as de veredito `sim`
- [ ] Custo e tempo por página medidos e registrados aqui — **tempo medido, custo só estimado** (ver abaixo)
- [x] Testes automatizados no backend e no frontend

## Confirmação do dono do produto (05/10/2026)

Ele quer as DUAS coisas: um **selo em cada vaga** e o **filtro**. O veredito é
um selo visível na linha (`LinhaVaga.tsx`, primeiro da faixa de chips), com
texto e não só cor, e o trecho citado abre a partir do selo. Não é um detalhe
escondido.

## Feito (05/10/2026) — e por que o estado continua `fazendo`

O card **não foi fechado**: o custo não foi medido (só estimado), o QA ainda
não passou, e há uma decisão de produto em aberto sobre a precisão do `nao`
(abaixo). Tudo o mais está implementado, testado e conferido no navegador.

### O que foi entregue

- `POST /api/jobs/remote-check` `{ ids: string[] }` (1–25 ids, exige sessão).
  Responde `{ estado: 'ok' | 'desligado' | 'sem_pais', pais, vereditos[] }`.
  Vaga ausente de `vereditos` **não foi verificada** — é diferente de `nao_diz`.
- Tabela `remote_verdicts` (`vagaId` + `country` únicos), migration
  `20261005120000_vereditos_de_remoto`. Sem `userId`: a resposta é da vaga e do
  país, e é isso que faz a leitura ser paga uma vez.
- Interruptor `jobs.verificacaoRemoto` em `/config` (Features), **default
  DESLIGADO** e subordinado a haver chave de IA — mesma regra da leitura de CV:
  o que gasta só liga por decisão explícita.
- Na tela: selo por vaga (`✓ Remote from Brazil` / `✕ Not from Brazil` /
  `Remote from Brazil: not stated` / `Checking…`), trecho a um clique, filtro
  `Only jobs I can do from Brazil` com a contagem do que ficou de fora, e o
  aviso com link para `/perfil` quando falta o país.

### Decisões

- **A descrição é buscada pelo servidor**, em `GET {freehire}/api/v1/jobs/{slug}`.
  O `VagaDto` não carrega a descrição (o mapeador a descarta), e aceitar o texto
  vindo do navegador deixaria qualquer um gravar no cache comum um veredito
  sobre um texto que ele mesmo escreveu. O endpoint de detalhe devolve HTML: o
  modelo lê o texto sem tags, e a citação é conferida contra esse mesmo texto.
- **O campo `location` vai junto**, como primeira linha (`Location: …`), e pode
  ser citado. Ele é parte do anúncio e muitas vezes é a única frase que diz de
  onde ("Brazil - Remote").
- **Só vaga do freehire** (id com forma de slug). Vaga de ATS ou de busca por
  IA tem a URL como id e fica sem selo — com a resposta por campo de sempre.
- **Falha não é guardada**, só resposta. `nao_diz` do modelo e `sim`/`nao`
  rebaixados por citação inválida são guardados.
- **Citação**: substring do anúncio depois de achatar espaço, caixa e aspas
  tipográficas; mínimo de 6 caracteres; "not mentioned"/"n/a" não é citação.
- **O filtro vale para a página visível**, não para a lista inteira: é o que
  foi lido. A paginação continua contando as 25 da página.
- **O navegador pede em lotes de 5**, um depois do outro, e o servidor lê 4 ao
  mesmo tempo. Ver "o que deu errado" abaixo.

### Medido (ambiente local, 05/10, país BR)

Só a chave da **Anthropic** respondeu. A cadeia está na ordem Mistral → Gemini
→ OpenAI → Anthropic, e as três primeiras recusam toda chamada:

- Mistral: `403 This model is not available in your subscription tier`
- Gemini: `HTTP 429`
- OpenAI: `429 You have no credits remaining`

| Medida | Valor |
| --- | --- |
| Lista na tela | 2,3 s |
| Primeiro selo | 13,9 s |
| Página inteira (25 vagas, 5 lotes) | 54,5 s |
| Chamadas de IA na primeira carga | 24 (1 já estava guardada) |
| Vereditos gravados na primeira carga | 22 — 2 falharam |
| Recarga de página já lida | 0 chamadas de IA, 0,59 s na API |

Cerca de 2,2 s por vaga, e boa parte disso é a cadeia batendo em três
provedores mortos antes do que responde. **Reordenar a cadeia em
`/config/ia` deve cortar o tempo** — não foi medido.

**Custo: não medido.** O `IaService` não devolve o uso de tokens. Estimativa
pelo tamanho: anúncio médio de ~3.100 caracteres (6 amostras) + instrução ≈
1.200–1.300 tokens de entrada e ~50 de saída por vaga, ou seja ~31 mil de
entrada e ~1,3 mil de saída por página de 25. O modelo que respondeu é
`claude-opus-5` (o da entrada ANTHROPIC em `provedores.ts`); multiplicar pelo
preço dele dá o custo. Um modelo menor serviria para esta pergunta.

### Conferido à mão (6 vagas, anúncio aberto pela API do freehire)

Os 6 trechos existem literalmente no anúncio. Veredito: **5 batem, 1 é
discutível**.

- `sim` "100% Remote Work: Work from anywhere" — bate.
- `nao` "Fully remote, open to candidates in European timezones." — bate.
- `nao` "Work Setup: Hybrid (Work from Home twice per week)" — bate, e corrige
  o campo, que dizia `remote`.
- `nao_diz` em anúncio "remote-first" sem geografia — bate.
- `nao_diz` em `Location: Brazil` sem a palavra remoto — bate.
- `sim` "Location: Americas; Remote" (Techstars) — **discutível**: o mesmo
  anúncio diz "Techstars uses E-Verify to check the work authorization of all
  new hires", o que sugere contratação nos EUA.

### O que deu errado, e o que não ficou resolvido

- **A primeira versão mandava as 25 vagas num pedido só, e não funcionava no
  navegador.** O pedido levou 64 s e o cliente HTTP desiste em 10 s: a página
  ficava sem selo nenhum, sem erro, e só a carga seguinte mostrava os
  vereditos (o servidor terminava e gravava). Os testes passavam — o duble
  responde na hora. Corrigido com lotes de 5 e timeout de 60 s no pedido; há
  teste dos lotes.
- **~2 de 25 chamadas falham** com `resposta de Claude (Anthropic) sem bloco de
  texto`. A vaga fica sem selo e é lida na carga seguinte. Causa não
  investigada.
- **`nao` sustentado só pelo local.** Muitos `nao` citam apenas
  `Location: Barcelona, Spain` ou "Sede di lavoro: Livorno (LI)". A citação é
  literal, mas é a mesma inferência restritiva do campo ("o escritório é a
  restrição") que o card queria superar. Decisão em aberto: aceitar, ou mudar
  a instrução para que local sem frase sobre presencial/restrição vire
  `nao_diz`. Mudar invalida os `nao` já guardados.
- Um `nao` citou "working from Vienna or remotely with quarterly of…" — parece
  errado, não foi conferido.
- **Não há expiração nem releitura**: o veredito guardado vale para sempre,
  mesmo se o anúncio for editado.
- **O filtro pode deixar a página vazia** (0 de 25) com a paginação ainda
  mostrando as outras páginas; ele não puxa vagas `sim` de outras páginas.
- Sem limite de uso por pessoa: cada página nova de cada usuário logado gasta
  até 25 chamadas.
- `npx tsc --noEmit` no backend acusa 2 erros em `src/jobs/grupo.spec.ts`
  (`excluded_keywords`), que **já existiam** antes deste card e não são dele.
- O agente de QA não rodou sobre isto.

### Estado deixado no ambiente local

`users.country = 'BR'` em `eu@horizons.local`, `jobs.verificacaoRemoto = true`
em `app_settings`, e 74 linhas em `remote_verdicts`.
