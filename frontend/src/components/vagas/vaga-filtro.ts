import type { Vaga } from '../../types/api'
import { formatarFonte, formatarRegime } from './vaga-formato'

/**
 * A filtragem da lista, **no cliente**, sobre o que já veio do `GET /jobs`.
 *
 * É no cliente de propósito: o backend não aceita parâmetro de busca nenhum, e
 * inventar `?q=` aqui só produziria um 400 — ou pior, um filtro ignorado em
 * silêncio. A lista tem teto de 200 vagas no backend, então filtrar em memória
 * é barato e responde a cada tecla.
 */

export interface Selecao {
  /** O texto da barra de busca. Casa com título e empresa. */
  busca: string
  skills: string[]
  locais: string[]
  fontes: string[]
  regimes: string[]
}

export const SELECAO_VAZIA: Selecao = {
  busca: '',
  skills: [],
  locais: [],
  fontes: [],
  regimes: [],
}

export function temSelecao(s: Selecao): boolean {
  return (
    s.busca.trim() !== '' ||
    s.skills.length > 0 ||
    s.locais.length > 0 ||
    s.fontes.length > 0 ||
    s.regimes.length > 0
  )
}

/**
 * Normaliza para comparar: sem caixa e **sem acento**.
 *
 * O acento importa de verdade aqui: metade das vagas escreve "São Paulo" e a
 * outra metade "Sao Paulo", e quem digita "sao" espera achar as duas.
 */
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    // ̀-ͯ é o bloco dos diacríticos que o NFD separou da letra.
    // Escrito com escape de propósito: o mesmo intervalo em caracteres
    // literais é invisível no editor e some no primeiro copiar e colar.
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

/**
 * As opções que existem *nesta* lista, para as pílulas de filtro.
 *
 * Sai do dado carregado e não de uma constante escrita à mão: uma pílula que
 * não filtra nada é ruído, e uma lista fixa envelheceria em silêncio conforme
 * as fontes mudam.
 */
export interface Opcoes {
  skills: string[]
  locais: string[]
  fontes: string[]
  regimes: string[]
}

export function opcoesDe(vagas: Vaga[]): Opcoes {
  // Conta as ocorrências para ordenar por frequência: a skill que aparece em
  // 20 vagas é mais útil como filtro que a que aparece em uma.
  const conta = (valores: (string | null)[]) => {
    const mapa = new Map<string, number>()
    for (const v of valores) {
      if (!v) continue
      mapa.set(v, (mapa.get(v) ?? 0) + 1)
    }
    return [...mapa.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'))
      .map(([valor]) => valor)
  }

  return {
    skills: conta(vagas.flatMap((v) => v.skills)),
    locais: conta(vagas.map((v) => v.local)),
    fontes: conta(vagas.map((v) => formatarFonte(v.fonte))),
    regimes: conta(vagas.map((v) => formatarRegime(v.regime))),
  }
}

/**
 * Aplica a seleção.
 *
 * Dentro de um mesmo filtro a relação é **OU** (duas skills marcadas = vagas
 * com qualquer uma das duas); entre filtros diferentes é **E** (skill React
 * *e* fonte linkedin). É o que a pessoa espera de uma lista de pílulas, e o
 * contrário — E dentro do mesmo grupo — esvaziaria a lista no segundo clique.
 */
export function filtrar(vagas: Vaga[], selecao: Selecao): Vaga[] {
  const busca = normalizar(selecao.busca)
  const skills = selecao.skills.map(normalizar)
  const locais = selecao.locais.map(normalizar)
  const fontes = selecao.fontes.map(normalizar)
  const regimes = selecao.regimes.map(normalizar)

  return vagas.filter((v) => {
    if (busca) {
      const alvo = `${normalizar(v.title)} ${normalizar(v.company)}`
      if (!alvo.includes(busca)) return false
    }

    if (skills.length > 0) {
      const daVaga = v.skills.map(normalizar)
      if (!skills.some((s) => daVaga.includes(s))) return false
    }

    if (locais.length > 0) {
      const local = v.local ? normalizar(v.local) : null
      if (!local || !locais.includes(local)) return false
    }

    if (fontes.length > 0) {
      const fonte = formatarFonte(v.fonte)
      if (!fonte || !fontes.includes(normalizar(fonte))) return false
    }

    if (regimes.length > 0) {
      const regime = formatarRegime(v.regime)
      if (!regime || !regimes.includes(normalizar(regime))) return false
    }

    return true
  })
}
