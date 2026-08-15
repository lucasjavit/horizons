import type { Vaga } from '../../types/api'
import { bandeiraDe } from './vaga-formato'

/**
 * A filtragem da lista, **no cliente**, sobre o que já veio do `GET /jobs`.
 *
 * É no cliente de propósito: o backend não aceita parâmetro de busca nenhum, e
 * inventar `?q=` aqui só produziria um 400 — ou pior, um filtro ignorado em
 * silêncio. A lista tem teto de 200 vagas no backend, então filtrar em memória
 * é barato.
 *
 * Diferente da barra de pílulas anterior, a seleção aqui **não se aplica
 * sozinha**: os dropdowns editam um rascunho, e só o botão "Filtrar" o promove
 * a filtro valendo. É o que a captura do RemoteYeah faz, e o motivo é que com
 * oito dimensões a lista pularia embaixo do dedo a cada checkbox marcado.
 */

/** Os oito eixos da barra. Todos são seleção múltipla. */
export interface Selecao {
  cargos: string[]
  experiencias: string[]
  contratos: string[]
  skills: string[]
  beneficios: string[]
  paises: string[]
  formacoes: string[]
  /** Salário mínimo anual, como string do valor escolhido ("150000"). */
  salarios: string[]
}

export const SELECAO_VAZIA: Selecao = {
  cargos: [],
  experiencias: [],
  contratos: [],
  skills: [],
  beneficios: [],
  paises: [],
  formacoes: [],
  salarios: [],
}

/** As chaves em ordem de tela — a barra itera isto, não uma lista solta. */
export const EIXOS = [
  'cargos',
  'experiencias',
  'contratos',
  'skills',
  'beneficios',
  'paises',
  'formacoes',
  'salarios',
] as const

export type Eixo = (typeof EIXOS)[number]

export function temSelecao(s: Selecao): boolean {
  return EIXOS.some((eixo) => s[eixo].length > 0)
}

/** Quantos itens marcados no eixo — é o número do badge verde. */
export function contarEixo(s: Selecao, eixo: Eixo): number {
  return s[eixo].length
}

/**
 * Normaliza para comparar: sem caixa e **sem acento**.
 *
 * O acento importa de verdade aqui: metade das vagas escreve "São Paulo" e a
 * outra metade "Sao Paulo", e as duas precisam cair na mesma opção.
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

/** Uma opção de dropdown: o valor que filtra e o texto que a pessoa lê. */
export interface Opcao {
  valor: string
  rotulo: string
}

export type Opcoes = Record<Eixo, Opcao[]>

/**
 * Os degraus do salário mínimo.
 *
 * Fixos e não derivados do dado: "salário mínimo" é um filtro de limiar, e
 * limiar sai de número redondo que a pessoa reconhece — não do que por acaso
 * existe na lista de hoje. Derivar daria degraus como "US$ 137K".
 */
const DEGRAUS_SALARIO = [50_000, 80_000, 100_000, 120_000, 150_000, 200_000]

/**
 * As opções que existem *nesta* lista, para os dropdowns.
 *
 * Sai do dado carregado e não de uma constante escrita à mão: uma opção que não
 * filtra nada é ruído, e uma lista fixa envelheceria em silêncio conforme as
 * fontes mudam. O salário é a exceção acima.
 */
export function opcoesDe(vagas: Vaga[]): Opcoes {
  // Conta as ocorrências para ordenar por frequência: a skill que aparece em
  // 20 vagas é mais útil como filtro que a que aparece em uma. Guarda a
  // primeira grafia vista como rótulo, e agrupa pelo valor normalizado — senão
  // "Node.js" e "node.js" viram duas opções que filtram a mesma coisa.
  const conta = (valores: (string | null)[]): Opcao[] => {
    const mapa = new Map<string, { rotulo: string; n: number }>()
    for (const v of valores) {
      if (!v || !v.trim()) continue
      const chave = normalizar(v)
      const atual = mapa.get(chave)
      if (atual) atual.n += 1
      else mapa.set(chave, { rotulo: v.trim(), n: 1 })
    }
    return [...mapa.entries()]
      .sort((a, b) => b[1].n - a[1].n || a[1].rotulo.localeCompare(b[1].rotulo, 'pt-BR'))
      .map(([valor, { rotulo }]) => ({ valor, rotulo }))
  }

  // O país é o único eixo cujo rótulo não é o dado cru: filtra por ISO e
  // mostra bandeira + código, porque é o que a linha da lista também mostra.
  const paises = conta(vagas.map((v) => v.paisIso)).map(({ valor }) => {
    const bandeira = bandeiraDe(valor)
    return {
      valor,
      rotulo: bandeira ? `${bandeira} ${valor.toUpperCase()}` : valor.toUpperCase(),
    }
  })

  return {
    cargos: conta(vagas.map((v) => v.area)),
    experiencias: conta(vagas.map((v) => (v.anosExp == null ? null : String(v.anosExp))))
      // Experiência ordena por número, não por frequência: uma lista de anos
      // fora de ordem ("5, 2, 8") é ilegível como escala.
      .sort((a, b) => Number(a.valor) - Number(b.valor))
      .map(({ valor }) => ({
        valor,
        rotulo: valor === '1' ? '1 ano' : `${valor} anos`,
      })),
    contratos: conta(vagas.map((v) => v.regime)),
    skills: conta(vagas.flatMap((v) => v.skills)),
    beneficios: conta(vagas.flatMap((v) => v.benefits)),
    paises,
    formacoes: conta(vagas.map((v) => v.degree)),
    // Só os degraus que alguma vaga alcança: oferecer "US$ 200K" numa lista
    // cujo teto é 90K é oferecer um filtro que só sabe esvaziar a tela.
    salarios: DEGRAUS_SALARIO.filter((degrau) =>
      vagas.some((v) => (v.salaryMax ?? v.salaryMin ?? 0) >= degrau),
    ).map((degrau) => ({
      valor: String(degrau),
      rotulo: `${degrau / 1000}K+`,
    })),
  }
}

/**
 * Aplica a seleção.
 *
 * Dentro de um mesmo eixo a relação é **OU** (duas skills marcadas = vagas com
 * qualquer uma das duas); entre eixos diferentes é **E** (skill Java *e* país
 * US). É o que a pessoa espera de uma barra de filtros, e o contrário — E
 * dentro do mesmo eixo — esvaziaria a lista no segundo clique.
 *
 * Vaga sem o campo **não passa** quando o eixo está selecionado: quem filtra
 * por "Bacharelado" está pedindo as que exigem bacharelado, e a vaga que não
 * informou formação não é uma delas. Isso não contradiz "campo ausente
 * permanece ausente" — aquilo é sobre não inventar valor na exibição; aqui é
 * sobre não fingir que o ausente casa com o que a pessoa pediu.
 */
export function filtrar(vagas: Vaga[], selecao: Selecao): Vaga[] {
  const cargos = selecao.cargos.map(normalizar)
  const contratos = selecao.contratos.map(normalizar)
  const skills = selecao.skills.map(normalizar)
  const beneficios = selecao.beneficios.map(normalizar)
  const paises = selecao.paises.map(normalizar)
  const formacoes = selecao.formacoes.map(normalizar)
  const experiencias = selecao.experiencias.map(Number)
  // O menor degrau marcado é o que vale: marcar "100K+" e "150K+" pede quem
  // ganha pelo menos 100K, senão a segunda marca contradiria a primeira.
  const salarioMinimo = selecao.salarios.length
    ? Math.min(...selecao.salarios.map(Number))
    : null

  const casa = (marcados: string[], valor: string | null) =>
    marcados.length === 0 || (valor != null && marcados.includes(normalizar(valor)))

  return vagas.filter((v) => {
    if (!casa(cargos, v.area)) return false
    if (!casa(contratos, v.regime)) return false
    if (!casa(paises, v.paisIso)) return false
    if (!casa(formacoes, v.degree)) return false

    if (experiencias.length > 0) {
      if (v.anosExp == null || !experiencias.includes(v.anosExp)) return false
    }

    if (skills.length > 0) {
      const daVaga = v.skills.map(normalizar)
      if (!skills.some((s) => daVaga.includes(s))) return false
    }

    if (beneficios.length > 0) {
      const daVaga = v.benefits.map(normalizar)
      if (!beneficios.some((b) => daVaga.includes(b))) return false
    }

    if (salarioMinimo != null) {
      // O teto da vaga é o que se compara: uma faixa de 90K–160K atende quem
      // pede 150K+, e olhar só o piso a descartaria. Vaga sem salário
      // publicado sai — o filtro é sobre o que a vaga afirma pagar.
      const teto = v.salaryMax ?? v.salaryMin
      if (teto == null || teto < salarioMinimo) return false
    }

    return true
  })
}
