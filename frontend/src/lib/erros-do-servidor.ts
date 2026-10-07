/**
 * Traducao das mensagens de erro que o backend manda em portugues (APP-02).
 *
 * ## Por que a traducao mora AQUI, e nao no backend
 *
 * O CLAUDE.md manda `NotFoundException` com mensagem em portugues sem acento, e
 * essa regra existe para o log e para quem depura — nao para a tela. Mudar o
 * backend atenderia a tela e cegaria o log. Mudar o contrato para codigo de
 * erro (`{ code: 'CV_FORMATO' }`) e o desenho certo a longo prazo, mas obriga
 * toda rota a mudar de uma vez.
 *
 * O caminho barato e o que o card escolheu: **o portugues continua intacto na
 * API e no log, e a traducao acontece no unico ponto do frontend que exibe
 * `message` do servidor** — `errorMessage()` em `lib/api.ts`. Medido antes de
 * implementar: nenhum componente le `response.data.message` direto, e os 17
 * arquivos que mostram erro de API passam por `errorMessage`. Um ponto so.
 *
 * ## Fallback: repassa o portugues, nao apaga
 *
 * Mensagem desconhecida sai como veio. Uma frase em portugues numa interface
 * em ingles e ruim; trocar por "Something went wrong" e PIOR, porque apaga a
 * unica informacao que quem depura (e quem abre um ticket) tem. O texto
 * errado em idioma errado ainda diz *o que* falhou; o texto genarico nao diz
 * nada. Entao o mapa pode ficar incompleto sem virar perda de informacao — ele
 * degrada para o estado de hoje, nao para pior.
 *
 * ## Sobre as mensagens com valor interpolado
 *
 * Parte do backend monta a mensagem com template (`Nenhum token guardado
 * para openai`). Elas entram em `PADROES`, com regex, porque chave fixa nunca
 * casaria. Regex e mais fragil que string exata, entao fica reservado a esses
 * casos — e `erros-do-servidor.spec.ts` prova cada padrao contra a string que
 * o backend monta hoje.
 */

/**
 * Mensagem exata do backend → o ingles que a tela mostra.
 *
 * A chave tem de casar **byte a byte** com o que o backend manda hoje,
 * inclusive a falta de acento. O teste `erros-do-servidor.spec.ts` le
 * `backend/src/` e falha se uma destas frases sumir de la — e o que impede o
 * mapa de envelhecer em silencio quando alguem reescrever uma mensagem.
 */
const TRADUCOES: Record<string, string> = {
  // ---- Sessao e papel (auth) ----
  // A mais visivel de todas: aparece em QUALQUER tela protegida sem sessao,
  // que e o caso comum depois dos 30 dias do token (card APP-02, 27/08).
  'Entre para continuar.': 'Sign in to continue.',
  'Sessao expirada. Entre novamente.': 'Your session expired. Please sign in again.',
  'Sessao invalida. Entre novamente.': 'Invalid session. Please sign in again.',
  'Esta conta foi desativada.': 'This account has been deactivated.',
  'Esta acao e restrita a administradores.': 'This action is restricted to administrators.',
  'Esta acao e restrita a quem gerencia a plataforma.':
    'This action is restricted to platform managers.',
  'Login com Google nao esta configurado neste servidor.':
    'Google sign-in is not configured on this server.',
  'Token do Google ausente.': 'Missing Google token.',
  'Nao foi possivel validar sua conta Google.': 'Could not validate your Google account.',
  'A conta Google nao retornou um e-mail valido.':
    'Your Google account did not return a valid email address.',
  'Confirme o e-mail da sua conta Google antes de entrar.':
    'Verify the email on your Google account before signing in.',
  'Usuario nao encontrado': 'User not found',

  // ---- Papel e conta (usuarios) ----
  'O papel de admin vem da variavel ADMIN_EMAILS, e nao da tela.':
    'The admin role comes from the ADMIN_EMAILS variable, not from this screen.',
  'Esta conta e admin pela variavel ADMIN_EMAILS. Remova o e-mail de la para tirar o papel.':
    'This account is an admin through the ADMIN_EMAILS variable. Remove the email there to drop the role.',
  'Voce nao pode mudar o proprio papel.': 'You cannot change your own role.',
  'Somente o administrador muda o papel de alguem.': 'Only an administrator can change a role.',
  'Voce nao pode desativar a propria conta.': 'You cannot deactivate your own account.',
  'Voce nao pode desativar esta conta.': 'You cannot deactivate this account.',

  // ---- Leitura de CV: os erros mais comuns da feature (formato errado, PDF
  // escaneado), e o caso que o card aponta como o mais grave depois do guard.
  'Formato nao suportado. Envie o curriculo em PDF ou DOCX.':
    'Unsupported format. Upload your resume as a PDF or DOCX.',
  'O arquivo passa de 5 MB. Envie um PDF ou DOCX menor.':
    'The file is over 5 MB. Upload a smaller PDF or DOCX.',
  'Nao consegui ler texto neste arquivo. Se o curriculo for uma imagem escaneada, exporte em PDF de texto e tente de novo.':
    'We could not read any text in this file. If your resume is a scanned image, export it as a text PDF and try again.',
  'Este PDF esta protegido por senha. Remova a protecao e envie de novo.':
    'This PDF is password-protected. Remove the protection and upload it again.',
  'Nao consegui abrir este PDF. Ele pode estar corrompido.':
    'We could not open this PDF. It may be corrupted.',
  'Nao consegui abrir este DOCX. Ele pode estar corrompido.':
    'We could not open this DOCX. It may be corrupted.',
  'Este arquivo nao parece um curriculo. Envie o seu CV, ou preencha os filtros a mao.':
    'This file does not look like a resume. Upload your CV, or fill in the filters by hand.',
  'Nao consegui processar este arquivo. Tente outro curriculo.':
    'We could not process this file. Try another resume.',
  'Nao consegui ler o curriculo agora. Tente de novo em instantes, ou preencha os filtros a mao.':
    'We could not read the resume right now. Try again in a moment, or fill in the filters by hand.',
  'A leitura de curriculo precisa da chave de algum provedor de IA. Peca ao administrador para cadastrar em Configuracoes, ou preencha os filtros a mao.':
    'Resume reading needs an API key for at least one AI provider. Ask an administrator to add one in Settings, or fill in the filters by hand.',
  'Nenhum provedor de IA conseguiu ler o curriculo: ha chave recusada ou sem credito. Peca ao administrador para conferir em Configuracoes, ou preencha os filtros a mao.':
    'No AI provider could read the resume: at least one API key was refused or is out of credit. Ask the administrator to check the keys in Settings, or fill in the filters by hand.',
  'A leitura de curriculo esta desligada. Preencha os filtros a mao.':
    'Resume reading is turned off. Fill in the filters by hand.',
  'Nenhum arquivo enviado.': 'No file was uploaded.',

  // ---- E-mail de vagas ----
  // Pagina terminal, vista uma vez — mas foi um dos quatro casos medidos.
  'Link invalido ou expirado': 'This link is invalid or has expired',

  // ---- Telegram ----
  'O canal do Telegram nao esta configurado.': 'The Telegram channel is not configured.',

  // ---- Vagas, buscas salvas, historico ----
  'Voce ainda nao tem um perfil de busca': 'You do not have a job profile yet',
  'Busca salva nao encontrada': 'Saved search not found',
  'Vaga salva nao encontrada': 'Saved job not found',
  'Informe a url da vaga': 'Provide the job URL',
  'Informe a url da vaga a remover': 'Provide the URL of the job to remove',
  'A colheita do catalogo esta desligada.': 'Catalog harvesting is turned off.',

  // ---- Configuracoes ----
  'Cadastre o token do Firecrawl antes de ligar o Firecrawl.':
    'Add the Firecrawl token before turning Firecrawl on.',
  'Cadastre a chave de algum provedor de IA antes de ligar a leitura de curriculo.':
    'Add an API key for at least one AI provider before turning resume reading on.',
  'Provedor de IA desconhecido.': 'Unknown AI provider.',

  // ---- Perfil ----
  'Escolha o pais antes de informar o documento': 'Pick a country before entering the document',

  // ---- Ingestao de vagas rastreadas (JOB-50) ----
  //
  // **Nenhuma tela mostra estas duas.** Quem chama `POST /api/ingest/jobs` e o
  // rastreador, que e outra aplicacao — a pessoa nunca ve a resposta. Entram
  // aqui por tres razoes, e nao por cerimonia:
  //
  // 1. a regra de APP-02 e "nenhuma mensagem em portugues escapa", e excecao
  //    por julgamento ("esta nao aparece na tela") e o que faz a trava parar de
  //    pegar a proxima;
  // 2. o dia em que alguem construir uma tela de diagnostico da ingestao, a
  //    traducao ja esta aqui, em vez de o portugues aparecer em producao;
  // 3. a mensagem e lida por quem opera o rastreador, no log dele. A API e em
  //    ingles para o mesmo publico do resto do produto.
  'A ingestao de vagas nao esta configurada neste servidor.':
    'Job ingestion is not configured on this server.',
  'Token de ingestao invalido.': 'Invalid ingestion token.',
}

/**
 * As mensagens que o backend monta com valor interpolado.
 *
 * Ordem importa: a primeira que casar ganha. Sao poucas de proposito — regex
 * envelhece pior que string exata, e so entra aqui o que nao tem chave fixa.
 */
const PADROES: ReadonlyArray<[RegExp, (m: RegExpMatchArray) => string]> = [
  // settings.service.ts: `Nenhum token guardado para ${provider}`
  [/^Nenhum token guardado para (.+)$/, (m) => `No token stored for ${m[1]}`],
  // buscas-salvas.service.ts: `Voce ja tem ${TETO} buscas salvas. Apague uma para guardar outra.`
  [
    /^Voce ja tem (\d+) buscas salvas\. Apague uma para guardar outra\.$/,
    (m) => `You already have ${m[1]} saved searches. Delete one to save another.`,
  ],
]

/**
 * Traduz UMA mensagem do servidor, ou devolve a original.
 *
 * Exportada para o teste e para quem precisar traduzir fora de
 * `errorMessage()` — por exemplo a busca de vagas, que e SSE por `fetch` e nao
 * passa pelo axios.
 */
export function traduzirErroDoServidor(mensagem: string): string {
  const exata = TRADUCOES[mensagem]
  if (exata) return exata

  for (const [padrao, montar] of PADROES) {
    const casou = mensagem.match(padrao)
    if (casou) return montar(casou)
  }

  // Desconhecida: repassa. Ver o cabecalho do arquivo — apagar o texto seria
  // pior que exibi-lo no idioma errado.
  return mensagem
}

/**
 * Traduz o `message` do Nest, que e string OU array de strings.
 *
 * O `ValidationPipe` global usa `forbidNonWhitelisted`, e um corpo invalido
 * volta como array ("address.city must be shorter than..."). Cada item passa
 * pelo mapa — os do pipe ja nascem em ingles e saem intactos pelo fallback,
 * mas um erro de validacao custom pode vir em portugues no meio deles.
 *
 * O join descarta item vazio e nao-string: sem isto, `['', 'x']` imprimiria
 * ", x" com virgula solta na frente, e um array com `null` dentro (o Nest nao
 * promete so strings) viraria "null" na tela. Array sem nada util devolve
 * string vazia, e e `errorMessage` que decide o que fazer com isso — aqui nao
 * ha contexto para escolher o texto generico.
 */
export function traduzirMensagemDaApi(message: string | string[]): string {
  if (!Array.isArray(message)) return traduzirErroDoServidor(message)

  return message
    .filter((item): item is string => typeof item === 'string' && item.trim() !== '')
    .map(traduzirErroDoServidor)
    .join(', ')
}
