import { useCallback, useId, useState } from 'react'
import { WARN_INK } from '../blocks/BlockRenderer'
import { Envelope, descritoPor, estiloCampo } from './Field'

interface CampoFichasProps {
  id: string
  label: string
  valores: string[]
  onChange: (v: string[]) => void
  hint?: string
  placeholder?: string
  /** Teto do backend. Passar do limite é 400, então a tela barra antes. */
  maxItens: number
  /** Teto de caracteres por ficha, também do backend. */
  maxTamanho: number
  doCv?: boolean
}

/**
 * Lista de fichas (chips) com campo de texto.
 *
 * Controla cinco campos — `job_titles`, `technologies`, `locations`,
 * `keywords` e `exclude_keywords` —, o que é justamente o que justifica um
 * componente em vez de repetir a fiação cinco vezes.
 *
 * Os limites vêm do backend (`ArrayMaxSize` e `MaxLength` em `job.dto.ts`) e
 * são aplicados **aqui**, na entrada: deixar a pessoa digitar a 21ª tecnologia
 * e só descobrir no 400 ao salvar joga fora o formulário inteiro por um erro
 * que dava para avisar na hora.
 *
 * Acessibilidade, que é a maior parte do trabalho neste componente:
 *
 * - as fichas são uma `<ul>` de verdade, então o leitor anuncia "lista de 3";
 * - cada remoção é um `<button>` com o valor no `aria-label` — "Remover
 *   Node.js", não "Remover", que seria idêntico nos três botões;
 * - a região `aria-live="polite"` anuncia o que entrou e o que saiu, porque
 *   adicionar uma ficha não move o foco e sem isso a mudança é silenciosa;
 * - Backspace no campo vazio remove a última, que é o comportamento que quem
 *   usa teclado espera de um campo de fichas.
 */
export function CampoFichas({
  id,
  label,
  valores,
  onChange,
  hint,
  placeholder,
  maxItens,
  maxTamanho,
  doCv,
}: CampoFichasProps) {
  const [rascunho, setRascunho] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  // Anúncio para o leitor de tela, separado do erro: adicionar com sucesso
  // também precisa ser dito, e não é alerta.
  const [anuncio, setAnuncio] = useState('')
  const idLive = useId()

  const cheio = valores.length >= maxItens

  const adicionar = useCallback(
    (bruto: string) => {
      const texto = bruto.trim()
      if (!texto) return

      if (valores.length >= maxItens) {
        setErro(`Você chegou ao limite de ${maxItens} itens neste campo.`)
        return
      }
      if (texto.length > maxTamanho) {
        setErro(`Cada item pode ter até ${maxTamanho} caracteres. "${texto.slice(0, 20)}…" tem ${texto.length}.`)
        return
      }
      // Comparação sem caixa: "Node.js" e "node.js" são a mesma tecnologia, e
      // duplicata só ocuparia uma das vagas do limite à toa.
      if (valores.some((v) => v.toLowerCase() === texto.toLowerCase())) {
        setErro(`"${texto}" já está na lista.`)
        return
      }

      onChange([...valores, texto])
      setRascunho('')
      setErro(null)
      setAnuncio(`${texto} adicionado. ${valores.length + 1} de ${maxItens}.`)
    },
    [valores, onChange, maxItens, maxTamanho],
  )

  const remover = useCallback(
    (indice: number) => {
      const saiu = valores[indice]
      onChange(valores.filter((_, i) => i !== indice))
      setErro(null)
      setAnuncio(`${saiu} removido.`)
    },
    [valores, onChange],
  )

  return (
    <Envelope id={id} label={label} error={erro ?? undefined} hint={hint} doCv={doCv}>
      <div
        className="flex flex-wrap items-center gap-1.5 rounded-md border p-1.5"
        style={estiloCampo(erro ?? undefined, doCv)}
      >
        {valores.length > 0 && (
          <ul className="contents">
            {valores.map((valor, i) => (
              <li
                key={valor}
                className="flex items-center gap-1 rounded-full border py-0.5 pl-2.5 pr-1 text-sm"
                style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
              >
                <span>{valor}</span>
                <button
                  type="button"
                  onClick={() => remover(i)}
                  // O valor no nome acessível: sem ele, todos os botões da
                  // lista se anunciam igual e a pessoa não sabe qual remove o quê.
                  aria-label={`Remover ${valor}`}
                  // 24px de alvo, o mínimo da WCAG 2.5.8.
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-base leading-none"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <span aria-hidden>×</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <input
          id={id}
          type="text"
          value={rascunho}
          onChange={(e) => {
            setRascunho(e.target.value)
            if (erro) setErro(null)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              // Enter dentro de um formulário submeteria a página inteira.
              e.preventDefault()
              adicionar(rascunho)
              return
            }
            if (e.key === 'Backspace' && rascunho === '' && valores.length > 0) {
              remover(valores.length - 1)
            }
          }}
          // Sair do campo com texto digitado adiciona: sem isto, quem digita e
          // clica direto em "Salvar" perde o que escreveu, silenciosamente.
          onBlur={() => adicionar(rascunho)}
          placeholder={valores.length === 0 ? placeholder : ''}
          disabled={cheio}
          aria-invalid={erro ? true : undefined}
          aria-describedby={descritoPor(id, erro ?? undefined, hint, doCv)}
          className="min-w-[8rem] flex-1 bg-transparent px-1.5 py-1 text-sm outline-none disabled:cursor-not-allowed"
          style={{ color: 'var(--text)' }}
        />
      </div>

      {/* Fora da caixa e sempre no DOM: uma região live criada só na hora do
          anúncio costuma não ser lida, porque o leitor não a observava ainda. */}
      <p id={idLive} role="status" aria-live="polite" className="sr-only">
        {anuncio}
      </p>

      {cheio && !erro && (
        <p className="mt-1 text-xs" style={{ color: WARN_INK }}>
          Limite de {maxItens} itens atingido. Remova um para adicionar outro.
        </p>
      )}
    </Envelope>
  )
}
