import type { Vaga } from '../../types/api'

/**
 * As traduções de dado cru para texto de tela, isoladas do JSX.
 *
 * Ficam separadas porque são a parte com regra de verdade — "não informado"
 * nunca pode virar um número, e a idade da vaga não pode arredondar para o dia
 * errado. Função pura é o que se consegue conferir sem abrir o navegador.
 */

/** O rótulo único para todo campo ausente. Uma frase só, sempre a mesma. */
export const NAO_INFORMADO = 'não informado'

/**
 * O salário como o anúncio publicou, ou `null` quando não publicou.
 *
 * Devolver `null` e não a string "não informado" é de propósito: quem chama
 * precisa poder dar **tipografia diferente** para o ausente, e uma string
 * pronta apagaria essa distinção logo no primeiro uso.
 *
 * Sem moeda não há salário legível — "120k" sem saber se é dólar ou real não
 * responde a pergunta que o card quer responder, então vira ausente também.
 */
export function formatarSalario(vaga: Vaga): string | null {
  const { salaryMin, salaryMax, currency } = vaga
  if (!currency) return null
  if (salaryMin == null && salaryMax == null) return null

  const n = (v: number) => {
    // 140000 vira "140k"; 95500 vira "95,5k". Milhar cheio é como o anúncio
    // escreve, e a fração só aparece quando existe de fato.
    if (v >= 1000) {
      const mil = v / 1000
      const texto = Number.isInteger(mil)
        ? String(mil)
        : mil.toFixed(1).replace('.', ',')
      return `${texto}k`
    }
    return String(v)
  }

  if (salaryMin != null && salaryMax != null) {
    // Faixa degenerada ("80k–80k") é um valor só, não uma faixa.
    if (salaryMin === salaryMax) return `${currency} ${n(salaryMin)}`
    return `${currency} ${n(salaryMin)}–${n(salaryMax)}`
  }
  if (salaryMin != null) return `${currency} a partir de ${n(salaryMin)}`
  return `${currency} até ${n(salaryMax as number)}`
}

/** O regime como texto de tela. Ausente continua ausente. */
export function formatarRegime(regime: string | null): string | null {
  if (!regime) return null
  const mapa: Record<string, string> = {
    remoto: 'Remoto',
    hibrido: 'Híbrido',
    presencial: 'Presencial',
  }
  return mapa[regime.toLowerCase()] ?? regime
}

/**
 * A idade da vaga: "hoje", "há 3d", "há 14d".
 *
 * `null` quando o anúncio não trouxe data — e ausência de data **não** vira
 * "hoje", que faria vaga velha parecer nova. É o oposto do que o card pede.
 *
 * Conta por dia de calendário, não por múltiplo de 24h: uma vaga publicada
 * ontem às 23h tem 2h de idade, e dizer "hoje" contradiz a data que a pessoa
 * vê no anúncio.
 *
 * O calendário é o **local**, o mesmo que a pessoa lê no relógio. Misturar as
 * bases aqui é fácil e silencioso: `Date.UTC(d.getFullYear(), …)` monta um
 * instante UTC a partir das partes locais, e num fuso a oeste isso jogava uma
 * vaga de hoje 01:00Z para "ontem".
 */
export function idadeEmDias(postedAt: string | null, agora = new Date()): number | null {
  if (!postedAt) return null
  const data = new Date(postedAt)
  if (Number.isNaN(data.getTime())) return null

  // Meia-noite local dos dois lados: a subtração passa a ser de dias inteiros.
  const dia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  // `Math.round` e não `floor`: o horário de verão faz um dia ter 23h ou 25h, e
  // `floor` transformaria essa hora a menos num dia a menos.
  const dias = Math.round((dia(agora) - dia(data)) / 86_400_000)
  // Data no futuro é dado ruim da origem; trata como hoje em vez de "há -2d".
  return dias < 0 ? 0 : dias
}

/** O texto curto do selo de idade. */
export function formatarIdade(postedAt: string | null, agora = new Date()): string | null {
  const dias = idadeEmDias(postedAt, agora)
  if (dias === null) return null
  if (dias === 0) return 'hoje'
  if (dias === 1) return 'ontem'
  return `há ${dias}d`
}

/**
 * A elegibilidade em uma frase.
 *
 * Os três estados são distintos de propósito: `true`, `false` e "o anúncio não
 * disse" são respostas diferentes, e colapsar o `null` em "não contrata" seria
 * inventar uma negativa que ninguém afirmou.
 */
export function formatarElegibilidade(elegivel: boolean | null): string | null {
  if (elegivel === null) return null
  return elegivel ? 'Contrata no Brasil' : 'Não contrata do Brasil'
}

/** O domínio da fonte, sem `www.` — é o que cabe no cartão. */
export function formatarFonte(fonte: string | null): string | null {
  if (!fonte) return null
  return fonte.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '')
}
