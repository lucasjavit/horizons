// Espelho manual dos DTOs do backend (backend/src/tracks/track.dto.ts).
// Não há workspace compartilhado — a duplicação é consciente. Ao mudar um
// lado, mude o outro.

export type LessonKind =
  | 'ARTICLE'
  | 'VIDEO'
  | 'PAPER'
  | 'COURSE'
  | 'BOOK'
  | 'CHANNEL'

export type Block =
  | { type: 'p'; text: string }
  | { type: 'h'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'code'; lang?: string; code: string }
  | { type: 'key'; text: string }
  | { type: 'warn'; title?: string; text: string }
  | { type: 'table'; head: string[]; rows: string[][] }

export interface LessonContent {
  summary: string
  blocks: Block[]
  quiz?: { q: string; a: string }[]
}

export interface TrackSummary {
  id: string
  slug: string
  title: string
  description: string
  icon: string | null
  totalLessons: number
  completedLessons: number
}

export interface LessonListItem {
  id: string
  slug: string
  title: string
  kind: LessonKind
  summary: string | null
  sourceUrl: string | null
  position: number
  hasContent: boolean
  completed: boolean
}

export interface TrackModule {
  id: string
  slug: string
  title: string
  goal: string
  position: number
  lessons: LessonListItem[]
}

export interface TrackDetail {
  id: string
  slug: string
  title: string
  description: string
  icon: string | null
  totalLessons: number
  completedLessons: number
  nextLesson: { moduleSlug: string; lessonSlug: string; title: string } | null
  modules: TrackModule[]
}

export interface LessonNeighbor {
  slug: string
  title: string
}

export interface LessonDetail {
  id: string
  slug: string
  title: string
  kind: LessonKind
  summary: string | null
  sourceUrl: string | null
  content: LessonContent | null
  completed: boolean
  note: string | null
  module: { slug: string; title: string; goal: string }
  track: { slug: string; title: string }
  prev: LessonNeighbor | null
  next: LessonNeighbor | null
}

/** Resultado da busca no corpo das aulas (GET /tracks/:slug/search). */
export interface LessonSearchHit {
  slug: string
  title: string
  moduleTitle: string
}

export interface ProgressResult {
  lessonId: string
  completed: boolean
  completedAt: string | null
  note: string | null
}

/**
 * Espelha `ApiProvider` do `schema.prisma`.
 *
 * Os quatro últimos são gratuitos e sem cartão — foram adicionados em
 * 25/08/2026 porque as duas chaves pagas cadastradas estavam mortas (401 e
 * 429) e a leitura de CV não funcionava nesta instalação.
 */
export type ApiProvider =
  | 'ANTHROPIC'
  | 'OPENAI'
  | 'FIRECRAWL'
  | 'GEMINI'
  | 'GROQ'
  | 'CEREBRAS'
  | 'MISTRAL'

/** O valor do token nunca vem da API — so o final, para reconhecer qual e. */
export interface ApiTokenInfo {
  provider: ApiProvider
  hint: string
  updatedAt: string
}

// --- Vagas (backend/src/jobs/job.dto.ts) ---

export type Senioridade =
  | 'estagio'
  | 'junior'
  | 'pleno'
  | 'senior'
  | 'staff'
  | 'principal'

export type Remoto = 'remoto' | 'hibrido' | 'presencial'

/** Espelha `REGIOES` do backend. */
export type Regiao = 'latam'

/** Espelha `PORTES` do backend. */
export type Porte = 'grande' | 'startup'

/**
 * Espelha `IaDaBusca` do backend — que hoje é o próprio `ApiProvider`.
 *
 * Era `'anthropic' | 'openai'`, uma união escrita para exatamente dois. A lista
 * de provedores agora cresce em `backend/src/ia/provedores.ts`, e um tipo que
 * precisasse ser editado a cada provedor novo seria o mesmo problema que a
 * cadeia veio resolver.
 */
export type IaDaBusca = ApiProvider

export type Contrato = 'clt' | 'pj' | 'contractor' | 'freelance'

/**
 * Filtros da busca de vagas.
 *
 * Os nomes são `snake_case` porque é o que o prompt de busca espera — não é
 * descuido de padrão. Todos são opcionais, e o `ValidationPipe` do backend usa
 * `forbidNonWhitelisted`: campo fora desta lista **rejeita com 400**, não é
 * ignorado. `companies` e `industries` existem no backend mas a tela não os
 * oferece (decisão de produto no desenho JOB-02).
 */
export interface Filtros {
  job_titles?: string[]
  keywords?: string[]
  exclude_keywords?: string[]
  locations?: string[]
  remote?: Remoto
  /**
   * Região, não país — hoje só `'latam'`.
   *
   * Separada de `locations` porque o backend a expande nos termos que os
   * anúncios usam ("Latin America", "South America", "Brazil"), em vez de
   * mandar a sigla crua para a busca.
   */
  regiao?: Regiao
  /** `startup` ou `grande` — muda o catálogo consultado, não só a ordem. */
  porte?: Porte
  /** Empresa deste país contratando para fora. Espelha `SEDES`. */
  sede_no_pais?: string
  employment_types?: Contrato[]
  seniority?: Senioridade
  /** Unidade inteira da moeda, nunca centavo — o backend exige `@IsInt()`. */
  salary_min?: number
  salary_max?: number
  currency?: string
  posted_within_days?: number
  technologies?: string[]
  visa_required?: boolean
  timezone?: string
}

/** O que fica guardado do CV. Nunca o arquivo, nunca o texto bruto. */
export interface CvProfile {
  stack?: string[]
  senioridade?: Senioridade
  anos?: number
}

export interface JobProfile {
  id: string
  filtros: Filtros
  cvProfile: CvProfile | null
  /** Assinatura dos filtros. O desenho decidiu não mostrar isto na tela. */
  grupo: string
  ativo: boolean
  updatedAt: string
}

/** Corpo do PUT /jobs/profile. */
export interface SalvarPerfil {
  filtros: Filtros
  cvProfile?: CvProfile
  ativo?: boolean
}

export interface AuthUser {
  id: string
  email: string
  name: string
  avatarUrl: string | null
  role: string
}

export interface AuthConfig {
  googleClientId: string | null
  enabled: boolean
  /** Login desligado no servidor: entra direto, sem tela. */
  authDisabled: boolean
}

/** Recursos que o admin liga e desliga em tempo de execução. */
export interface Recursos {
  leituraCvAtiva: boolean
  /** Sem chave de IA o recurso não pode ser ligado. */
  temChaveDeIa: boolean
  /** O motor de ATS está ligado. Não depende de chave — default é ligado. */
  atsAtivo: boolean
  /**
   * O motor do freehire está ligado (JOB-39).
   *
   * É o PRIMEIRO da cascata: 60 vagas em 2,6s contra 1–15 em 128s do ATS
   * (medido em 26/08). O ATS é que virou o fallback dele. Não depende de
   * chave — default é ligado.
   */
  freehireAtivo: boolean
  /** A busca roda sozinha a cada 50 min. Default `false` — gasta sem pedir. */
  buscaAgendadaAtiva: boolean
  /**
   * O e-mail semanal está ligado E tem por onde sair.
   *
   * Sem SMTP isto é `false` mesmo com o interruptor ligado — a dependência
   * manda sobre a flag, igual ao Firecrawl.
   */
  emailAtivo: boolean
  /** O interruptor como o admin o deixou, independente de haver provedor. */
  emailLigado: boolean
  /** Há provedor de e-mail que entrega de verdade? Hoje não: falta SMTP. */
  temProvedorDeEmail: boolean
  /** O histórico de vagas vistas/descartadas está ligado. Default `true`. */
  historicoAtivo: boolean
  /**
   * A colheita do catálogo de ATS está ligada (JOB-37).
   *
   * Sem dependência, como o ATS: as APIs são públicas. Default `true`.
   */
  descobertasAtivas: boolean
  /** O Firecrawl está ligado e utilizável. Desligado = busca pela IA. */
  firecrawlAtivo: boolean
  /** Há ao menos um motor de busca utilizável. */
  buscaPossivel: boolean
  /** Sem token do Firecrawl a busca não pode ser ligada. */
  temChaveFirecrawl: boolean
  /**
   * A ordem COMPLETA da cadeia, como o admin a arrumou.
   *
   * **Substitui `iaPreferida`**, que era um provedor promovido ao topo. Com
   * seis provedores, a segunda e a terceira posições decidem quem atende
   * quando o topo cai. Sempre traz os seis, na ordem gravada.
   */
  ordemDaIa: IaDaBusca[]
  /**
   * Quem de fato SERVE a busca de vagas agora.
   *
   * **Substitui `iaEfetiva`**, que era "o primeiro com chave" — e chave
   * cadastrada não é chave que funciona. Este é o primeiro da cadeia cuja
   * última verificação deu `funcionando`. `null` = a busca por IA está parada.
   */
  iaDaBusca: IaDaBusca | null
  /** Quem serve a leitura de CV e de anúncio. Mesma regra. */
  iaDaExtracao: IaDaBusca | null
  /**
   * Todos os provedores do registro, com o estado de cada um.
   *
   * Substitui os antigos `temChaveAnthropic` / `temChaveOpenAi`: um campo por
   * provedor obrigaria a mexer no DTO, neste espelho e na tela a cada provedor
   * novo. Uma lista não.
   */
  provedores: ProvedorIa[]
  /** Quantos provedores servem a busca de vagas (exige busca na web). */
  provedoresDeBusca: number
  /** Quantos provedores servem a leitura de CV (basta saída estruturada). */
  provedoresDeExtracao: number
}

/** Espelha `ProvedorDto` do backend. */
export interface ProvedorIa {
  id: ApiProvider
  nome: string
  /** Há chave cadastrada (no banco ou no ambiente). */
  temChave: boolean
  /** Faz busca na web — logo, serve para a busca de vagas. */
  buscaWeb: boolean
  /**
   * O provedor treina modelos com o que recebe no free tier.
   *
   * A tela mostra isto ao lado do nome, e não é decoração: o texto do CV vai
   * INTEIRO para o provedor, com CPF, endereço e telefone (JOB-02). Guardar
   * pouco não é enviar pouco, e quem liga a chave precisa saber antes.
   */
  treinaComOsDados: boolean
  /** Onde a pessoa cria a chave. */
  console: string
  /**
   * Tem free tier sem cartão?
   *
   * Duas etiquetas na tela, `Paid` e `Free tier` — sem preço nem taxa por
   * token, que envelhecem e fariam a tela mentir sem ninguém notar.
   */
  gratuito: boolean
  /** O estado da chave, da última verificação guardada. */
  status: StatusDaChave
  /** O código HTTP da última verificação. `null` se não houve resposta. */
  httpStatus: number | null
  /** A frase que explica o estado e diz o que fazer. Vazia quando não há. */
  motivo: string
  /** Quando foi verificado, ISO. `null` se nunca foi. */
  checkedAt: string | null
  /** Os quatro últimos caracteres da chave guardada, se houver. */
  hint: string | null
}

/**
 * Espelha `StatusDaChave` de `backend/src/ia/verificacao.ts`.
 *
 * **`chave_recusada` e `sem_cota` são separados de propósito**: os dois vêm de
 * uma chave que o provedor não aceitou, mas a ação de quem lê é oposta — um
 * pede trocar a chave, o outro pede adicionar crédito. Um selo só mandaria
 * metade dos admins pelo caminho errado.
 *
 * O quinto estado da tela, `Checking…`, é só do frontend: dura o tempo da
 * requisição e nunca é gravado.
 */
export type StatusDaChave =
  | 'sem_chave'
  | 'nao_verificado'
  | 'funcionando'
  | 'chave_recusada'
  | 'sem_cota'
  | 'erro'

/**
 * O que a leitura do currículo devolve, antes de a pessoa revisar.
 *
 * `null` em `senioridade` e `anos` é resposta legítima: o extrator devolve
 * null quando o CV não diz, em vez de chutar. Por isso o tipo aqui é mais
 * largo que `CvProfile`, onde os campos são opcionais.
 */
export interface CvLido {
  cvProfile: {
    stack: string[]
    senioridade: Senioridade | null
    anos: number | null
  }
  /** Sugestões — a tela preenche os campos, e a pessoa edita. */
  filtrosSugeridos: Partial<Filtros>
}

/**
 * Uma vaga encontrada (GET /jobs).
 *
 * **`null` é resposta legítima em todo campo opcional**, e a tela escreve "não
 * informado" em vez de inventar um número. O card JOB-04 é explícito: se a
 * tela ficar feia com campo vazio, a pressão vira preencher — e o desenho
 * passa a causar a alucinação.
 *
 * `salaryTrecho` e `elegibilidadeTrecho` são o texto do anúncio de onde a IA
 * tirou a afirmação. Ficam sob demanda no cartão: é verificável, não é
 * confiança.
 */
export interface Vaga {
  id: string
  title: string
  company: string
  url: string
  local: string | null
  /** Domínio de origem, para a pessoa calibrar a confiança sozinha. */
  fonte: string | null
  regime: string | null
  skills: string[]
  /** Área/família do cargo, como o anúncio escreveu. Ex.: "Back-end Engineer". */
  area: string | null
  /** Anos de experiência pedidos. Nulo é o caso comum. */
  anosExp: number | null
  benefits: string[]
  degree: string | null
  /** Logo da empresa. A tela cai nas iniciais quando falta. */
  logoUrl: string | null
  /** ISO-3166 alpha-2 minúsculo ("us", "br"), para a bandeirinha. */
  paisIso: string | null
  salaryMin: number | null
  salaryMax: number | null
  currency: string | null
  salaryTrecho: string | null
  /**
   * De onde a vaga aceita candidato. `null` = o anúncio não disse.
   *
   * Nunca lista vazia: vazio seria lido como "não aceita ninguém", que é uma
   * afirmação que nenhum anúncio faz.
   */
  paisesElegiveis: string[] | null
  /** Aceita de qualquer lugar, sem restrição. */
  elegivelGlobal: boolean
  elegibilidadeTrecho: string | null
  postedAt: string | null
  foundAt: string
}

/** Com que frequência o e-mail de vagas chega. */
export type Cadencia = 'semanal' | 'mensal'

/**
 * A assinatura do e-mail de vagas (JOB-24/JOB-25).
 *
 * **Sem o token de propósito.** Ele é a credencial dos links de um clique do
 * e-mail; na tela a pessoa já tem sessão e nunca precisa dele.
 */
export interface Assinatura {
  id: string
  cadencia: string
  ativo: boolean
  ultimoEnvioEm: string | null
  /** Quando clicou em "consegui a vaga". Nulo = nunca clicou. */
  contratadoEm: string | null
}

/** O que uma rodada de envio fez. */
export interface ResultadoRodada {
  considerados: number
  enviados: number
  pulados: number
  falhas: number
  provedor: string
  provedorEntrega: boolean
  /** Quantas mensagens saíram pelo Telegram (JOB-32). */
  enviadosTelegram: number
  /** O canal do Telegram entrega? `false` sem TELEGRAM_BOT_TOKEN. */
  provedorTelegramEntrega: boolean
}

/** A métrica de contratados, para o admin (JOB-25). */
export interface MetricasEmail {
  assinantes: number
  ativos: number
  /** Quantas pessoas o Horizons empregou. */
  contratados: number
  emCadenciaMensal: number
  jaReceberamAlgum: number
  provedor: string
  provedorEntrega: boolean
  /** A taxa de vinculação do Telegram — o número que o JOB-32 produz. */
  telegramVinculados: number
  /** Dos vinculados, quantos ainda recebem (o resto bloqueou o bot). */
  telegramAtivos: number
  telegramLigado: boolean
}

/**
 * O estado do canal Telegram para esta conta (JOB-32).
 *
 * **Sem token.** O deep link vem montado de `vincularTelegram`; não existe
 * campo de token em resposta nenhuma — é credencial, mesma regra do JOB-24.
 */
export interface TelegramStatus {
  /**
   * O canal está configurado no servidor (token do bot + username)?
   *
   * `false` faz a opção **não aparecer** na tela — em vez de aparecer e
   * falhar no clique.
   */
  disponivel: boolean
  vinculado: boolean
  /** @username de quem vinculou, para dizer qual conta está ligada. */
  username: string | null
  /** Recebendo mensagens? `false` com `vinculado` true = bot bloqueado. */
  ativo: boolean
}

/** O deep link `t.me/<bot>?start=<token>` que a tela abre. */
export interface TelegramVinculo {
  url: string
  /** Quando o convite deixa de valer, para a tela poder oferecer outro. */
  expiraEm: string
}

/** Uma vaga descartada, com o mínimo para a pessoa reconhecê-la. */
export interface VagaMarcada {
  url: string
  title: string
  company: string
  marcadaEm: string
}

/**
 * O histórico da pessoa (JOB-26).
 *
 * As vistas são só URLs — a tela já tem os dados da vaga na lista de busca. As
 * descartadas trazem título e empresa porque somem da lista, e precisam ser
 * mostradas em outro lugar para poderem voltar.
 */
export interface Historico {
  vistas: string[]
  descartadas: VagaMarcada[]
}

/**
 * Um host que a busca encontrou e o catálogo não tinha (JOB-37).
 *
 * Espelha `HostDescobertoDto` do backend. **Agrupado por host, não por
 * empresa**: três empresas em `app.careerpuck.com` revelam um ATS inteiro por
 * descobrir; trinta em `job-boards.greenhouse.io` só confirmam o já sabido.
 */
export interface HostDescoberto {
  host: string
  /** `greenhouse` | `lever` | `ashby`, ou `null` quando não se sabe consultar. */
  ats: string | null
  /** Quantos slugs distintos deste host já apareceram. */
  slugs: number
  /** Soma das aparições de todos os slugs deste host. */
  aparicoes: number
  /** Vagas que os slugs confirmados renderam. É o número que decide. */
  vagas: number
  confirmadas: number
  mortas: number
  desconhecidas: number
  novas: number
  /**
   * Slugs que a verificação achou, mas que o catálogo já tinha.
   *
   * **Não é descoberta**: o que era novo era o host, não a empresa. Duolingo
   * publica em `careers.duolingo.com` e já está no catálogo.
   */
  jaNoCatalogo: number
  exemploUrl: string
  /** Quando foi verificado pela última vez, ISO. `null` = nunca. */
  checkedAt: string | null
}


// ————————————————————————————————————————————————————————————————
// O modal de filtros avançados (JOB-41)
// ————————————————————————————————————————————————————————————————

/** Uma opção dentro de uma categoria, com quantas vagas ela tem. */
export interface OpcaoFaceta {
  /** O valor canônico, como a API o escreve (`software_engineering`). */
  valor: string
  /**
   * Quantas vagas casam, com os OUTROS filtros já aplicados.
   *
   * `null` no valor que a tela reinjetou por estar selecionado mas ausente da
   * faceta — o caso do chip excluído, que sai do resultado por definição. Não
   * sabemos o número dele, e inventar um seria pior que omitir.
   */
  total: number | null
}

/**
 * As contagens que alimentam o modal.
 *
 * `disponivel: false` não é erro — é "o motor que sustenta isto está fora". A
 * tela ESCONDE as categorias que dependiam dele, em vez de mostrá-las mortas:
 * filtro que não filtra é pior que filtro ausente.
 */
export interface Facetas {
  disponivel: boolean
  /** O número do botão `Show N jobs`. `null` quando indisponível. */
  total: number | null
  facetas: Record<string, OpcaoFaceta[]>
}

/** Uma busca guardada, com os filtros e os canais de alerta. */
export interface BuscaSalva {
  id: string
  nome: string
  filtros: Record<string, unknown>
  porEmail: boolean
  porTelegram: boolean
  createdAt: string
}
