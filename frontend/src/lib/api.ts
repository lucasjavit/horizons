import axios, { AxiosError } from 'axios'
import { perdeuSessao, tokenStore } from './auth'
import type {
  ApiProvider,
  AuthConfig,
  AuthUser,
  ApiTokenInfo,
  JobProfile,
  LessonDetail,
  LessonSearchHit,
  ProgressResult,
  SalvarPerfil,
  TrackDetail,
  TrackSummary,
} from '../types/api'

const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3333/api',
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
    if (error.code === 'ECONNABORTED') return 'A requisição demorou demais.'
    if (!error.response) return 'Não foi possível falar com a API. Ela está no ar?'
    return `Erro ${error.response.status}`
  }
  return 'Erro inesperado.'
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

  async setNote(lessonId: string, note: string): Promise<ProgressResult> {
    const { data } = await http.put<ProgressResult>(
      `/progress/${lessonId}/note`,
      { note },
    )
    return data
  },
}
