import axios, { AxiosError } from 'axios'
import { perdeuSessao, tokenStore } from './auth'
import type {
  ApiProvider,
  Assinatura,
  AuthConfig,
  Cadencia,
  AuthUser,
  ApiTokenInfo,
  JobProfile,
  LessonDetail,
  LessonSearchHit,
  CvLido,
  ProgressResult,
  MetricasEmail,
  Historico,
  HostDescoberto,
  Recursos,
  ResultadoRodada,
  SalvarPerfil,
  TelegramStatus,
  TelegramVinculo,
  TrackDetail,
  TrackSummary,
  Vaga,
} from '../types/api'

const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3333/api',
  // 10s cobre as chamadas comuns. A busca de vagas nao passa por aqui: ela e
  // SSE por `fetch`, e o timeout do axios nao a alcanca — foi conferido em
  // 21/08 antes de mexer, porque o card do JOB-03 supunha o contrario.
  timeout: 10_000,
})

// Anexa a sessao em toda chamada.
http.interceptors.request.use((config) => {
  const token = tokenStore.get()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Sessao expirada ou revogada derruba o login, em vez de virar um erro
// generico em cada tela.
http.interceptors.response.use(
  (r) => r,
  (error: unknown) => {
    if (error instanceof AxiosError && error.response?.status === 401) {
      // So quando havia uma sessao para perder. Sem esta condicao, o 401 que
      // um anonimo recebe ao tentar marcar aula concluida seria tratado como
      // sessao expirada — limpando um token que nao existe e disparando os
      // ouvintes a toa. Para quem nunca entrou, 401 e resposta esperada,
      // nao queda de sessao.
      if (tokenStore.get()) perdeuSessao()
    }
    return Promise.reject(error)
  },
)

/**
 * O erro e "voce precisa entrar", e nao "deu errado"?
 *
 * Separa o unico 401 que nao e falha: a acao pede uma sessao que a pessoa
 * ainda nao tem. A tela usa isto para convidar em vez de acusar defeito.
 */
export function ehSemSessao(error: unknown): boolean {
  return error instanceof AxiosError && error.response?.status === 401
}

/** Mensagem de erro legível — a API devolve `message` do Nest quando falha. */
export function errorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    const data = error.response?.data as { message?: string | string[] } | undefined
    const message = data?.message
    if (Array.isArray(message)) return message.join(', ')
    if (message) return message
    if (error.code === 'ECONNABORTED') return 'The request took too long.'
    if (!error.response) return 'Could not reach the API. Is it running?'
    return `Error ${error.response.status}`
  }
  return 'Unexpected error.'
}

export const api = {
  async authConfig(signal?: AbortSignal): Promise<AuthConfig> {
    const { data } = await http.get<AuthConfig>('/auth/config', { signal })
    return data
  },

  async loginComGoogle(idToken: string): Promise<{ user: AuthUser; accessToken: string }> {
    const { data } = await http.post<{ user: AuthUser; accessToken: string }>(
      '/auth/google',
      { idToken },
    )
    return data
  },

  async me(signal?: AbortSignal): Promise<AuthUser> {
    const { data } = await http.get<AuthUser>('/auth/me', { signal })
    return data
  },

  async listTracks(signal?: AbortSignal): Promise<TrackSummary[]> {
    const { data } = await http.get<TrackSummary[]>('/tracks', { signal })
    return data
  },

  async getTrack(slug: string, signal?: AbortSignal): Promise<TrackDetail> {
    const { data } = await http.get<TrackDetail>(`/tracks/${slug}`, { signal })
    return data
  },

  async getLesson(
    trackSlug: string,
    lessonSlug: string,
    signal?: AbortSignal,
  ): Promise<LessonDetail> {
    const { data } = await http.get<LessonDetail>(
      `/tracks/${trackSlug}/lessons/${lessonSlug}`,
      { signal },
    )
    return data
  },

  /** Busca no corpo das aulas; título e resumo já são filtrados no cliente. */
  async searchLessons(
    trackSlug: string,
    q: string,
    signal?: AbortSignal,
  ): Promise<LessonSearchHit[]> {
    const { data } = await http.get<LessonSearchHit[]>(
      `/tracks/${trackSlug}/search`,
      { params: { q }, signal },
    )
    return data
  },

  async setCompleted(
    lessonId: string,
    completed: boolean,
  ): Promise<ProgressResult> {
    const { data } = await http.put<ProgressResult>(`/progress/${lessonId}`, {
      completed,
    })
    return data
  },

  async listTokens(signal?: AbortSignal): Promise<ApiTokenInfo[]> {
    const { data } = await http.get<ApiTokenInfo[]>('/settings/tokens', { signal })
    return data
  },

  async setToken(provider: ApiProvider, token: string): Promise<ApiTokenInfo> {
    const { data } = await http.put<ApiTokenInfo>('/settings/tokens', {
      provider,
      token,
    })
    return data
  },

  async removeToken(provider: ApiProvider): Promise<void> {
    await http.delete(`/settings/tokens/${provider}`)
  },

  async recursos(signal?: AbortSignal): Promise<Recursos> {
    const { data } = await http.get<Recursos>('/settings/recursos', { signal })
    return data
  },

  /** Le o CV. multipart: o arquivo vai em memoria e nao fica no servidor. */
  async lerCurriculo(arquivo: File): Promise<CvLido> {
    const corpo = new FormData()
    corpo.append('arquivo', arquivo)
    const { data } = await http.post<CvLido>('/jobs/profile/cv', corpo, {
      // Uma leitura de CV passa por parse + chamada de IA; os 10s do padrao
      // matariam a requisicao antes da resposta.
      timeout: 90_000,
    })
    return data
  },

  async definirLeituraCv(ativa: boolean): Promise<Recursos> {
    const { data } = await http.put<Recursos>('/settings/recursos/leitura-cv', {
      ativa,
    })
    return data
  },

  /**
   * Move um provedor uma posição na cadeia.
   *
   * Substitui `definirIaDaBusca`, que gravava UM preferido: a tela agora
   * ordena a lista inteira com setas ↑↓.
   */
  async moverProvedor(
    provedor: ApiProvider,
    direcao: 'cima' | 'baixo',
    /**
     * Em qual cadeia a pessoa clicou.
     *
     * A cadeia de busca mostra 3 dos 6 provedores; sem isto, mover ali
     * trocaria com um provedor que não aparece na lista — a tela não mudaria e
     * o botão pareceria quebrado.
     */
    cadeia?: 'estruturada' | 'buscaWeb',
  ): Promise<Recursos> {
    const { data } = await http.put<Recursos>('/settings/recursos/ordem-da-ia', {
      provedor,
      direcao,
      ...(cadeia ? { cadeia } : {}),
    })
    return data
  },

  /**
   * Verifica as seis chaves agora — o botão `Test all keys`.
   *
   * `POST` e não `GET` porque **gasta**: são até seis chamadas reais aos
   * provedores. O timeout é generoso porque seis provedores lentos somam.
   */
  async verificarChaves(): Promise<Recursos> {
    const { data } = await http.post<Recursos>(
      '/settings/recursos/verificar-chaves',
      undefined,
      { timeout: 120_000 },
    )
    return data
  },

  async definirBuscaAgendada(ativa: boolean): Promise<Recursos> {
    const { data } = await http.put<Recursos>(
      '/settings/recursos/busca-agendada',
      { ativa },
    )
    return data
  },

  async definirAts(ativa: boolean): Promise<Recursos> {
    const { data } = await http.put<Recursos>('/settings/recursos/ats', { ativa })
    return data
  },

  async definirBuscaVagas(ativa: boolean): Promise<Recursos> {
    const { data } = await http.put<Recursos>('/settings/recursos/busca-vagas', {
      ativa,
    })
    return data
  },

  async definirDescobertas(ativa: boolean): Promise<Recursos> {
    const { data } = await http.put<Recursos>('/settings/recursos/descobertas', {
      ativa,
    })
    return data
  },

  /** A fila de descobertas do catálogo, agrupada por host (JOB-37). */
  async descobertas(signal?: AbortSignal): Promise<HostDescoberto[]> {
    const { data } = await http.get<HostDescoberto[]>('/jobs/descobertas', {
      signal,
    })
    return data
  },

  /**
   * Roda a verificação agora, sem esperar as 3h.
   *
   * Sem `signal`: ela leva minutos (uma consulta a cada 5s) e abortar no meio
   * deixaria metade da fila verificada — o que já está gravado, está.
   */
  async verificarDescobertas(): Promise<{ verificadas: number }> {
    const { data } = await http.post<{ verificadas: number }>(
      '/jobs/descobertas/verificar',
    )
    return data
  },

  async definirHistorico(ativa: boolean): Promise<Recursos> {
    const { data } = await http.put<Recursos>('/settings/recursos/historico', {
      ativa,
    })
    return data
  },

  async definirEmailSemanal(ativa: boolean): Promise<Recursos> {
    const { data } = await http.put<Recursos>(
      '/settings/recursos/email-semanal',
      { ativa },
    )
    return data
  },

  // ---- E-mail de vagas (JOB-24 / JOB-25) ----

  async minhaAssinatura(signal?: AbortSignal): Promise<Assinatura> {
    const { data } = await http.get<Assinatura>('/email/assinatura', { signal })
    return data
  },

  async definirEmailAtivo(ativo: boolean): Promise<Assinatura> {
    const { data } = await http.put<Assinatura>('/email/assinatura/ativo', {
      ativo,
    })
    return data
  },

  async definirCadencia(cadencia: Cadencia): Promise<Assinatura> {
    const { data } = await http.put<Assinatura>('/email/assinatura/cadencia', {
      cadencia,
    })
    return data
  },

  /**
   * Descadastrar pelo token do e-mail, **sem sessão**.
   *
   * Não passa pelo interceptor de 401 porque não depende de token de sessão:
   * quem chega aqui veio de um link no e-mail e pode nunca ter entrado no site.
   */
  async sairDoEmail(t: string): Promise<Assinatura> {
    const { data } = await http.post<Assinatura>('/email/sair', null, {
      params: { t },
    })
    return data
  },

  async marcarContratado(t: string): Promise<Assinatura> {
    const { data } = await http.post<Assinatura>('/email/contratado', null, {
      params: { t },
    })
    return data
  },

  async voltarAProcurar(t: string): Promise<Assinatura> {
    const { data } = await http.post<Assinatura>(
      '/email/voltar-a-procurar',
      null,
      { params: { t } },
    )
    return data
  },

  // ---- Telegram (JOB-32) ----

  async telegramStatus(signal?: AbortSignal): Promise<TelegramStatus> {
    const { data } = await http.get<TelegramStatus>('/telegram/status', {
      signal,
    })
    return data
  },

  /**
   * Cria o convite e devolve o deep link.
   *
   * O token de uso único viaja dentro da URL porque o Telegram exige que a
   * pessoa o carregue — mas não há campo `token` na resposta.
   */
  async vincularTelegram(): Promise<TelegramVinculo> {
    const { data } = await http.post<TelegramVinculo>('/telegram/vincular')
    return data
  },

  async desvincularTelegram(): Promise<TelegramStatus> {
    const { data } = await http.delete<TelegramStatus>('/telegram/vincular')
    return data
  },

  async metricasEmail(signal?: AbortSignal): Promise<MetricasEmail> {
    const { data } = await http.get<MetricasEmail>('/email/metricas', { signal })
    return data
  },

  async rodarEmail(): Promise<ResultadoRodada> {
    const { data } = await http.post<ResultadoRodada>('/email/rodar')
    return data
  },

  /**
   * A prévia do que sairia agora, ou `null` quando não há vaga nova.
   *
   * `null` é resposta legítima e significa **"esta semana não geraria
   * e-mail"** — o critério do JOB-24. Vale aqui a mesma normalização do
   * `getJobProfile`: o Nest devolve corpo vazio, que o axios entrega como `''`.
   */
  async previaEmail(
    signal?: AbortSignal,
  ): Promise<{ assunto: string; html: string; texto: string } | null> {
    const { data } = await http.get<
      { assunto: string; html: string; texto: string } | ''
    >('/email/previa', { signal })
    return data === '' || data === null ? null : data
  },

  /**
   * O perfil de busca, ou `null` para quem ainda não cadastrou.
   *
   * O Nest devolve 200 com **corpo vazio** quando o serviço retorna `null`, e
   * o axios entrega isso como `''` — não como `null`. Sem esta normalização a
   * tela receberia uma string vazia e trataria como perfil existente.
   */
  async getJobProfile(signal?: AbortSignal): Promise<JobProfile | null> {
    const { data } = await http.get<JobProfile | ''>('/jobs/profile', { signal })
    return data === '' || data === null ? null : data
  },

  async saveJobProfile(body: SalvarPerfil): Promise<JobProfile> {
    const { data } = await http.put<JobProfile>('/jobs/profile', body)
    return data
  },

  async removeJobProfile(): Promise<void> {
    await http.delete('/jobs/profile')
  },

  /**
   * As vagas encontradas para o grupo da pessoa.
   *
   * Quem não tem perfil recebe `[]` — o backend não distingue "sem perfil" de
   * "sem vaga", e é a tela que separa os dois casos usando o perfil que já
   * carregou.
   */
  async listarVagas(signal?: AbortSignal): Promise<Vaga[]> {
    const { data } = await http.get<Vaga[]>('/jobs', { signal })
    return data
  },

  /** As vagas que a pessoa guardou. Ficam para sempre. */
  async listarSalvas(signal?: AbortSignal): Promise<Vaga[]> {
    const { data } = await http.get<Vaga[]>('/jobs/saved', { signal })
    return data
  },

  /**
   * Salva a vaga inteira, não só a URL.
   *
   * O anúncio sai do ar em semanas, e é justamente o que ela vai querer reler
   * antes da entrevista — buscar de novo depois não funcionaria.
   */
  async salvarVaga(vaga: Vaga): Promise<Vaga> {
    const { data } = await http.post<Vaga>('/jobs/saved', {
      title: vaga.title,
      company: vaga.company,
      url: vaga.url,
      local: vaga.local ?? undefined,
      fonte: vaga.fonte ?? undefined,
      regime: vaga.regime ?? undefined,
      skills: vaga.skills,
      area: vaga.area ?? undefined,
      anosExp: vaga.anosExp ?? undefined,
      benefits: vaga.benefits,
      degree: vaga.degree ?? undefined,
      logoUrl: vaga.logoUrl ?? undefined,
      paisIso: vaga.paisIso ?? undefined,
      snapshot: {
        salaryMin: vaga.salaryMin,
        salaryMax: vaga.salaryMax,
        currency: vaga.currency,
        salaryTrecho: vaga.salaryTrecho,
        paisesElegiveis: vaga.paisesElegiveis,
        elegivelGlobal: vaga.elegivelGlobal,
        elegibilidadeTrecho: vaga.elegibilidadeTrecho,
      },
      postedAt: vaga.postedAt ?? undefined,
      foundAt: vaga.foundAt,
    })
    return data
  },

  async removerSalva(url: string): Promise<void> {
    await http.delete('/jobs/saved', { params: { url } })
  },

  async listarHistorico(signal?: AbortSignal): Promise<Historico> {
    const { data } = await http.get<Historico>('/jobs/history', { signal })
    return data
  },

  /**
   * Marca a vaga como vista ou descartada.
   *
   * Manda título e empresa junto: a busca é ao vivo e não grava a vaga no
   * banco, então sem eles a lista de descartadas seria só URL crua e a pessoa
   * não teria como reconhecer o que desfazer.
   */
  async marcarVaga(
    vaga: { url: string; title: string; company: string },
    estado: 'visto' | 'descartado',
  ): Promise<Historico> {
    const { data } = await http.post<Historico>('/jobs/history', {
      url: vaga.url,
      estado,
      title: vaga.title,
      company: vaga.company,
    })
    return data
  },

  /** Desfaz o descarte: sem linha no histórico, a vaga volta a ser nova. */
  async desmarcarVaga(url: string): Promise<Historico> {
    const { data } = await http.delete<Historico>('/jobs/history', {
      params: { url },
    })
    return data
  },

  async setNote(lessonId: string, note: string): Promise<ProgressResult> {
    const { data } = await http.put<ProgressResult>(
      `/progress/${lessonId}/note`,
      { note },
    )
    return data
  },
}
