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
| [JOB-40](cards/JOB-40-catalogo-aprende-com-o-freehire.md) | **O catálogo aprende com o freehire** — transformar dado emprestado em ativo nosso | M | medido (26/08): 60 das 63 empresas de uma amostra do freehire não estão no `empresas.json`. É o que sobrevive ao dia em que o serviço fechar |
| [JOB-42](cards/JOB-42-alerta-de-busca-salva.md) | **A busca salva dispara alerta** — hoje ela é guardada e nunca consultada | M | o interruptor "avisar por e-mail" existe na tela e **promete o que não acontece**; os dois canais mandam um filtro único |
| [JOB-39](cards/JOB-39-cv-nao-preenche-o-modal-de-filtros.md) | **O currículo não preenche mais os filtros** — a caixa diz "we ticked 13 filters" e nenhum aparece | P | medido (26/08) — a barra de dropdowns virou modal em trabalho não commitado; o `aoLerCv` continua certo, falta o modal ler o rascunho |
| [PLT-09](cards/PLT-09-cadastro-em-dois-tempos.md) | **Cadastro em dois tempos, e três papéis** — Google na entrada; documento, telefone e nacionalidade só ao contratar | M | decidido (28/08) — documento cifrado com salt próprio, `MANAGER_EMAILS` no ambiente. O IP foi descartado. A armadilha: o papel é recalculado a cada login, e um Manager promovido no banco seria rebaixado em silêncio |
| [APP-02](cards/APP-02-erro-do-backend-em-portugues.md) | **Erro do backend em português na interface inglesa** | P | medido (25/08) — "Formato nao suportado. Envie o curriculo em PDF ou DOCX." dentro da caixa de CV, e "Link invalido ou expirado" no `/email/sair`. Exige decidir onde mora a tradução |
| [APP-03](cards/APP-03-revisar-motion-effects.md) | **Revisar motion effects e referências de interface** | P | revisão, não implementação — 5 fontes copy-paste/open-source; `prefers-reduced-motion` é eliminatório, e o `invoicegenerator.io` entra como concorrente |
| [INV-10](cards/INV-10-clientes-salvos-e-historico.md) | Clientes salvos, histórico e duplicar do mês passado | G | **destravado** (13/08) — o login existe; falta decidir se ainda vale, já que o INV-14 entregou o histórico local |
| [PLT-04](cards/PLT-04-crud-de-prompts.md) | Config vira área de admin, com CRUD dos prompts de busca | M | agora tem `@AdminOnly()` de verdade por trás |
| [JOB-08](cards/JOB-08-prompt-de-busca.md) | O prompt do stakeholder vira o motor da busca | G | o descarte de vaga aberta caiu com o JOB-10; sobram os **sete níveis de elegibilidade** e o **dedup** |
| [JOB-04](cards/JOB-04-tela-de-vagas.md) | A tela das vagas encontradas | M | **em andamento** (15/08) — refeita no formato RemoteYeah: 8 dropdowns + linhas densas, formulario de perfil removido da pagina; falta fuso/overlap e "o que falta no perfil" |
| [JOB-19](cards/JOB-19-produto-dois-lados.md) | **O produto tem dois lados** — alvo vira país emergente; empresa vira cliente | G | decidido (18/08) — 501 empresas contratam em emergentes, contra 118 só do Brasil |
| [JOB-17](cards/JOB-17-catalogo-de-ats.md) | Catálogo de 1.953 empresas do look4job + API de ATS grátis | M | medido (18/08) — 199 vagas numa chamada, mas só 4 de 771 eram BR/LATAM |
| [JOB-12](cards/JOB-12-url-de-vaga-nao-se-valida-por-status.md) | URL de vaga não se valida por status HTTP | P | preventivo — conferido em 25/08: nenhum ponto trata `200` como "vaga existe", e `applicationUrl` continua sem ser exibido. **Aberto de propósito**, como aviso para quem for implementar |

## Pronto para fazer

**A ordem é de dependência, não de preferência.** O motor de ATS vem primeiro
porque tudo depois roda sobre ele: hoje a busca entrega 7 vagas por 42 créditos
quando poderia entregar 27.725 de graça.

| Card | Título | Tam. | Por que agora |
| --- | --- | --- | --- |
| _(vazio)_ | | | |

## Esperando decisão

| Card | Título | Tam. | Nota |
| --- | --- | --- | --- |
| [JOB-18](cards/JOB-18-niveis-de-busca.md) | Três níveis de busca, e o que sustenta o nível pago | G | a vantagem defensável é **catálogo + tempo + acúmulo**, não profundidade de leitura; três decisões travam, e a primeira é medir o nível grátis |

## Fazendo

_(vazio)_

## Feito

| Card | Título | Quando |
| --- | --- | --- |
| [PLT-10](cards/PLT-10-perfil-editavel.md) | **O perfil recebe os dados da pessoa** — segunda seção editável no perfil, com nacionalidade, telefone e documento **cifrado com salt próprio**, todos opcionais: perfil vazio é perfil válido. Validação real para 6 países (BR, MX, AR, CO, CL, PE) e caminho genérico para o resto — ninguém fica sem caminho. Trocar de país **apaga** o documento guardado em vez de aceitá-lo em silêncio, provado no banco. O `crypto.ts` foi generalizado para receber o salt (`SALT_TOKENS`/`SALT_DOCUMENTOS`) em vez de duplicado; decifrar documento com o salt dos tokens lança. **Três bugs achados por medir, não por ler:** `digitos()` apagava letras em vez de reprovar (`"CPF 123.456.789-09"` passava), o RFC mexicano aceitava 31/02, e a cédula colombiana aceitava letras. Um quarto na tela: o `placeholder` do Brasil era um CPF válido de verdade. 46 casos de validação + 27 checagens de navegador | 31/08/2026 |
| [PLT-08](cards/PLT-08-prontidao-para-publicar.md) | **Prontidão para publicar, na tela** — quinta aba `Going live`: os quatro segredos que produção exige, como gerar cada um, e **quanto custa trocar depois** (trocar `JWT_SECRET` desloga todo mundo; trocar `ENCRYPTION_KEY` torna ilegível toda chave de IA já cadastrada). Mostra o estado real do servidor sem expor nenhum valor — só booleano e comprimento. Achou um bug próprio: ler `POSTGRES_PASSWORD` da API diria "Not set" em produção correta, porque a senha só chega pela `DATABASE_URL`. **28/08:** ganhou o **guia de publicar em 9 passos**, cada um ligado ao que o servidor já verificou (5 verificáveis, 4 marcados *"a confirmação é sua"* — Coolify, TLS, build do front, requisição de fora). O `docs/DEPLOY.md` passou a **apontar para a tela** em vez de repetir os passos; ficou com o diagnóstico e o histórico. Segundo bug achado: `NODE_ENV` é `production` **nos dois compose**, então o aviso de "não é produção" ficaria apagado justo na máquina de desenvolvimento. Recolhido custa +4,9% de altura, contra 2,1× se aberto | 28/08/2026 |
| [JOB-45](cards/JOB-45-paginacao-sob-demanda.md) | **Paginação sob demanda** — a busca devolvia 60 vagas de 400 mil e parava ali. Agora `Load more jobs` traz as 60 seguintes por `offset`, num cache de 10 min no servidor (teto de 300/sessão, chave = todos os filtros normalizados). A primeira página não mudou de tempo (2,34s → 2,39s). De quebra, achou duas vagas com `public_slug` diferente e a **mesma URL** na resposta da API — deduplicado no motor | 27/08/2026 |
| [JOB-44](cards/JOB-44-console-de-busca.md) | **O console de busca** — a barra vira duas faixas num quadro só, e todo filtro ativo aparece como chip removível. Corrige a hierarquia invertida (`All filters` tinha 38px contra 125px do `Location`; a lupa de buscar, 32px) e a ordem em 390px, onde o campo de texto era o terceiro elemento. O botão órfão de 160px sumiu | 27/08/2026 |
| [JOB-43](cards/JOB-43-barra-de-busca-do-topo.md) | **A barra de busca do topo** — Location, texto livre, filtros com badge, sino, tema e menu. De quebra, as páginas viraram chunks: o bundle principal caiu de 438 para **412 KB** | 26/08/2026 |
| [JOB-41](cards/JOB-41-modal-de-filtros-avancados.md) | **Modal de filtros avançados** — 11 categorias, chips de três estados com contagem ao vivo, busca por seção e buscas salvas. O QA achou **8 defeitos em duas rodadas**, todos corrigidos; o mais instrutivo foi o `.catch()` que disfarçava bug nosso de motor fora do ar | 26/08/2026 |
| [JOB-39](cards/JOB-39-freehire-como-motor-de-busca.md) | **freehire.me vira o PRIMEIRO motor de busca** — API pública sem chave. Entrou como fallback e a medição virou a mesa: **60 vagas em 2,6s contra 1–15 em 128s** do ATS, que passou a ser a rede de segurança | 26/08/2026 |
| [JOB-36](cards/JOB-36-tela-de-provedores-de-ia.md) | **Configurações vira quatro telas** — `/config` (864 linhas) dividida com barra de abas, e a de IA ganha painel de saúde com verificação de chave por trás (401 ≠ 429). Achou duas coisas no primeiro uso real: o modelo do Gemini estava aposentado (404) e `maxTokens: 16` reprovava chave boa | 25/08/2026 |
| [JOB-33](cards/JOB-33-cadeia-de-ia.md) | **Cadeia de provedores de IA** — 6 provedores encadeados por capacidade (3 fazem busca, 6 fazem extração), 4 gratuitos sem cartão; paga a dívida da queda por chave recusada do JOB-02 | 25/08/2026 |
| [JOB-32](cards/JOB-32-telegram-como-canal.md) | **Telegram como segundo canal** — entrega sem domínio próprio; falta token real de bot | 24/08/2026 |
| [JOB-07](cards/JOB-07-busca-ao-vivo.md) | **A busca ao vivo** — Filter dispara a busca, vagas entram uma a uma | 15/08/2026 |
| [JOB-06](cards/JOB-06-token-do-firecrawl.md) | Token do Firecrawl em Configurações | 15/08/2026 |
| [JOB-34](cards/JOB-34-extracao-de-vaga-fora-do-firecrawl.md) | **A extração sai do Firecrawl** — markdown + cadeia; 5 créditos → 1 por página, e o trecho de origem passa a ser conferível | 26/08/2026 |
| [JOB-38](cards/JOB-38-schema-da-vaga-rejeitado-por-openai-e-anthropic.md) | **`SCHEMA_VAGA` recusado por OpenAI e Anthropic** — `required` incompleto; 6m40s → 1m43s | 26/08/2026 |
| [JOB-37](cards/JOB-37-catalogo-aprende-sozinho.md) | **O catálogo aprende com o que a busca encontra** — mecanismo pronto; a hipótese que o justificava era **falsa**, e a medição está no card | 25/08/2026 |
| [JOB-35](cards/JOB-35-schema-do-cv-rejeitado-pela-anthropic.md) | **O schema do CV era recusado pela Anthropic** — `enum` com `null` sob `type` composto, escondido atrás de um 401 | 25/08/2026 |
| [JOB-02](cards/JOB-02-perfil-de-busca.md) | **Leitura de currículo** — sobe o CV e os filtros se preenchem, editáveis, com selo de origem | 25/08/2026 |
| [APP-01](cards/APP-01-cabecalho-vaza-no-celular.md) | O cabeçalho vazava a largura da tela no celular, medido em 390px | 15/08/2026 |
| [JOB-11](cards/JOB-11-listagem-dentro-do-ats.md) | **Listagem dentro do ATS** — resolvido por outro caminho: o motor de ATS monta a URL pelo id do anúncio | 25/08/2026 |
| [JOB-26](cards/JOB-26-historico-do-usuario.md) | **Histórico** — selo "New", descartar com Undo/Restore, filtro All/New/Dismissed | 24/08/2026 |
| [JOB-32](cards/JOB-32-telegram-como-canal.md) | **Telegram como canal** — entrega sem domínio nem DNS; falta token real de bot | 24/08/2026 |
| [JOB-24](cards/JOB-24-email-semanal.md) | **O e-mail semanal** — só vagas novas, com trecho; não manda e-mail vazio. Provedor desligado: registra no log até haver SMTP | 24/08/2026 |
| [JOB-25](cards/JOB-25-consegui-a-vaga.md) | **Botão "consegui a vaga 🎉"** — uma vaga por mês em vez de semanal, sem login; métrica de contratados para o admin | 24/08/2026 |
| [JOB-10](cards/JOB-10-consultas-dirigidas.md) | **A busca mira os ATS** — 8 URLs viram 8 vagas, contra 8 → 6 | 17/08/2026 |
| [JOB-09](cards/JOB-09-vaga-so-afirma-o-que-cita.md) | **A vaga só afirma o que cita** — fim do "não contrata brasileiro" sem fonte | 17/08/2026 |
| [JOB-05](cards/JOB-05-salvar-vaga.md) | **Salvar vaga** — estrela + painel "Saved jobs"; sai da regra dos 15 dias | 21/08/2026 |
| [JOB-03](cards/JOB-03-busca-em-segundo-plano.md) | **A busca roda sozinha** — a cada 50 min, desligada por padrão | 21/08/2026 |
| [JOB-31](cards/JOB-31-origem-da-empresa.md) | **Company origin** — empresa do seu país contratando para fora | 21/08/2026 |
| [JOB-22](cards/JOB-22-paises-elegiveis.md) | **`paisesElegiveis[]`** — "worldwide" e "LATAM" deixam de ser o mesmo `true` | 20/08/2026 |
| [JOB-30](cards/JOB-30-porte-da-empresa.md) | **Startup ou empresa grande** — filtro Company type; 7× mais vagas elegíveis | 19/08/2026 |
| [JOB-21](cards/JOB-21-elegibilidade-por-campo.md) | **Elegibilidade por campo** — 95,6% sem IA, zero falso positivo | 19/08/2026 |
| [JOB-20](cards/JOB-20-motor-de-ats.md) | **Motor de ATS** — 45 vagas por R$ 0 contra 7 por 42 créditos | 19/08/2026 |
| [JOB-15](cards/JOB-15-escolha-da-ia.md) | **Escolher a IA da busca** — Claude ou ChatGPT, com fallback; 15 vagas contra 7 | 18/08/2026 |
| [JOB-14](cards/JOB-14-interruptor-do-firecrawl.md) | **"Ativar Firecrawl"** — desligado passa a busca para a IA, em vez de parar tudo | 18/08/2026 |
| [JOB-13](cards/JOB-13-busca-pela-ia.md) | **Busca pela IA** — segundo motor, com `web_search`; falta chave real para conferir | 18/08/2026 |
| [PLT-06](cards/PLT-06-deploy-no-coolify.md) | **Deploy no Coolify** — no ar em HTTPS, com login funcionando | 15/08/2026 |
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

**Nada.** O app está no ar em HTTPS, com Let's Encrypt válido, e o login com
Google funciona (15/08/2026, [PLT-06](cards/PLT-06-deploy-no-coolify.md)).
Era o que travava desde o começo.

`https://ojxqz4v8x7jda764e6p3k419.169.58.152.158.sslip.io`

Verificado no ar: rotas privadas em 401, `quadro.json` em 404, leitura anônima
sem vazar progresso, e zero erro de console nos dois temas.

O que mudou de estado:

- **O guard stub acabou** (13/08). `x-user-email` responde **401** — medido.
  Os tokens de API do PLT-01 têm dono de verdade.
- **`AUTH_DISABLED` era temporário e valia só em rede local.** Em produção o
  login está exigido; o default virou `false` nos dois compose, então esquecer
  a variável fecha o acesso em vez de abrir.
- **A leitura passou a ser anônima** (14/08, [PLT-07](cards/PLT-07-leitura-anonima.md)):
  trilhas e aulas abrem sem login, e o botão do Google fica na barra. Progresso
  e anotação continuam exigindo sessão.

**Falta conferir o que está no ar.** Quatro `curl` que ninguém rodou ainda,
listados no [PLT-06](cards/PLT-06-deploy-no-coolify.md): as rotas privadas
respondendo 401, o `quadro.json` dando 404, a leitura anônima sem progresso, e
a engrenagem só para admin. Nenhum deles aparece na interface — uma aplicação
com o backlog publicado tem a mesma aparência de uma correta.

**Dívida que passou a valer na internet**, e não mais só na rede local: token
de 30 dias em `localStorage` sem refresh (um XSS lê o token), e
`POST /auth/google` sem rate limiting. Vieram do PLT-02, registradas lá.

## Decisões já tomadas

Para não serem rediscutidas sem motivo novo:

- **Cobrança fica para depois.** Sem informação para precificar; primeiro usar
  e medir.
- **A invoice é anônima por padrão.** Exigir cadastro para gerar um PDF perde
  a corrida contra um formulário que gera na hora.
- **A interface é toda em inglês; só o conteúdo das trilhas é português**
  (25/08/2026). Era "invoice em inglês, trilhas em português", o que deixava
  Configurações, a navegação e a home sem regra — e elas nasceram em
  português. O alvo não é o dev brasileiro, é o dev de país emergente que quer
  ganhar em moeda forte; a interface tem de falar com ele. As aulas seguem em
  português porque foram escritas assim.
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
- **O login ficou desligado por um dia** (14/08/2026), com o guard inteiro
  desligado e o risco registrado no [PLT-05](cards/PLT-05-login-desligado.md).
  **Revertido no mesmo dia** pelo deploy: em produção o login é exigido.
- **A leitura é anônima; entrar é opcional** (14/08/2026). Ler a aula é o que
  convence alguém a criar conta, então pedir a conta antes de mostrar a aula
  inverte a ordem. O login guarda progresso e anotação —
  [PLT-07](cards/PLT-07-leitura-anonima.md).
- **O Telegram é canal adicional, não substituto do e-mail** (24/08/2026). O
  e-mail trava num custo de infraestrutura (domínio verificado, DKIM/SPF/DMARC,
  que Resend e Brevo exigem nos planos gratuitos); o Telegram troca isso por
  custo de conversão — ter o app, sair do site e apertar START, e o bot **não
  pode** iniciar a conversa. Nenhum dos dois vence sozinho, então os dois
  existem — [JOB-32](cards/JOB-32-telegram-como-canal.md).
- **O bot do Telegram recebe por webhook, e é um bot por ambiente**
  (24/08/2026). O webhook custa uma rota `@Public()` nova num guard *fail
  closed* e exige HTTPS público — em desenvolvimento, um túnel. Custo aceito: o
  `getUpdates` evitaria isso ao preço de um processo puxando o tempo todo. Dois
  tokens desde já porque o Telegram entrega cada update a **uma** URL: com um
  bot só, desenvolvimento e produção roubariam as mensagens um do outro e
  mensagem de teste chegaria a gente real.
- **`chat_id` do Telegram fica em coluna comum, não cifrado** (24/08/2026). É
  identificador de destino, igual ao e-mail que já fica em claro na mesma
  feature — cifrar um e não o outro seria incoerente, e impediria consultar o
  vínculo. Diferente dos tokens do PLT-01, que são credencial: `chat_id` não
  abre nada sem o token do bot.
- **O deploy é no Coolify, a partir do `docker-compose.prod.yml`** (14/08/2026).
  O de desenvolvimento continua no repositório e **não serve** para o servidor:
  publica portas e fixa senha. Guia em [docs/DEPLOY.md](../DEPLOY.md).

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
