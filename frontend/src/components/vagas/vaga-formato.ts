import type { Vaga } from '../../types/api'

/**
 * As traduções de dado cru para texto de tela, isoladas do JSX.
 *
 * Ficam separadas porque são a parte com regra de verdade — **ausente precisa
 * continuar ausente** (toda função aqui devolve `null`, nunca um rótulo de
 * preenchimento), e a idade não pode arredondar para o lado errado. Função pura
 * é o que se consegue conferir sem abrir o navegador, e é o que os testes em
 * `scratchpad/t-fmt2.ts` cobrem.
 */

/**
 * A idade solta no topo da linha: "há 15 horas", "há 1 dia", "há 3 meses".
 *
 * Diferente de `formatarIdade`, que conta só em dias de calendário e serve ao
 * selo curto. Aqui a lista precisa da granularidade de **hora** — é o que
 * distingue a vaga publicada agora da de ontem, e é a informação que a pessoa
 * usa para decidir se vale abrir. Uma vaga de 3h aparecendo como "hoje" perde
 * exatamente o que a torna interessante.
 *
 * Continua devolvendo `null` sem data: ausência não vira "agora", que faria
 * vaga velha parecer nova.
 */
export function formatarIdadeRelativa(
  postedAt: string | null,
  agora = new Date(),
): string | null {
  if (!postedAt) return null
  const data = new Date(postedAt)
  if (Number.isNaN(data.getTime())) return null

  // Data no futuro é dado ruim da origem; trata como agora, nunca "há -2 horas".
  const ms = Math.max(0, agora.getTime() - data.getTime())
  const minutos = Math.floor(ms / 60_000)

  if (minutos < 60) return 'just now'

  const horas = Math.floor(minutos / 60)
  if (horas < 24) return horas === 1 ? '1 hour ago' : `${horas} hours ago`

  const dias = Math.floor(horas / 24)
  if (dias < 30) return dias === 1 ? '1 day ago' : `${dias} days ago`

  const meses = Math.floor(dias / 30)
  if (meses < 12) return meses === 1 ? '1 month ago' : `${meses} months ago`

  const anos = Math.floor(meses / 12)
  return anos === 1 ? '1 year ago' : `${anos} years ago`
}

/**
 * O salário do chip verde, no formato do anúncio: "US$ 150K—200K / year".
 *
 * Devolve `null` quando não há salário publicado — e o chip simplesmente não
 * aparece. **Nunca "a combinar"**: inventar o rótulo de ausente dá à vaga sem
 * salário a mesma presença visual da que publicou, que é o oposto do que a
 * faixa de chips existe para mostrar.
 *
 * Sem moeda também é ausente: "150K" sem saber se é dólar ou real não responde
 * a pergunta que o chip faz.
 */
export function formatarFaixaSalarial(vaga: Vaga): string | null {
  const { salaryMin, salaryMax, currency } = vaga
  if (!currency) return null
  if (salaryMin == null && salaryMax == null) return null

  // 150000 vira "150K"; 95500 vira "95,5K". Milhar cheio é como o anúncio
  // escreve, e a fração só aparece quando existe de fato.
  const n = (v: number) => {
    if (v >= 1000) {
      const mil = v / 1000
      const texto = Number.isInteger(mil) ? String(mil) : mil.toFixed(1).replace('.', ',')
      return `${texto}K`
    }
    return String(v)
  }

  const sufixo = ' / year'
  if (salaryMin != null && salaryMax != null) {
    // Faixa degenerada ("150K—150K") é um valor só, não uma faixa.
    if (salaryMin === salaryMax) return `${currency} ${n(salaryMin)}${sufixo}`
    return `${currency} ${n(salaryMin)}—${n(salaryMax)}${sufixo}`
  }
  if (salaryMin != null) return `${currency} a partir de ${n(salaryMin)}${sufixo}`
  return `${currency} até ${n(salaryMax as number)}${sufixo}`
}

/**
 * As iniciais da empresa para o círculo, quando não há `logoUrl`.
 *
 * Até duas letras, das duas primeiras palavras. Descarta o que não é letra ou
 * dígito antes de escolher — "(Remote) Co" deve dar "RC", não "(R".
 */
export function iniciaisDe(empresa: string): string {
  const palavras = empresa
    .split(/[\s\-_/]+/)
    .map((p) => p.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(Boolean)

  if (palavras.length === 0) return '?'
  if (palavras.length === 1) return palavras[0].slice(0, 2).toUpperCase()
  return (palavras[0][0] + palavras[1][0]).toUpperCase()
}

/**
 * A bandeirinha do país a partir do ISO-3166 alpha-2.
 *
 * Os *regional indicator symbols* ficam 127.397 posições acima de 'A' em
 * Unicode, então somar o deslocamento a cada letra dá o par que o sistema
 * renderiza como bandeira. Não há tabela para manter, e país novo funciona
 * sozinho.
 *
 * Devolve `null` para qualquer coisa que não sejam duas letras — código
 * inválido viraria dois quadrados vazios na tela, pior que nada.
 */
export function bandeiraDe(paisIso: string | null): string | null {
  if (!paisIso) return null
  const iso = paisIso.trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(iso)) return null
  return String.fromCodePoint(
    ...[...iso].map((c) => 127_397 + (c.codePointAt(0) as number)),
  )
}

/** "Exp: 5 anos" — e nada quando o anúncio não pediu experiência. */
export function formatarExperiencia(anosExp: number | null): string | null {
  if (anosExp == null) return null
  return anosExp === 1 ? 'Exp: 1 year' : `Exp: ${anosExp} years`
}
