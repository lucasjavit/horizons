import { useEffect, useRef, useState } from 'react'
import { WARN_INK } from '../blocks/BlockRenderer'

/**
 * Um comando em bloco, com botão de copiar.
 *
 * **`navigator.clipboard` não existe fora de contexto seguro.** A página é
 * servida em `http://localhost` em desenvolvimento (seguro, por exceção do
 * navegador) mas em `http://` num IP da rede local ele é `undefined` — e um
 * botão que lança TypeError silencioso é pior que um botão ausente. Por isso a
 * queda para `document.execCommand('copy')`, obsoleto mas funcional em http, e
 * o estado de erro que aparece na tela quando os dois falham: o comando fica
 * selecionável de qualquer forma.
 */
export function BotaoDeCopiar({ texto, rotulo }: { texto: string; rotulo: string }) {
  const [estado, setEstado] = useState<'ocioso' | 'copiado' | 'erro'>('ocioso')
  const timer = useRef<number | null>(null)

  // Sem isto, copiar e desmontar (trocar de aba) deixaria o timeout escrevendo
  // num componente que já saiu.
  useEffect(() => {
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
    }
  }, [])

  const copiar = async () => {
    let ok = false
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(texto)
        ok = true
      }
    } catch {
      ok = false
    }

    if (!ok) ok = copiaDeReserva(texto)

    setEstado(ok ? 'copiado' : 'erro')
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setEstado('ocioso'), 2500)
  }

  return (
    <div
      className="mt-1.5 flex flex-wrap items-center gap-2 rounded-lg border p-2.5"
      style={{ borderColor: 'var(--border)', background: 'var(--surface-sunken)' }}
    >
      {/* O comando rola sozinho em vez de esticar a página em 390px. */}
      <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap text-[13px]">
        {texto}
      </code>
      <button
        type="button"
        onClick={copiar}
        aria-label={`Copy ${rotulo}`}
        className="min-h-8 shrink-0 rounded-md border px-2.5 text-xs font-semibold"
        style={{
          borderColor: estado === 'erro' ? WARN_INK : 'var(--border)',
          color: estado === 'erro' ? WARN_INK : 'var(--text)',
          background: 'var(--surface-raised)',
        }}
      >
        {estado === 'copiado' ? 'Copied' : estado === 'erro' ? 'Press Ctrl+C' : 'Copy'}
      </button>
      {/* O retorno também é anunciado: quem usa leitor de tela não vê o rótulo
          do botão mudar. */}
      <span role="status" className="sr-only">
        {estado === 'copiado'
          ? `${rotulo} copied`
          : estado === 'erro'
            ? `Could not copy ${rotulo}. Select the text and press Ctrl+C.`
            : ''}
      </span>
    </div>
  )
}

/** Fallback para http sem contexto seguro. Devolve se conseguiu. */
function copiaDeReserva(texto: string): boolean {
  try {
    const area = document.createElement('textarea')
    area.value = texto
    // Fora da tela, mas não `display:none` nem `hidden`: o execCommand exige
    // que o elemento esteja de fato selecionável.
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.top = '-1000px'
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(area)
    return ok
  } catch {
    return false
  }
}
