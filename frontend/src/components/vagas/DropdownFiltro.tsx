import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { Opcao } from './vaga-filtro'

/**
 * Um dropdown de seleção múltipla com checkbox dentro.
 *
 * **Não é `<select multiple>`** de propósito: o nativo não aceita o contador
 * verde no botão, exige Ctrl+clique para marcar mais de um (que ninguém
 * descobre sozinho) e no celular vira uma tela cheia do sistema. O preço é
 * reimplementar teclado e foco, que é o que este arquivo faz.
 *
 * Acessibilidade — o contrato completo:
 * - o botão é `aria-haspopup="listbox"` + `aria-expanded`, e o painel é
 *   rotulado pelo botão;
 * - Esc fecha e **devolve o foco ao botão** (senão o foco cai no `body` e a
 *   navegação por teclado recomeça do topo da página);
 * - clique fora fecha, sem devolver o foco — ali o ponteiro já decidiu para
 *   onde ir, e roubar o foco seria mais surpreendente que útil;
 * - o painel é uma lista de checkbox de verdade, então leitor de tela anuncia
 *   "marcado"/"não marcado" sem `aria-*` extra;
 * - Tab para fora fecha, para o painel não ficar aberto pendurado sobre a
 *   lista enquanto o foco já está em outro filtro.
 */
export function DropdownFiltro({
  rotulo,
  opcoes,
  marcados,
  onChange,
}: {
  rotulo: string
  opcoes: Opcao[]
  marcados: string[]
  onChange: (valores: string[]) => void
}) {
  const [aberto, setAberto] = useState(false)
  const raiz = useRef<HTMLDivElement>(null)
  const botao = useRef<HTMLButtonElement>(null)
  const painel = useRef<HTMLDivElement>(null)
  const idPainel = useId()

  const fechar = useCallback((devolverFoco: boolean) => {
    setAberto(false)
    if (devolverFoco) botao.current?.focus()
  }, [])

  // Clique fora e Esc. Um efeito só: os dois só existem enquanto está aberto, e
  // registrar os ouvintes sempre custaria em toda linha da lista.
  useEffect(() => {
    if (!aberto) return

    const aoClicar = (e: MouseEvent) => {
      if (!raiz.current?.contains(e.target as Node)) fechar(false)
    }
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // O stopPropagation evita que a mesma tecla feche algo acima (um
        // modal, um menu) junto com este painel.
        e.stopPropagation()
        fechar(true)
      }
    }

    // `mousedown` e não `click`: com `click` o painel só fecharia depois que o
    // alvo já recebeu o evento, e clicar no botão de outro filtro abriria o
    // segundo e fecharia em seguida — os dois acabavam fechados.
    document.addEventListener('mousedown', aoClicar)
    document.addEventListener('keydown', aoTeclar)
    return () => {
      document.removeEventListener('mousedown', aoClicar)
      document.removeEventListener('keydown', aoTeclar)
    }
  }, [aberto, fechar])

  // Tab para fora fecha. `focusout` com `relatedTarget` porque é o único jeito
  // de distinguir "foco saiu do componente" de "foco andou entre os checkbox".
  const aoSairOFoco = useCallback(
    (e: React.FocusEvent<HTMLDivElement>) => {
      const indo = e.relatedTarget as Node | null
      if (indo && raiz.current?.contains(indo)) return
      setAberto(false)
    },
    [],
  )

  const alternar = useCallback(
    (valor: string) => {
      onChange(
        marcados.includes(valor)
          ? marcados.filter((v) => v !== valor)
          : [...marcados, valor],
      )
    },
    [marcados, onChange],
  )

  // Sem opção o dropdown fica DESABILITADO, não some. Sumir funcionava quando
  // havia alguma vaga; com o acervo vazio some a barra inteira, e quem chega
  // vê um aviso e nada mais — sem entender que a página é de busca. O botão
  // presente e apagado diz "existe este filtro, e ainda não há o que filtrar".
  const vazio = opcoes.length === 0
  const n = marcados.length

  return (
    <div ref={raiz} className="relative" onBlur={aoSairOFoco}>
      <button
        ref={botao}
        type="button"
        onClick={() => setAberto((a) => !a)}
        disabled={vazio}
        aria-expanded={aberto}
        aria-haspopup="listbox"
        aria-controls={aberto ? idPainel : undefined}
        className="flex min-h-9 w-full items-center justify-between gap-2 rounded-md border px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
        style={{
          borderColor: n > 0 ? 'var(--brand)' : 'var(--border)',
          background: 'var(--surface)',
          color: 'var(--text)',
        }}
      >
        <span className="truncate">{rotulo}</span>
        <span className="flex shrink-0 items-center gap-1.5">
          {n > 0 && (
            // O contador verde do RemoteYeah — aqui o verde da marca, que já é
            // verde e já tem o par de texto medido: 6,15:1 no claro e 5,99:1
            // no escuro. Inventar um `--success` só para este badge ampliaria
            // o sistema de cor sem ganhar contraste nenhum.
            <span
              className="inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold leading-5"
              style={{ background: 'var(--brand)', color: 'var(--brand-text)' }}
            >
              {n}
            </span>
          )}
          <span aria-hidden style={{ color: 'var(--text-muted)' }}>
            {aberto ? '▴' : '▾'}
          </span>
        </span>
      </button>

      {aberto && (
        <div
          ref={painel}
          id={idPainel}
          role="listbox"
          aria-multiselectable
          aria-label={rotulo}
          // `max-h` + rolagem: "Skills" numa lista real passa de 40 opções, e
          // um painel de 40 itens sai da janela e leva o botão junto.
          className="absolute left-0 z-20 mt-1 max-h-72 w-64 max-w-[min(16rem,calc(100vw-2rem))] overflow-y-auto rounded-md border p-1 shadow-lg"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}
        >
          {opcoes.map((o) => {
            const marcado = marcados.includes(o.valor)
            return (
              <label
                key={o.valor}
                className="flex min-h-8 cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm"
                style={{ color: 'var(--text)' }}
              >
                <input
                  type="checkbox"
                  checked={marcado}
                  onChange={() => alternar(o.valor)}
                  className="h-4 w-4 shrink-0"
                  style={{ accentColor: 'var(--brand)' }}
                />
                <span className="min-w-0 break-words">{o.rotulo}</span>
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}
