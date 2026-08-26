import type { FiltrosDto } from './job.dto';

/**
 * A traducao dos nossos filtros para a consulta do freehire.
 *
 * **Vive fora do motor de busca porque DOIS lugares precisam dela, e precisam
 * que seja a mesma.** O motor pede as vagas; o `FacetasService` pede as
 * contagens do modal (JOB-41). Se as duas consultas divergissem em um
 * parametro, o botao `Show 699 jobs` prometeria um numero que a lista nao
 * entrega — e o erro seria invisivel, porque os dois numeros parecem
 * plausiveis sozinhos.
 */

export const BASE_FREEHIRE =
  process.env.FREEHIRE_API_URL?.trim() || 'https://freehire.me';

/**
 * Quem somos, para quem opera o servico.
 *
 * O `llms.txt` deles pede `owner/project` e explica o porque: "it just means we
 * can warn you before a limit or a field changes instead of you meeting a 429
 * cold".
 */
export const UA_FREEHIRE = 'horizons/jobs (+https://github.com/lucas/horizons)';

/**
 * As regioes que a API conhece, e como o nosso filtro fala.
 *
 * O `llms.txt` avisa: "Call /api/v1/jobs/facets first for canonical values.
 * Never invent a value." Valor inventado nao da erro — e IGNORADO, e a busca
 * devolve o catalogo mundial parecendo resultado bom.
 */
const REGIOES: Record<string, string> = {
  latam: 'latam',
  'america latina': 'latam',
  europa: 'eu',
  europe: 'eu',
  eu: 'eu',
  us: 'us',
  eua: 'us',
  usa: 'us',
  apac: 'apac',
  asia: 'apac',
  global: 'global',
};

/** Como o nosso `remote` vira o `work_mode` deles. */
const REGIMES: Record<string, string> = {
  remoto: 'remote',
  remote: 'remote',
  hibrido: 'hybrid',
  hybrid: 'hybrid',
  presencial: 'onsite',
  onsite: 'onsite',
};

/** A nossa senioridade no vocabulario deles. */
const SENIORIDADES: Record<string, string> = {
  estagio: 'intern',
  junior: 'junior',
  pleno: 'middle',
  senior: 'senior',
  staff: 'staff',
  principal: 'principal',
};

/**
 * Cada eixo de lista, e o parametro que ele vira.
 *
 * Tabela em vez de vinte `if`: eixo novo e uma linha, e o `_exclude` sai de
 * graca — a spec deles garante que "**Every** string facet in this schema
 * supports its `_exclude` twin".
 */
const LISTAS: Array<[keyof FiltrosDto, string]> = [
  // Os eixos multi do modal (JOB-41). Vem ANTES dos escalares da barra de
  // proposito: quando os dois existem, o do modal e o mais especifico.
  ['regions', 'regions'],
  ['work_modes', 'work_mode'],
  ['seniorities', 'seniority'],
  ['currencies', 'salary_currency'],
  ['employment_kinds', 'employment_type'],
  ['visa_sponsorships', 'visa_sponsorship'],
  ['ai_archetypes', 'ai_archetype'],
  ['sources', 'source'],
  ['roles', 'role'],
  ['categories', 'category'],
  ['countries', 'countries'],
  ['cities', 'cities'],
  ['technologies', 'skills'],
  ['company_sizes', 'company_size'],
  ['company_types', 'company_type'],
  ['domains', 'domains'],
  ['collections', 'collections'],
  ['english_levels', 'english_level'],
  ['posting_languages', 'posting_language'],
  ['education_levels', 'education_level'],
  ['relocation', 'relocation'],
  ['reality', 'reality'],
  // `employment_types` (clt/pj/contractor/freelance) NAO entra: e vocabulario
  // de contrato brasileiro, e a faceta deles fala full_time/contract. Mandar
  // um pelo outro seria pedir um valor que a API ignora em silencio.
];

/** Os eixos de exclusao — o terceiro estado do chip. */
const EXCLUSOES: Array<[keyof FiltrosDto, string]> = [
  ['skills_exclude', 'skills_exclude'],
  ['countries_exclude', 'countries_exclude'],
  ['regions_exclude', 'regions_exclude'],
  ['work_mode_exclude', 'work_mode_exclude'],
  ['company_types_exclude', 'company_type_exclude'],
  ['sources_exclude', 'source_exclude'],
  ['roles_exclude', 'role_exclude'],
  ['categories_exclude', 'category_exclude'],
];

/**
 * Monta a query string do freehire a partir dos nossos filtros.
 *
 * O que NAO entra e tao importante quanto o que entra: parametro que nenhum
 * filtro le e descartado em SILENCIO, e a resposta volta com o catalogo
 * inteiro parecendo um resultado bom (medido em 26/08: `paisinventado=xx`
 * devolveu 1.358.310). Por isso todo nome aqui saiu do `openapi.yaml` deles, e
 * quem consome confere `meta.ignored_params`.
 */
export function paraConsultaFreehire(f: FiltrosDto): string {
  const p = new URLSearchParams();

  // Cargo e palavra-chave no mesmo `q`, que e full-text.
  const termos = [...(f.job_titles ?? []), ...(f.keywords ?? [])]
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
  if (termos.length > 0) p.set('q', termos.join(' '));

  // Os escalares da barra so entram quando o modal nao mandou o eixo: os dois
  // juntos seriam ANDed pela API, e "LATAM" da barra brigaria com "Europa" do
  // modal devolvendo zero. O mais especifico ganha.
  if (!f.regions?.length) {
    const regiao = f.regiao ? REGIOES[f.regiao.toLowerCase()] : undefined;
    if (regiao) p.append('regions', regiao);
  }
  if (!f.work_modes?.length) {
    const regime = f.remote ? REGIMES[f.remote.toLowerCase()] : undefined;
    if (regime) p.append('work_mode', regime);
  }
  if (!f.seniorities?.length) {
    const senioridade = f.seniority ? SENIORIDADES[f.seniority] : undefined;
    if (senioridade) p.append('seniority', senioridade);
  }

  // Repetido, e nao separado por virgula: `?seniority=senior&seniority=staff`
  // e o que a spec deles descreve, e os valores sao ORed dentro da faceta.
  for (const [nosso, deles] of LISTAS) {
    const valores = f[nosso];
    if (!Array.isArray(valores)) continue;
    for (const v of valores) {
      const t = String(v).trim();
      if (t) p.append(deles, t);
    }
  }

  for (const [nosso, deles] of EXCLUSOES) {
    const valores = f[nosso];
    if (!Array.isArray(valores)) continue;
    for (const v of valores) {
      const t = String(v).trim();
      if (t) p.append(deles, t);
    }
  }

  if (typeof f.salary_min === 'number') p.set('salary_min', String(f.salary_min));
  if (typeof f.salary_max === 'number') p.set('salary_max', String(f.salary_max));
  if (f.currency && !f.currencies?.length) p.set('salary_currency', f.currency);
  if (typeof f.posted_within_days === 'number') {
    p.set('posted_within_days', String(f.posted_within_days));
  }
  if (typeof f.experience_years_min === 'number') {
    p.set('experience_years_min', String(f.experience_years_min));
  }
  if (typeof f.experience_years_max === 'number') {
    p.set('experience_years_max', String(f.experience_years_max));
  }
  // `visa_sponsorship` e booleano na faceta, e a API o le como string.
  if (typeof f.visa_sponsorship === 'boolean' && !f.visa_sponsorships?.length) {
    p.set('visa_sponsorship', String(f.visa_sponsorship));
  }

  return p.toString();
}
