import { useRef, useState } from 'react'
import { WARN_INK } from '../blocks/BlockRenderer'
import { api, errorMessage } from '../../lib/api'
import type { CvLido } from '../../types/api'

interface CaixaUploadCVProps {
  /**
   * O recurso está ligado no servidor (Configurações → Recursos).
   *
   * `undefined` enquanto a tela ainda não sabe: nesse intervalo a caixa não
   * aparece, em vez de piscar "indisponível" e virar upload meio segundo
   * depois.
   */
  ativa: boolean | undefined
  /** O perfil lido, para a tela preencher os filtros — editáveis. */
  onLeu: (lido: CvLido) => void
}

type Estado = 'ocioso' | 'enviando' | 'lido'

/**
 * A caixa de upload do currículo, acima da barra de filtros.
 *
 * Fica atrás de um interruptor que o admin liga em Configurações, e que só
 * liga quando há chave de IA cadastrada. Sem o recurso ligado a caixa não
 * aparece — oferecer um upload que o servidor recusa seria pior que não
 * oferecer. O servidor confere o mesmo interruptor: esconder a caixa esconde
 * o botão, não o endpoint.
 *
 * O aviso de privacidade fica **acima do botão de escolher arquivo**, não em
 * rodapé nem em modal depois da escolha. É critério de aceite do JOB-02, e um
 * aviso que chega depois da escolha chega tarde: a decisão já foi tomada.
 *
 * Duas regras do desenho que valem mais que o código bonito:
 *
 * - **recusa nunca preenche campo** — um CV lido errado que produz busca ruim,
 *   sem a pessoa ver o porquê, é o pior desfecho possível;
 * - **erro de upload nunca apaga o que foi digitado** — daí o `onLeu` só ser
 *   chamado no caminho de sucesso.
 *
 * O texto é em inglês como o resto da aba Jobs. O componente foi recuperado do
 * commit 7fb2d72^, onde tinha sido apagado junto com o formulário de perfil; o
 * bloco de privacidade voltou palavra por palavra, porque já era o definitivo.
 */
export function CaixaUploadCV({ ativa, onLeu }: CaixaUploadCVProps) {
  const [estado, setEstado] = useState<Estado>('ocioso')
  const [erro, setErro] = useState<string | null>(null)
  const [nome, setNome] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Enquanto nao se sabe, nada. Ligada = upload; desligada = nem a caixa.
  if (ativa !== true) return null

  const enviar = async (arquivo: File | undefined) => {
    if (!arquivo) return
    setErro(null)
    setNome(arquivo.name)
    setEstado('enviando')
    try {
      const lido = await api.lerCurriculo(arquivo)
      setEstado('lido')
      onLeu(lido)
    } catch (e) {
      // Volta para ocioso, e NAO chama onLeu: nada preenchido a partir de uma
      // leitura que falhou. O que a pessoa ja tinha marcado continua onde
      // estava — este componente nunca escreve nos filtros por conta propria.
      //
      // `errorMessage` devolve a mensagem DO SERVIDOR, que ja vem pronta e em
      // portugues: "este arquivo nao parece um curriculo" diz o que fazer, e
      // um "erro ao enviar" generico nao.
      setEstado('ocioso')
      setErro(errorMessage(e))
      // Limpa o input para o mesmo arquivo poder ser escolhido de novo: sem
      // isto, escolher o mesmo PDF depois de um erro nao dispara onChange.
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <section
      aria-labelledby="cv-titulo"
      className="rounded-xl border p-5"
      style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}
    >
      <h2 id="cv-titulo" className="flex items-center gap-2 text-base font-semibold">
        <span aria-hidden>⬆</span>
        Start from your résumé (optional)
      </h2>

      <p className="mt-1.5 text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
        We read it and tick the filters below for you. Everything stays
        editable — check what we got right before you search.
      </p>

      {/* O aviso é um <p> com borda esquerda, e NÃO role="alert": alert
          interrompe o leitor de tela, e isto é contexto, não urgência. O id
          é apontado pelo input com aria-describedby — quem chega pelo teclado
          ouve o aviso ao focar o botão, que é o "antes do upload" de quem não
          enxerga a tela. */}
      <div
        id="cv-privacidade"
        className="mt-4 rounded-lg border border-l-4 p-3.5 text-sm"
        style={{
          borderColor: 'var(--border)',
          borderLeftColor: WARN_INK,
          background: 'var(--surface-sunken)',
        }}
      >
        <p className="font-medium">
          <span aria-hidden>⚠ </span>Your file is sent to the AI provider to be
          read.
        </p>
        <p className="mt-1 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          We only keep what it understood: stack, seniority and years of
          experience. The file and the résumé text are not stored anywhere.
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label htmlFor="cv-arquivo" className="text-sm font-medium">
          Résumé file
        </label>
        <input
          ref={inputRef}
          id="cv-arquivo"
          type="file"
          accept=".pdf,.docx"
          disabled={estado === 'enviando'}
          onChange={(e) => void enviar(e.target.files?.[0])}
          aria-describedby="cv-privacidade cv-formatos"
          aria-invalid={erro ? true : undefined}
          className="max-w-full text-sm disabled:cursor-not-allowed disabled:opacity-60"
          style={{ color: 'var(--text)' }}
        />
      </div>

      <p id="cv-formatos" className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
        PDF or DOCX, up to 5 MB. A résumé scanned as an image cannot be read.
      </p>

      {/* Um status só, com role="status": o leitor de tela anuncia sem
          interromper, e a pessoa vidente vê o mesmo texto. A chamada de IA
          leva segundos — sem esta linha a tela fica parada e parece travada. */}
      {estado === 'enviando' && (
        <p role="status" className="mt-3 text-sm" style={{ color: 'var(--text-muted)' }}>
          Reading {nome}…
        </p>
      )}

      {estado === 'lido' && (
        <p role="status" className="mt-3 text-sm font-medium">
          Done. The filters marked{' '}
          <span
            className="rounded-full border px-1.5 text-xs font-semibold"
            style={{ color: 'var(--accent-ink)', borderColor: 'var(--accent-ink)' }}
          >
            CV
          </span>{' '}
          came from your résumé — uncheck anything we got wrong.
        </p>
      )}

      {erro && (
        // Borda + texto, não só cor: o input ganha aria-invalid acima, e a
        // mensagem do servidor aparece por escrito aqui.
        <p role="alert" className="mt-3 text-sm" style={{ color: WARN_INK }}>
          {erro}
        </p>
      )}
    </section>
  )
}
