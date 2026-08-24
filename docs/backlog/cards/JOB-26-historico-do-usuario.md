# JOB-26 · Histórico — não remostrar o que a pessoa já viu

**Estado:** feito (24/08/2026)
**Tamanho:** P

## Por quê

**É a segunda coisa que o ChatGPT não faz.** Ele começa do zero toda vez: não
sabe o que a pessoa já viu, já descartou, já se candidatou.

Sem histórico, o e-mail semanal ([JOB-24](JOB-24-email-semanal.md)) repete as
mesmas vagas e vira ruído.

## O que fazer

Guardar, por usuário: vaga vista, vaga descartada, vaga que virou candidatura.
"Novas desde a última visita" na tela e no e-mail.

Com o tempo isso vira sinal: quem descarta toda vaga de contrato PJ está
dizendo algo, e a busca pode aprender.

## Critérios de aceite

- [x] Uma vaga já vista não aparece como nova
- [x] "Descartar" some da lista e não volta
- [x] O e-mail respeita o histórico
- [x] Retenção: só o dono vê o próprio histórico

## Decisões de produto

**1. "Visto" é por ABRIR o anúncio, não por aparecer na tela.**

Marcar como visto tudo que foi renderizado seria mentira barata: a pessoa rola
por 25 vagas e lê 3, e o resultado seria esconder 22 que ela nunca leu — o
oposto do que o card quer. Clicar no título é o único gesto desta tela que
prova atenção, e ele já acontece de qualquer jeito, então não custa um clique
a mais a ninguém.

O custo assumido: quem lê o cartão inteiro na lista e decide não abrir continua
vendo aquela vaga como "New". Preferimos errar para o lado de mostrar demais —
esconder uma vaga que a pessoa não leu é um erro que ela não tem como perceber.

**2. Descartar é reversível, em dois tempos.**

O × fica colado no ☆, e trocar um pelo outro é o erro óbvio desta tela. Há
desfazer **imediato** (aviso com "Undo" logo acima da lista) e desfazer
**tardio** (o recorte "Dismissed", com um botão Restore por linha). Por isso o
registro é uma linha com estado, e não uma exclusão: restaurar apaga a linha e
a vaga volta a ser exatamente o que era antes do clique.

**3. Onde aparece: selo na linha + filtro de três estados, não uma aba.**

Uma aba de "vagas vistas" seria um lugar que ninguém visita. O valor do
histórico está em mudar a lista que a pessoa **já está olhando**: selo "New"
no que ela não abriu, e `All / New / Dismissed` sobre a mesma lista. Três
estados e não um checkbox "só novas" — com dois, o descartado não teria onde
aparecer e o descarte viraria irreversível na prática.

**Regra de precedência:** descartar sobrescreve visto, visto **não** sobrescreve
descartado. São gestos de peso diferente — descartar é uma decisão, abrir é
passagem. Sem isso, abrir o anúncio a partir da lista de descartadas (para
conferir antes de restaurar) apagaria o descarte em silêncio.

## Como ficou

- `JobHistory` no schema: uma tabela com coluna `estado`, `@@unique([userId, url])`.
  Uma tabela e não duas porque visto e descartado são estados do mesmo par —
  com duas seria preciso mantê-las coerentes na mão.
- Guarda URL + título + empresa, e **não** o snapshot: aqui não há nada a
  reler, só responder "esta vaga já passou por mim?". Título e empresa existem
  para a lista de descartadas ser reconhecível.
- `GET/POST/DELETE /api/jobs/history` — `userId` sempre do `@CurrentUser()`,
  nunca de parâmetro.
- Interruptor `jobs.historico` em Configurações, **default ligado** (não gasta
  crédito, não manda nada; nascer desligado deixaria o × sem efeito). Desligado
  não apaga nada: a tela volta a ser a de antes do card e religar devolve as
  marcas.

## O que foi verificado rodando

12 asserções no Chromium via Playwright, com a busca servida por um SSE
determinístico (gastar Firecrawl para testar histórico seria desperdício; as
chamadas de `/jobs/history` vão para a API real):

selo em 3 de 3 no início · abrir uma derruba para `New (2)` · **rolar 4000px
não marca nada** · descartada some · sobrevive a reload + nova busca · aparece
em "Dismissed" · Restore devolve · "New" esconde a já aberta · sem erro de
console · claro e escuro.

Na API: `estado` inválido e campo extra dão 400; `DELETE` sem `url` dá 400 e
**não** zera a tabela (era o bug do JOB-05, conferido de propósito); `DELETE`
de url inexistente é idempotente (200, não 404).

**Isolamento conferido com o login LIGADO** (`AUTH_DISABLED=false` numa
instância à parte na 3399, porque com a flag local ligada todo token vira a
mesma conta e o teste não valeria nada): usuário 2 vê histórico vazio, marcar
a mesma URL cria linha separada, e o `DELETE` de um não toca a linha do outro.

## O que NÃO foi feito

- **"Vaga que virou candidatura" ficou de fora.** O card pede três estados;
  entregamos dois. Não há gesto na tela que signifique "me candidatei" — o
  clique no título leva para fora, e o produto não vê o que acontece lá.
  Inventar um botão "I applied" sem ninguém ter pedido seria escopo que o card
  não justifica. Fica para um card próprio, junto com o funil de candidatura.
- **O e-mail não foi tocado.** O critério "o e-mail respeita o histórico" já
  estava atendido pelo JOB-24 por outro caminho (`foundAt > ultimoEnvioEm`).
  Vale registrar a consequência: o e-mail respeita a **data**, não o descarte —
  uma vaga descartada na tela ainda pode chegar por e-mail se for nova desde o
  último envio. Cruzar as duas coisas é trabalho de outro card.
- **O histórico não filtra a busca no backend.** O corte é na tela. Vaga
  descartada continua vindo do motor e sendo descartada no navegador — com o
  teto de 200 vagas isso não pesa, mas quem descartar centenas vai ver a lista
  encurtar sem o motor saber.


## O QA achou 4 bugs (24/08) — todos corrigidos

Nenhum grave; ele disse que dava para commitar, mas os dois primeiros valiam
corrigir antes.

**1. A estrela sumia no recorte "Dismissed".** Uma vaga salva **e** descartada
ficava presa na aba Saved: só dava para dessalvar restaurando antes. Salvar e
descartar são eixos independentes, e a linha precisa oferecer os dois.
Conferido: 3 estrelas onde antes eram 0.

**2. O rodapé da paginação ignorava o filtro.** Com 30 vagas e 3 descartadas,
os selos diziam "All (27)" e o rodapé "30 jobs" — dois números para a mesma
lista. Conferido: selo e rodapé agora dizem 472.

**3. O `radiogroup` não andava com as setas.** `role="radiogroup"` promete que
as setas navegam e que só uma opção é tabbable; sem isso o Tab visitava as
três e o leitor de tela anunciava um grupo que não se comporta como grupo.
Roving tabindex + ArrowLeft/Right/Up/Down, com o foco acompanhando a seleção.

**4. URL só com espaços entrava e não saía.** `@IsNotEmpty` não apara espaço,
então `{"url":"   "}` gravava uma linha que o `DELETE` nunca alcançava — o
parâmetro da query é aparado antes de chegar ao serviço. Agora a URL é aparada
na gravação: `"  https://x.com/1  "` grava limpo e o DELETE encontra.

## O que o QA confirmou que não quebrou

Descartar com o SSE em andamento; Undo aponta para a vaga certa depois de 3
descartes e sobrevive à troca de filtro; a precedência nos dois sentidos,
inclusive abrindo a vaga a partir de "Dismissed"; página esvaziada cai para a
anterior; troca de filtro volta à página 1; 200 descartadas em 37 KB / 7 ms;
`<script>` no título não executa; o interruptor desligado some com selo, × e
filtro, **preserva as marcas** e religa igual.

E o que mais importa: **`DELETE` sem `url` dá 400 sem zerar a tabela** — o bug
grave do JOB-05 não se repetiu.
