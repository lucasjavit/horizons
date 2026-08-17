/**
 * Os filtros da busca.
 *
 * **Eles alimentam a busca, não peneiram a página.** O que a pessoa escolhe
 * aqui vira a consulta que sai para a web — não um crivo sobre uma lista já
 * carregada.
 *
 * A diferença não é sutil. Antes as opções eram derivadas das vagas em tela, o
 * que criava um círculo: só dava para filtrar por "Kotlin" se alguma vaga já
 * visível tivesse Kotlin. Um formulário de busca precisa do contrário —
 * oferecer o que se pode procurar, inclusive o que ainda não apareceu.
 */

export interface Opcao {
  valor: string
  rotulo: string
}

export type Eixo =
  | 'cargos'
  | 'experiencias'
  | 'contratos'
  | 'skills'
  | 'beneficios'
  | 'paises'
  | 'formacoes'
  | 'salarios'

export type Selecao = Record<Eixo, string[]>

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

/**
 * O catálogo de cada eixo — fixo, não derivado das vagas.
 *
 * Os valores de `experiencias` e `contratos` são exatamente os que o backend
 * aceita (`SENIORIDADES` e `CONTRATOS` em `job.dto.ts`): mandar outra coisa é
 * 400 do `ValidationPipe`, e o rótulo em inglês é só apresentação.
 */
export const CATALOGO: Record<Eixo, Opcao[]> = {
  cargos: [
    'Backend Engineer',
    'Frontend Engineer',
    'Full Stack Engineer',
    'Software Engineer',
    'Data Engineer',
    'DevOps Engineer',
    'Site Reliability Engineer',
    'Mobile Engineer',
    'Machine Learning Engineer',
    'QA Engineer',
    'Engineering Manager',
    'Tech Lead',
  ].map((v) => ({ valor: v, rotulo: v })),

  experiencias: [
    { valor: 'estagio', rotulo: 'Internship' },
    { valor: 'junior', rotulo: 'Junior' },
    { valor: 'pleno', rotulo: 'Mid-level' },
    { valor: 'senior', rotulo: 'Senior' },
    { valor: 'staff', rotulo: 'Staff' },
    { valor: 'principal', rotulo: 'Principal' },
  ],

  contratos: [
    { valor: 'clt', rotulo: 'Full-time' },
    { valor: 'pj', rotulo: 'Contractor (PJ)' },
    { valor: 'contractor', rotulo: 'Contract' },
    { valor: 'freelance', rotulo: 'Freelance' },
  ],

  skills: [
    'JavaScript', 'TypeScript', 'Python', 'Java', 'Kotlin', 'Go', 'Rust',
    'C#', '.NET', 'PHP', 'Ruby', 'Swift', 'Scala', 'Elixir',
    'React', 'Vue', 'Angular', 'Next.js', 'Node.js', 'Spring Boot', 'Django',
    'Rails', 'Laravel', 'FastAPI',
    'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Kafka', 'RabbitMQ',
    'AWS', 'GCP', 'Azure', 'Docker', 'Kubernetes', 'Terraform',
    'GraphQL', 'REST', 'gRPC', 'CI/CD',
  ].map((v) => ({ valor: v, rotulo: v })),

  beneficios: [
    'Remote work',
    'Health insurance',
    'Equity',
    'Learning budget',
    'Flexible hours',
    'Home office stipend',
    'Unlimited PTO',
    'Visa sponsorship',
  ].map((v) => ({ valor: v, rotulo: v })),

  // "Worldwide" e "LATAM" primeiro porque são o que interessa a quem procura
  // do Brasil: a vaga que aceita candidato de qualquer lugar, e a que abre a
  // região sem exigir mudança de país. Os dois não são lugares — são a
  // ausência de uma restrição e uma região inteira. `paraFiltrosApi` os
  // traduz; não viram `locations`.
  paises: [
    'Worldwide',
    'LATAM',
    'Brazil', 'United States', 'Canada', 'Portugal', 'Spain', 'Germany',
    'Netherlands', 'United Kingdom', 'Ireland', 'France', 'Poland',
    'Argentina', 'Mexico', 'Australia', 'Singapore',
  ].map((v) => ({ valor: v, rotulo: v })),

  formacoes: [
    { valor: "Bachelor's degree", rotulo: "Bachelor's degree" },
    { valor: "Master's degree", rotulo: "Master's degree" },
    { valor: 'PhD', rotulo: 'PhD' },
    { valor: 'No degree required', rotulo: 'No degree required' },
  ],

  salarios: [
    { valor: '60000', rotulo: '$60K+' },
    { valor: '80000', rotulo: '$80K+' },
    { valor: '100000', rotulo: '$100K+' },
    { valor: '120000', rotulo: '$120K+' },
    { valor: '150000', rotulo: '$150K+' },
    { valor: '200000', rotulo: '$200K+' },
  ],
}

export function temSelecao(s: Selecao): boolean {
  return Object.values(s).some((v) => v.length > 0)
}

/**
 * A seleção da tela traduzida para o corpo do `POST /jobs/search`.
 *
 * Os nomes mudam porque os dois lados falam línguas diferentes: a tela pensa em
 * "cargos" e "skills", e o backend usa os nomes que o prompt de busca espera
 * (`job_titles`, `technologies`). A tradução mora aqui, num lugar só.
 *
 * Campo vazio é **omitido**, nunca enviado como `[]`: o `ValidationPipe` do
 * backend rejeita o que não reconhece, e um array vazio não é um filtro — é a
 * ausência de um.
 */
export function paraFiltrosApi(s: Selecao): Record<string, unknown> {
  const f: Record<string, unknown> = {}
  if (s.cargos.length) f.job_titles = s.cargos
  if (s.skills.length) f.technologies = s.skills
  if (s.beneficios.length) f.keywords = s.beneficios
  if (s.formacoes.length) f.keywords = [...(f.keywords as string[] ?? []), ...s.formacoes]
  if (s.contratos.length) f.employment_types = s.contratos
  // Só um: o backend aceita uma senioridade, não uma lista.
  if (s.experiencias.length) f.seniority = s.experiencias[0]

  // Nem "Worldwide" nem "LATAM" são lugares, e mandá-los como `locations`
  // faria a busca procurar por um país com esse nome. "Worldwide" é a ausência
  // de restrição; "LATAM" é uma região, que o backend sabe expandir nos termos
  // que os anúncios de fato usam ("Latin America", "South America", "Americas
  // time zones") — a sigla sozinha acharia só quem a escreve com essas letras.
  const lugares = s.paises.filter((p) => p !== 'Worldwide' && p !== 'LATAM')
  if (lugares.length) f.locations = lugares
  if (s.paises.includes('Worldwide')) f.remote = 'remoto'
  if (s.paises.includes('LATAM')) f.regiao = 'latam'

  // O menor dos escolhidos: pedir "acima de 100k OU acima de 150k" é pedir
  // acima de 100k.
  if (s.salarios.length) {
    const menor = Math.min(...s.salarios.map(Number).filter(Number.isFinite))
    if (Number.isFinite(menor)) f.salary_min = menor
  }
  return f
}
