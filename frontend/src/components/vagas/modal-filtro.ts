/**
 * As categorias do modal de filtros avançados (JOB-41).
 *
 * **O vocabulário não mora aqui.** Os valores de cada seção vêm de
 * `POST /jobs/facets` a cada abertura — este arquivo diz apenas quais seções
 * existem, em que ordem, e como cada uma conversa com o `FiltrosDto`.
 *
 * Escrever os valores à mão seria repetir o erro que o catálogo de hoje já
 * tem: `vaga-filtro.ts` lista "Brazil" com a mesma aparência havendo 16.780
 * vagas ou zero. E o vocabulário é de outra pessoa — a API deles renomeia um
 * valor e a nossa lista fixa vira filtro que não filtra.
 */

/** Uma seção dentro de uma categoria: uma faceta da API, com rótulo. */
export interface SecaoFiltro {
  /** O nome da faceta em `/jobs/facets` (`countries`, `english_level`). */
  faceta: string
  /** O título da seção na tela. */
  titulo: string
  /** O campo do `FiltrosDto` que recebe os valores incluídos. */
  campo: string
  /**
   * O campo que recebe os EXCLUÍDOS.
   *
   * Ausente quando a faceta não tem exclusão do nosso lado — o chip então
   * cicla só `off → incluir → off`.
   */
  campoExcluir?: string
  /** A seção tem busca própria? Obrigatório nas de 1.200 valores. */
  buscavel?: boolean
}

export interface CategoriaFiltro {
  id: string
  /** O rótulo na coluna esquerda. */
  rotulo: string
  /** O agrupamento da coluna esquerda, como na referência. */
  grupo: 'ROLE' | 'PAY & BENEFITS' | 'REQUIREMENTS & ELIGIBILITY'
  secoes: SecaoFiltro[]
}

/**
 * As 11 categorias, na ordem da referência.
 *
 * `Role`, `Skills` e `Location` têm seções com 1.200 valores; por isso
 * `buscavel`. Sem a busca, a seção é uma lista de 40 chips que não representa
 * nada — o que a pessoa procura quase nunca está entre os 40 maiores.
 */
export const CATEGORIAS: CategoriaFiltro[] = [
  {
    id: 'role',
    rotulo: 'Role',
    grupo: 'ROLE',
    secoes: [
      {
        faceta: 'role',
        titulo: 'Role',
        campo: 'roles',
        campoExcluir: 'roles_exclude',
        buscavel: true,
      },
      {
        faceta: 'category',
        titulo: 'Specialization',
        campo: 'categories',
        campoExcluir: 'categories_exclude',
        buscavel: true,
      },
      { faceta: 'ai_archetype', titulo: 'AI focus', campo: 'ai_archetypes' },
    ],
  },
  {
    id: 'experience',
    rotulo: 'Experience',
    grupo: 'ROLE',
    secoes: [
      { faceta: 'seniority', titulo: 'Seniority', campo: 'seniorities' },
      { faceta: 'education_level', titulo: 'Education', campo: 'education_levels' },
    ],
  },
  {
    id: 'location',
    rotulo: 'Location',
    grupo: 'ROLE',
    secoes: [
      {
        faceta: 'regions',
        titulo: 'Region',
        campo: 'regions',
        campoExcluir: 'regions_exclude',
      },
      {
        faceta: 'countries',
        titulo: 'Country',
        campo: 'countries',
        campoExcluir: 'countries_exclude',
        buscavel: true,
      },
      { faceta: 'cities', titulo: 'City', campo: 'cities', buscavel: true },
    ],
  },
  {
    id: 'work',
    rotulo: 'Work & employment',
    grupo: 'ROLE',
    secoes: [
      {
        faceta: 'work_mode',
        titulo: 'Work mode',
        campo: 'work_modes',
        campoExcluir: 'work_mode_exclude',
      },
      { faceta: 'employment_type', titulo: 'Employment type', campo: 'employment_kinds' },
    ],
  },
  {
    id: 'skills',
    rotulo: 'Skills',
    grupo: 'ROLE',
    secoes: [
      {
        faceta: 'skills',
        titulo: 'Skills',
        campo: 'technologies',
        campoExcluir: 'skills_exclude',
        buscavel: true,
      },
    ],
  },
  {
    id: 'industry',
    rotulo: 'Industry & collection',
    grupo: 'ROLE',
    secoes: [
      { faceta: 'domains', titulo: 'Industry', campo: 'domains', buscavel: true },
      { faceta: 'collections', titulo: 'Collections', campo: 'collections' },
    ],
  },
  {
    id: 'company',
    rotulo: 'Company',
    grupo: 'ROLE',
    secoes: [
      {
        faceta: 'company_type',
        titulo: 'Company type',
        campo: 'company_types',
        campoExcluir: 'company_types_exclude',
      },
      { faceta: 'company_size', titulo: 'Company size', campo: 'company_sizes' },
      {
        faceta: 'source',
        titulo: 'Source',
        // **Tem campo de inclusão, ao contrário do que eu escrevi antes.**
        //
        // A ideia era "só faz sentido excluir uma fonte". Mas o ciclo começa
        // em incluir, então `campo: ''` fazia o primeiro clique não gravar
        // nada — chip inerte, o "filtro que não filtra" que o card proíbe
        // (QA, 26/08). Incluir uma fonte é um pedido legítimo de qualquer
        // forma: "só vagas do Greenhouse".
        campo: 'sources',
        campoExcluir: 'sources_exclude',
        buscavel: true,
      },
    ],
  },
  {
    id: 'salary',
    rotulo: 'Salary',
    grupo: 'PAY & BENEFITS',
    secoes: [{ faceta: 'salary_currency', titulo: 'Currency', campo: 'currencies' }],
  },
  {
    id: 'language',
    rotulo: 'Language',
    grupo: 'REQUIREMENTS & ELIGIBILITY',
    secoes: [
      { faceta: 'english_level', titulo: 'English level', campo: 'english_levels' },
      {
        faceta: 'posting_language',
        titulo: 'Posting language',
        campo: 'posting_languages',
        buscavel: true,
      },
    ],
  },
  {
    id: 'relocation',
    rotulo: 'Relocation',
    grupo: 'REQUIREMENTS & ELIGIBILITY',
    secoes: [
      { faceta: 'relocation', titulo: 'Relocation', campo: 'relocation' },
      { faceta: 'visa_sponsorship', titulo: 'Visa sponsorship', campo: 'visa_sponsorships' },
    ],
  },
  {
    id: 'posted',
    rotulo: 'Posted',
    grupo: 'REQUIREMENTS & ELIGIBILITY',
    secoes: [{ faceta: 'reality', titulo: 'Posting freshness', campo: 'reality' }],
  },
]

/**
 * Rótulos legíveis para os valores canônicos da API.
 *
 * **Só o que precisa.** `python` e `fintech` já se leem sozinhos; o que traduz
 * aqui é o que sairia feio (`ml_trainer_researcher`) ou ambíguo (`stale`).
 * Valor sem entrada aqui aparece com o underscore virando espaço — degradar
 * assim é melhor que esconder um valor que a API passou a devolver.
 */
/**
 * Rótulos que valem SÓ na faceta `regions`.
 *
 * **Separados dos gerais porque um mapa plano vaza entre facetas** (QA,
 * 26/08): `us: 'United States'`, criado para Region, também atendia a faceta
 * `countries` — e a lista de países mostrava "United States" ao lado de "GB",
 * "IN", "SG". Um país com nome e 39 com sigla.
 *
 * A faceta `regions` da API mistura região de verdade (`north_america`) com
 * código de país (`ru`, `kr`, `br`) — são 146 valores. Aqui ficam só os que
 * são região; os códigos de país caem no tratamento de país, logo abaixo.
 */
const ROTULOS_DE_REGIAO: Record<string, string> = {
  eu: 'Europe',
  uk: 'United Kingdom',
  apac: 'Asia-Pacific',
  latam: 'Latin America',
  mena: 'Middle East & North Africa',
  cis: 'CIS',
  emea: 'EMEA',
  africa: 'Africa',
  asia: 'Asia',
  americas: 'Americas',
  north_america: 'North America',
  south_america: 'South America',
  global: 'Worldwide',
}

const ROTULOS: Record<string, string> = {
  // reality
  fresh: 'Fresh',
  stale: 'Stale',
  'likely-evergreen': 'Always open',
  likely: 'Always open',
  // relocation
  not_supported: 'No relocation',
  supported: 'Relocation supported',
  required: 'Relocation required',
  // work_mode
  remote: 'Remote',
  hybrid: 'Hybrid',
  onsite: 'On-site',
  // employment_type
  full_time: 'Full-time',
  part_time: 'Part-time',
  contract: 'Contract',
  internship: 'Internship',
  fellowship: 'Fellowship',
  // seniority
  intern: 'Intern',
  junior: 'Junior',
  middle: 'Mid-level',
  senior: 'Senior',
  staff: 'Staff',
  lead: 'Lead',
  principal: 'Principal',
  c_level: 'C-level',
  // education
  none: 'No degree required',
  bachelor: "Bachelor's",
  master: "Master's",
  phd: 'PhD',
  // english_level
  native: 'Native',
  // company_type
  product: 'Product company',
  outsource: 'Outsourcing',
  inhouse: 'In-house',
  government: 'Government',
  startup: 'Startup',
  // collections
  yc: 'Y Combinator',
  unicorn: 'Unicorn',
  bigtech: 'Big Tech',
  fortune500: 'Fortune 500',
  'us-h1b-sponsor': 'H-1B sponsor',
  // visa
  true: 'Sponsors visa',
  false: 'No sponsorship',
  // is_tech
  tech: 'Tech',
  non_tech: 'Non-tech',
}

/**
 * Nome do país a partir do ISO-2, pelo próprio navegador.
 *
 * São **237 países** na faceta — escrevê-los à mão seria uma tabela grande e
 * desatualizada, e o `Intl.DisplayNames` já a tem. Fica em `en` fixo porque a
 * interface é em inglês; o idioma do navegador traduziria só metade da tela.
 *
 * Criado uma vez: instanciar por chip custaria caro numa lista de 40.
 */
const NOME_DE_PAIS = (() => {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' })
  } catch {
    // Navegador sem `Intl.DisplayNames`: cai no ISO-2 maiúsculo, que é
    // legível. Melhor que derrubar o modal por um rótulo.
    return null
  }
})()

/** É um código de país ISO-2? */
function pareceIso2(v: string): boolean {
  return /^[a-z]{2}$/.test(v)
}

/**
 * O rótulo legível de um valor canônico.
 *
 * **A faceta decide, e não só o valor** — ver a nota em `ROTULOS_DE_REGIAO`.
 */
export function rotularValor(faceta: string, valor: string): string {
  if (faceta === 'regions') {
    const regiao = ROTULOS_DE_REGIAO[valor]
    if (regiao) return regiao
    // A faceta `regions` também traz código de país (`br`, `kr`, `hk`).
    // Mostrá-los pelo nome evita o par confuso que o QA viu: `Brazil 12` e
    // `Br 47` na mesma lista, parecendo duplicata do mesmo valor.
    if (pareceIso2(valor)) return nomeDePais(valor)
  }
  if (faceta === 'countries') return pareceIso2(valor) ? nomeDePais(valor) : valor
  if (faceta === 'english_level') return valor.toUpperCase()

  const direto = ROTULOS[valor]
  if (direto) return direto
  // `ml_trainer_researcher` → `Ml Trainer Researcher`. Degradação honesta
  // para o valor que a API passou a devolver e que ninguém traduziu ainda.
  //
  // **Capitaliza cada palavra, e não só a primeira** (QA, 26/08): o fallback
  // produzia `South korea` ao lado de `South Korea` — o mesmo lugar por dois
  // caminhos, com caixa diferente, parecendo descuido em vez de dois valores
  // distintos da API.
  return valor
    .replace(/[_-]+/g, ' ')
    .trim()
    .split(' ')
    .filter((p) => p.length > 0)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ')
}

function nomeDePais(iso2: string): string {
  const maiusculo = iso2.toUpperCase()
  try {
    return NOME_DE_PAIS?.of(maiusculo) ?? maiusculo
  } catch {
    return maiusculo
  }
}
