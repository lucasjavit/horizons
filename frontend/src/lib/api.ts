import axios, { AxiosError } from 'axios'
import type {
  ApiProvider,
  ApiTokenInfo,
  LessonDetail,
  LessonSearchHit,
  ProgressResult,
  TrackDetail,
  TrackSummary,
} from '../types/api'

const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3333/api',
  timeout: 10_000,
})

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

  async setNote(lessonId: string, note: string): Promise<ProgressResult> {
    const { data } = await http.put<ProgressResult>(
      `/progress/${lessonId}/note`,
      { note },
    )
    return data
  },
}
