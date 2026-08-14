# Kanban — Horizons

Um arquivo por card em [cards/](cards/). Este arquivo é o quadro: mover um
card é mover a linha de coluna, e atualizar o campo **Estado** dentro do
arquivo dele.

Prefixos: `INV` invoice · `LRN` trilhas · `PLT` plataforma (login, infra,
umbrella).

---

**Sprint atual:** [02 · Achar vaga](sprints/02-achar-vaga.md) (13/08 – 27/08)
— dar dono às contas e fazer a busca de vagas rodar sozinha.

A decisão do login **saiu**: Google Sign-In, portado do arguição. É o que
destrava o resto.

## Backlog

| Card | Título | Tam. | Nota |
| --- | --- | --- | --- |
| [INV-10](cards/INV-10-clientes-salvos-e-historico.md) | Clientes salvos, histórico e duplicar do mês passado | G | **destravado** (13/08) — o login existe; falta decidir se ainda vale, já que o INV-14 entregou o histórico local |
| [PLT-06](cards/PLT-06-deploy-no-coolify.md) | Deploy no Coolify | M | compose de produção pronto e verificado; falta servidor e domínio |
| [PLT-04](cards/PLT-04-crud-de-prompts.md) | Config vira área de admin, com CRUD dos prompts de busca | M | agora tem `@AdminOnly()` de verdade por trás |
| [JOB-02](cards/JOB-02-perfil-de-busca.md) | Perfil de busca e agrupamento | M | destravado pelo login — o perfil tem dono |
| [JOB-03](cards/JOB-03-busca-em-segundo-plano.md) | A busca roda sozinha a cada 50 minutos | M | ver **Antes de começar** abaixo: dois ajustes pendentes |
| [JOB-04](cards/JOB-04-tela-de-vagas.md) | A tela das vagas encontradas | M | depende do JOB-03 |
| [JOB-05](cards/JOB-05-salvar-vaga.md) | Salvar vaga (sai da regra dos 15 dias) | P | depende do JOB-04 |

### Antes de começar o JOB-03

Dois detalhes que hoje matam a busca em silêncio, levantados pelo QA e ainda
**não corrigidos**:

- `frontend/src/lib/api.ts:14` tem `timeout: 10_000`. Uma busca medida leva
  ~58s no melhor caso, então qualquer chamada síncrona morre antes de responder.
- `frontend/nginx.conf` não tem `proxy_buffering off` — resposta em streaming
  fica presa no buffer do nginx até terminar.

## Pronto para fazer

_(vazio)_

## Esperando decisão

_(vazio)_

## Fazendo

_(vazio)_

## Feito

| Card | Título | Quando |
| --- | --- | --- |
| [PLT-07](cards/PLT-07-leitura-anonima.md) | **Leitura anônima** — home aberta, login na barra | 14/08/2026 |
| [PLT-05](cards/PLT-05-login-desligado.md) | **Login desligado** por `AUTH_DISABLED` — reverter antes de publicar | 14/08/2026 |
| [PLT-02](cards/PLT-02-login-com-google.md) | **Login com Google** — guard global *fail closed*, revogação imediata | 13/08/2026 |
| [PLT-03](cards/PLT-03-migrar-contas-existentes.md) | Contas do guard antigo adotadas por e-mail, sem duplicar | 13/08/2026 |
| [JOB-01](cards/JOB-01-provar-o-firecrawl.md) | Firecrawl provado — viável, e o prompt é o que decide | 13/08/2026 |
| [INV-10](cards/INV-10-clientes-salvos-e-historico.md) | Clientes salvos e histórico — **substituído** pelo PLT-02 e INV-14 | 13/08/2026 |
| [PLT-01](cards/PLT-01-tokens-de-api.md) | Tela de configurações com tokens de API, cifrados | 13/08/2026 |
| [INV-16](cards/INV-16-logo-da-empresa.md) | Logo da empresa, com opção preto e branco | 13/08/2026 |
| [INV-15](cards/INV-15-campo-numerico-so-aceita-numero.md) | Campo numérico aceitava letra (`1eee`) | 13/08/2026 |
| [INV-14](cards/INV-14-historico-local.md) | Histórico de invoices no navegador | 13/08/2026 |
| [INV-13](cards/INV-13-campos-de-pagamento.md) | Pagamento em campos renomeáveis, não em texto livre | 13/08/2026 |
| [INV-12](cards/INV-12-reordenar-blocos-e-bandeiras.md) | Blocos reordenados, Payment/Notes separados, bandeiras | 13/08/2026 |
| [INV-11](cards/INV-11-virgula-decimal-multiplica-por-100.md) | **Vírgula decimal multiplicava por 100** — a moeda desempata | 13/08/2026 |
| [INV-09](cards/INV-09-redesenho-da-tela.md) | Redesenho: prévia ao vivo, acordeão, buraco resolvido | 12/08/2026 |
| [INV-05](cards/INV-05-retry-impossivel-apos-falha.md) | Retry após falha de rede — resolvido com `<script>` clássico | 13/08/2026 |
| [INV-06](cards/INV-06-foco-perdido-no-teclado.md) | Foco volta ao botão ao baixar por teclado | 12/08/2026 |
| [INV-08](cards/INV-08-empresa-em-modal.md) | Cadastro de empresa em modal + select | 12/08/2026 |
| [INV-01](cards/INV-01-total-negativo.md) | Rejeita quantidade e valor negativos | 12/08/2026 |
| [INV-02](cards/INV-02-numero-grande-vira-zero.md) | Teto de 1.000.000 por campo, com aviso | 12/08/2026 |
| [INV-03](cards/INV-03-clique-repetido-gera-varios-pdfs.md) | Clique repetido gera vários PDFs | 12/08/2026 |
| [INV-04](cards/INV-04-pdf-com-dados-antigos.md) | PDF com dados antigos ao editar durante a geração | 12/08/2026 |
| [INV-07](cards/INV-07-status-preso-em-baixado.md) | Status preso em "Invoice downloaded." | 12/08/2026 |
| — | Gerador de invoice, camada 1 (formulário, PDF, rascunho local) | 12/08/2026 |
| — | Trilhas, progresso e 75 aulas autorais de System Design | 11/08/2026 |

---

## O que trava o resto

**Uma coisa, e é externa:** falta um `GOOGLE_CLIENT_ID` real para entrar de
verdade. O código está pronto e verificado até onde dá sem ele — a tela sem
client id explica que o login não está configurado, e com um client id
inventado o botão do Google renderiza e o próprio Google recusa. Falta criar o
OAuth client no Google Cloud Console e cadastrar as origens.

**O risco do guard stub acabou** (13/08/2026). `x-user-email` agora responde
**401** — medido. Os tokens de API do PLT-01 têm dono de verdade.

**Mas o login está desligado por decisão** (14/08/2026, [PLT-05](cards/PLT-05-login-desligado.md)).
Com `AUTH_DISABLED=true` nenhuma rota exige token, e `/api/settings/tokens`
responde a quem alcançar a porta 3333. Vale só em rede local — **isto não pode
ir para o servidor assim**. Religar é trocar uma variável; o código do login
continua inteiro e verificado.

## Decisões já tomadas

Para não serem rediscutidas sem motivo novo:

- **Cobrança fica para depois.** Sem informação para precificar; primeiro usar
  e medir.
- **A invoice é anônima por padrão.** Exigir cadastro para gerar um PDF perde
  a corrida contra um formulário que gera na hora.
- **A invoice é em inglês, as trilhas em português.** A invoice é porta de
  entrada global; as trilhas são para o dev brasileiro.
- **O PDF é gerado no navegador.** Custo zero de servidor, funciona anônimo.
- **O login é com Google, não com senha** (13/08/2026). O arguição não tem
  senha para portar, e o Google já entrega e-mail verificado — que a busca de
  vagas precisa para avisar.
- **A busca de vagas roda em segundo plano**, a cada 50 min, e ninguém espera
  olhando a tela. Medido: uma busca ao vivo leva ~58s no melhor caso.
- **Vaga encontrada fica 15 dias**; vaga salva fica para sempre.
- **Do CV, guarda-se só o perfil extraído** — nunca o arquivo. Some o CPF, o
  endereço e o telefone.
- **Não reusar o look4job**, apesar de ele ter 1.953 empresas catalogadas e
  estar em produção. Abordagem deliberadamente diferente.
- **`ADMIN_EMAILS` é a fonte da verdade do papel**, reavaliada a cada login
  (13/08/2026). Vazio significa ninguém — sem default hardcoded. O efeito
  colateral é intencional: promover alguém direto no banco não sobrevive ao
  próximo login, e por isso uma promoção manual esquecida não vira permanente.
- **Configurações é área de admin.** Deixou de ser a tela sem dono do PLT-01.
- **O login fica desligado por enquanto** (14/08/2026). Entre desligar só a
  tela e desligar o guard inteiro, foi escolhido o guard inteiro, com o risco
  registrado no [PLT-05](cards/PLT-05-login-desligado.md).

---

## Quadro dentro do app (temporário)

Existe uma aba **Quadro** no app, em `/quadro`, visível em qualquer build —
inclusive no Docker (`localhost:5173`), que é onde o app roda de verdade.

**Ela precisa sair antes de publicar.** O backlog tem bugs conhecidos e
decisões internas; não é conteúdo para quem chega de fora. Enquanto o app não
está no ar, deixá-la visível não custa nada e serve para acompanhar o trabalho.

Os dados vêm de `frontend/public/quadro.json`, gerado junto com o HTML:

```
python3 scripts/kanban-html.py    # gera o index.html E o quadro.json
```

**Para remover quando não fizer mais sentido** — é só apagar, nada mais
depende disso:

1. `frontend/src/pages/QuadroPage.tsx`
2. `frontend/public/quadro.json`
3. As três marcas `QUADRO (temporario)` em `frontend/src/App.tsx`
   (o import, a entrada da aba e a rota)
4. O bloco `SAIDA_JSON` em `scripts/kanban-html.py`, se quiser parar de gerar
