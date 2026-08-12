import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { BlockRenderer, WARN_INK } from '../components/blocks/BlockRenderer'
import { LessonSidebar } from '../components/LessonSidebar'
import { Quiz } from '../components/Quiz'
import { ErrorState, LoadingState } from '../components/States'
import { api, errorMessage } from '../lib/api'
import { useAsync } from '../lib/useAsync'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import { useKeyboardShortcuts } from '../lib/useKeyboardShortcuts'

export function LessonPage() {
  const { trackSlug = '', lessonSlug = '' } = useParams()
  const navigate = useNavigate()

  const lesson = useAsync(
    (signal) => api.getLesson(trackSlug, lessonSlug, signal),
    [trackSlug, lessonSlug],
  )
  // A trilha alimenta a sidebar; recarrega só quando a trilha muda.
  const track = useAsync((signal) => api.getTrack(trackSlug, signal), [trackSlug])

  useDocumentTitle(lesson.data?.title ?? null)

  const [menuAberto, setMenuAberto] = useState(false)
  const [erroAcao, setErroAcao] = useState<string | null>(null)

  // Ao trocar de aula: volta ao topo e fecha o menu mobile.
  useEffect(() => {
    window.scrollTo({ top: 0 })
    setMenuAberto(false)
    setErroAcao(null)
  }, [lessonSlug])

  const dados = lesson.data

  const alternarConclusao = async () => {
    if (!dados) return
    const desejado = !dados.completed
    setErroAcao(null)
    lesson.setData({ ...dados, completed: desejado })

    try {
      await api.setCompleted(dados.id, desejado)
      track.reload() // mantém a sidebar e o progresso em dia
    } catch (err) {
      lesson.setData({ ...dados, completed: !desejado })
      setErroAcao(errorMessage(err))
    }
  }

  useKeyboardShortcuts({
    j: () => {
      if (dados?.next) navigate(`/t/${trackSlug}/${dados.next.slug}`)
    },
    k: () => {
      if (dados?.prev) navigate(`/t/${trackSlug}/${dados.prev.slug}`)
    },
    c: () => void alternarConclusao(),
    '/': () => {
      setMenuAberto(true)
      // O painel do mobile precisa existir no DOM antes de receber foco.
      requestAnimationFrame(() =>
        document.getElementById('busca-aulas')?.focus(),
      )
    },
  })

  if (lesson.loading) return <LoadingState label="Carregando aula…" />
  if (lesson.error)
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <ErrorState message={lesson.error} onRetry={lesson.reload} />
      </div>
    )
  if (!dados) return null

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:flex lg:gap-10 lg:py-10">
      {/* Sidebar — fixa no desktop, painel colapsável no mobile.
          `self-start` é o que faz o sticky funcionar: sem ele o item flex
          estica na altura toda e não sobra espaço para grudar. */}
      <aside className="lg:w-64 lg:shrink-0 lg:self-start lg:sticky lg:top-20">
        <button
          type="button"
          onClick={() => setMenuAberto((v) => !v)}
          aria-expanded={menuAberto}
          className="mb-4 flex w-full items-center justify-between rounded-lg border px-4 py-2.5 text-sm font-medium lg:hidden"
          style={{ borderColor: 'var(--border)' }}
        >
          Aulas da trilha
          <span aria-hidden>{menuAberto ? '▲' : '▼'}</span>
        </button>

        <div
          className={`${menuAberto ? 'block' : 'hidden'} mb-6 rounded-lg border p-4 lg:block lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto lg:border-0 lg:p-0`}
          style={{ borderColor: 'var(--border)' }}
        >
          {track.data && (
            <LessonSidebar
              track={track.data}
              aulaAtual={lessonSlug}
              onNavigate={() => setMenuAberto(false)}
            />
          )}
        </div>
      </aside>

      <main id="conteudo" tabIndex={-1} className="min-w-0 flex-1">
        <Breadcrumb
          trackSlug={trackSlug}
          trackTitle={dados.track.title}
          moduleSlug={dados.module.slug}
          moduleTitle={dados.module.title}
        />
        <h1 className="mt-1.5 text-2xl font-bold tracking-tight sm:text-3xl">
          {dados.title}
        </h1>
        {dados.summary && (
          <p
            className="mt-3 text-[1.0625rem] leading-relaxed"
            style={{ color: 'var(--text-muted)' }}
          >
            {dados.summary}
          </p>
        )}

        <hr className="my-8" style={{ borderColor: 'var(--border)' }} />

        {dados.content ? (
          <>
            <article>
              <BlockRenderer blocks={dados.content.blocks} />
            </article>
            {dados.content.quiz && dados.content.quiz.length > 0 && (
              <Quiz questions={dados.content.quiz} />
            )}
          </>
        ) : (
          <div
            className="rounded-lg border border-dashed p-8 text-center"
            style={{ borderColor: 'var(--border)' }}
          >
            <p className="font-medium">Conteúdo em produção</p>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
              Esta aula ainda não tem texto autoral escrito.
              {dados.sourceUrl && ' Por enquanto, use a leitura complementar abaixo.'}
            </p>
          </div>
        )}

        {dados.sourceUrl && (
          <p className="mt-8 text-sm">
            <span style={{ color: 'var(--text-muted)' }}>Leitura complementar: </span>
            <a
              href={dados.sourceUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-block py-1.5 font-medium underline"
              style={{ color: 'var(--accent-ink)' }}
            >
              fonte original ↗
            </a>
          </p>
        )}

        <NoteBox lessonId={dados.id} inicial={dados.note ?? ''} />

        <div className="mt-8">
          <button
            type="button"
            onClick={() => void alternarConclusao()}
            className="w-full rounded-lg px-5 py-3 font-semibold sm:w-auto"
            style={
              dados.completed
                ? { background: 'var(--accent)', color: 'var(--accent-text)' }
                : { background: 'var(--brand)', color: 'var(--brand-text)' }
            }
          >
            {dados.completed ? '✓ Aula concluída' : 'Marcar como concluída'}
          </button>
          {erroAcao && (
            <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }} role="alert">
              Não foi possível salvar: {erroAcao}
            </p>
          )}
        </div>

        <nav
          className="mt-10 flex flex-col gap-3 border-t pt-6 sm:flex-row sm:justify-between"
          style={{ borderColor: 'var(--border)' }}
          aria-label="Navegação entre aulas"
        >
          {dados.prev ? (
            <Link
              to={`/t/${trackSlug}/${dados.prev.slug}`}
              className="min-w-0 rounded-lg border p-3 text-sm sm:max-w-[48%]"
              style={{ borderColor: 'var(--border)' }}
            >
              <span className="block text-xs" style={{ color: 'var(--text-muted)' }}>
                ← Anterior
              </span>
              <span className="mt-0.5 block truncate font-medium">
                {dados.prev.title}
              </span>
            </Link>
          ) : (
            <span />
          )}
          {dados.next && (
            <Link
              to={`/t/${trackSlug}/${dados.next.slug}`}
              className="min-w-0 rounded-lg border p-3 text-right text-sm sm:max-w-[48%]"
              style={{ borderColor: 'var(--border)' }}
            >
              <span className="block text-xs" style={{ color: 'var(--text-muted)' }}>
                Próxima →
              </span>
              <span className="mt-0.5 block truncate font-medium">
                {dados.next.title}
              </span>
            </Link>
          )}
        </nav>
      </main>
    </div>
  )
}

interface BreadcrumbProps {
  trackSlug: string
  trackTitle: string
  moduleSlug: string
  moduleTitle: string
}

/**
 * Caminho de volta a partir da aula. Antes o módulo era texto inerte: no
 * mobile, com a sidebar fechada, não havia como saber onde se estava nem
 * como voltar ao módulo — só à trilha inteira.
 */
function Breadcrumb({
  trackSlug,
  trackTitle,
  moduleSlug,
  moduleTitle,
}: BreadcrumbProps) {
  const sep = (
    <span aria-hidden style={{ color: 'var(--border)' }}>
      ›
    </span>
  )
  return (
    <nav aria-label="Você está aqui" className="mb-1.5">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        <li>
          <Link to="/" className="inline-block py-1.5 hover:underline" style={{ color: 'var(--text-muted)' }}>
            Trilhas
          </Link>
        </li>
        <li>{sep}</li>
        <li>
          <Link
            to={`/t/${trackSlug}`}
            className="inline-block py-1.5 hover:underline"
            style={{ color: 'var(--text-muted)' }}
          >
            {trackTitle}
          </Link>
        </li>
        <li>{sep}</li>
        <li>
          {/* O hash identifica o módulo a abrir na página da trilha. */}
          <Link
            to={`/t/${trackSlug}#${moduleSlug}`}
            className="inline-block py-1.5 font-semibold uppercase tracking-widest hover:underline"
            style={{ color: 'var(--accent-ink)' }}
          >
            {moduleTitle}
          </Link>
        </li>
      </ol>
    </nav>
  )
}

const DEBOUNCE_MS = 800

/**
 * Anotação pessoal da aula, com salvamento automático.
 *
 * A anotação é o único dado que o usuário cria — e o único que ele pode
 * perder. Por isso ela grava sozinha após a digitação parar, e grava também
 * ao sair da aula, em vez de depender de o botão ser clicado.
 *
 * Esvaziar uma anotação que tinha conteúdo é a única operação destrutiva do
 * app: pede confirmação explícita em vez de oferecer desfazer, porque o
 * autosave dispara sem clique — um "desfazer" que expira sozinho poderia
 * passar despercebido justamente quando o texto some sem ação do usuário.
 */
function NoteBox({ lessonId, inicial }: { lessonId: string; inicial: string }) {
  const [texto, setTexto] = useState(inicial)
  const [estado, setEstado] = useState<'ocioso' | 'salvando' | 'salvo' | 'erro'>(
    'ocioso',
  )
  const [erro, setErro] = useState<string | null>(null)
  const [confirmandoLimpeza, setConfirmandoLimpeza] = useState(false)

  const salvo = useRef(inicial)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // O flush no unmount precisa do valor mais recente sem recriar o efeito a
  // cada tecla — daí a ref espelhando o estado.
  const textoRef = useRef(texto)
  textoRef.current = texto
  const lessonIdRef = useRef(lessonId)
  lessonIdRef.current = lessonId

  const gravar = useCallback(async (id: string, valor: string) => {
    setEstado('salvando')
    setErro(null)
    try {
      await api.setNote(id, valor)
      salvo.current = valor
      setEstado('salvo')
    } catch (err) {
      setEstado('erro')
      setErro(errorMessage(err))
    }
  }, [])

  // Trocar de aula reaproveita o componente; o texto precisa acompanhar.
  useEffect(() => {
    setTexto(inicial)
    salvo.current = inicial
    setEstado('ocioso')
    setErro(null)
    setConfirmandoLimpeza(false)
  }, [lessonId, inicial])

  // Ao desmontar (navegar para outra aula), grava o que ficou pendente.
  // Sem isto, sair da página descartaria o rascunho silenciosamente.
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
      const atual = textoRef.current
      // Esvaziar exige confirmação, então nunca é gravado no caminho de saída.
      if (atual !== salvo.current && atual.trim() !== '') {
        void api.setNote(lessonIdRef.current, atual).catch(() => {
          /* a aula já saiu da tela; não há onde mostrar o erro */
        })
      }
    }
  }, [])

  const aoDigitar = (valor: string) => {
    setTexto(valor)
    setEstado('ocioso')
    setErro(null)
    if (timer.current) clearTimeout(timer.current)

    // Apagar tudo o que estava salvo não dispara autosave: seria destruição
    // silenciosa. Fica aguardando confirmação explícita.
    if (valor.trim() === '' && salvo.current.trim() !== '') {
      setConfirmandoLimpeza(true)
      return
    }
    setConfirmandoLimpeza(false)
    if (valor === salvo.current) return

    timer.current = setTimeout(() => {
      void gravar(lessonId, valor)
    }, DEBOUNCE_MS)
  }

  const salvarAgora = () => {
    if (timer.current) clearTimeout(timer.current)
    void gravar(lessonId, texto)
  }

  const confirmarLimpeza = () => {
    setConfirmandoLimpeza(false)
    if (timer.current) clearTimeout(timer.current)
    void gravar(lessonId, '')
  }

  const desfazerLimpeza = () => {
    setConfirmandoLimpeza(false)
    setTexto(salvo.current)
  }

  const pendente = texto !== salvo.current

  return (
    <section className="mt-10">
      <label
        htmlFor="anotacao"
        className="mb-2 block text-sm font-semibold tracking-tight"
      >
        Sua anotação
      </label>
      <textarea
        id="anotacao"
        value={texto}
        onChange={(e) => aoDigitar(e.target.value)}
        rows={4}
        placeholder="O que você não quer esquecer desta aula?"
        className="w-full resize-y rounded-lg border p-3 text-sm leading-relaxed"
        style={{
          borderColor: estado === 'erro' ? WARN_INK : 'var(--border)',
          background: 'var(--surface-sunken)',
          color: 'var(--text)',
        }}
      />

      <div className="mt-2 flex min-h-8 flex-wrap items-center gap-3 text-sm">
        {estado === 'salvando' && (
          <span style={{ color: 'var(--text-muted)' }}>Salvando…</span>
        )}
        {estado === 'salvo' && !pendente && (
          <span style={{ color: 'var(--accent-ink)' }}>Salvo.</span>
        )}
        {estado === 'ocioso' && pendente && !confirmandoLimpeza && (
          <span style={{ color: 'var(--text-muted)' }}>
            Salvando automaticamente…
          </span>
        )}
        {estado === 'ocioso' && !pendente && texto === '' && (
          <span style={{ color: 'var(--text-muted)' }}>
            Salva sozinho enquanto você escreve.
          </span>
        )}
        {pendente && !confirmandoLimpeza && (
          <button
            type="button"
            onClick={salvarAgora}
            className="rounded-md border px-3 py-1.5 font-medium"
            style={{ borderColor: 'var(--border)' }}
          >
            Salvar agora
          </button>
        )}
      </div>

      {confirmandoLimpeza && (
        <div
          className="mt-2 rounded-lg border p-3"
          style={{ borderColor: WARN_INK, background: 'var(--surface-sunken)' }}
          role="alert"
        >
          <p className="text-sm font-medium">
            Apagar a anotação desta aula?
          </p>
          <p className="mt-0.5 text-sm" style={{ color: 'var(--text-muted)' }}>
            O texto salvo ainda está guardado. Nada foi apagado até agora.
          </p>
          <div className="mt-2.5 flex gap-2">
            <button
              type="button"
              onClick={confirmarLimpeza}
              className="rounded-md px-3 py-1.5 text-sm font-semibold"
              style={{ background: WARN_INK, color: '#fff' }}
            >
              Apagar
            </button>
            <button
              type="button"
              onClick={desfazerLimpeza}
              className="rounded-md border px-3 py-1.5 text-sm font-medium"
              style={{ borderColor: 'var(--border)' }}
            >
              Manter o texto
            </button>
          </div>
        </div>
      )}

      {estado === 'erro' && erro && (
        <p
          className="mt-2 rounded-lg border p-3 text-sm"
          style={{ borderColor: WARN_INK, color: 'var(--text)' }}
          role="alert"
        >
          <b style={{ color: WARN_INK }}>Não foi salvo.</b> {erro} O texto
          continua aqui — tente de novo em “Salvar agora”.
        </p>
      )}
    </section>
  )
}
