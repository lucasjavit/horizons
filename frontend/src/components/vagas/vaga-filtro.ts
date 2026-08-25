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

/**
 * Os eixos que a busca realmente aplica.
 *
 * **Filtro que não filtra é pior que filtro ausente**, porque a pessoa acredita
 * ter reduzido a lista. O QA mediu em 19/08: escolher "Degree: PhD" devolvia as
 * mesmas 644 vagas de não escolher nada.
 *
 * `contratos`, `beneficios` e `formacoes` saíram: as APIs de ATS devolvem
 * título e local, e nada disso está lá — benefício e formação vivem na
 * descrição, que só viria num request por vaga. Voltam quando houver de onde
 * ler (o motor de IA lê a descrição, mas hoje ele é o segundo motor).
 */
export type Eixo =
  | 'cargos'
  | 'experiencias'
  | 'skills'
  | 'paises'
  | 'portes'
  | 'origens'
  | 'idades'
  | 'salarios'

export type Selecao = Record<Eixo, string[]>

export const SELECAO_VAZIA: Selecao = {
  cargos: [],
  experiencias: [],
  skills: [],
  paises: [],
  portes: [],
  origens: [],
  idades: [],
  salarios: [],
}

/**
 * O catálogo de cada eixo — fixo, não derivado das vagas.
 *
 * Os valores de `experiencias` são exatamente os que o backend aceita
 * (`SENIORIDADES` em `job.dto.ts`): mandar outra coisa é 400 do
 * `ValidationPipe`, e o rótulo em inglês é só apresentação.
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


  skills: [
    'JavaScript', 'TypeScript', 'Python', 'Java', 'Kotlin', 'Go', 'Rust',
    'C#', '.NET', 'PHP', 'Ruby', 'Swift', 'Scala', 'Elixir',
    'React', 'Vue', 'Angular', 'Next.js', 'Node.js', 'Spring Boot', 'Django',
    'Rails', 'Laravel', 'FastAPI',
    'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Kafka', 'RabbitMQ',
    'AWS', 'GCP', 'Azure', 'Docker', 'Kubernetes', 'Terraform',
    'GraphQL', 'REST', 'gRPC', 'CI/CD',
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


  /**
   * Startup ou empresa grande — e a escolha que mais muda o resultado.
   *
   * Medido em 19/08: empresa da curadoria rende **1 vaga elegível em 1.961**;
   * startup dos slugs brutos rende **144 em 1.229**. A grande tem entidade
   * legal em cada país e contrata por país (a Adyen tem escritório em SP e 222
   * vagas para Amsterdam); a startup remote-first não tem entidade em lugar
   * nenhum e contrata de onde a pessoa estiver.
   */
  portes: [
    { valor: 'startup', rotulo: 'Startups (remote-first)' },
    { valor: 'grande', rotulo: 'Large companies' },
  ],

  /**
   * Quando a vaga foi publicada.
   *
   * Medido em 19/08: de 220 vagas, **58 tinham mais de seis meses** e havia
   * anúncio de 2021. Board de ATS não expira sozinho — a empresa precisa
   * arquivar, e muita não arquiva.
   */
  /**
   * Empresa do seu país contratando para fora.
   *
   * "Uma Stefanini que está oferecendo vagas para USA" — a empresa é daqui, o
   * cliente é de lá. **Promete cliente estrangeiro, não moeda forte:**
   * outsourcing brasileiro frequentemente contrata CLT ou PJ em real para
   * alocar em cliente americano, e só a descrição separa os dois casos.
   */
  origens: [
    { valor: 'BR', rotulo: 'Brazilian company, foreign client' },
    { valor: 'AR', rotulo: 'Argentine company, foreign client' },
    { valor: 'MX', rotulo: 'Mexican company, foreign client' },
    { valor: 'CO', rotulo: 'Colombian company, foreign client' },
    { valor: 'IN', rotulo: 'Indian company, foreign client' },
  ],

  idades: [
    { valor: '7', rotulo: 'Last 7 days' },
    { valor: '20', rotulo: 'Last 20 days' },
    { valor: '30', rotulo: 'Last 30 days' },
    { valor: '90', rotulo: 'Last 3 months' },
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

  // Um só: os dois marcados é o mesmo que nenhum — a busca já cobre ambos.
  if (s.portes.length === 1) f.porte = s.portes[0]

  // Um só: o backend cruza com uma sede por vez.
  if (s.origens.length === 1) f.sede_no_pais = s.origens[0]

  // O MAIOR dos escolhidos: marcar "7 dias" e "30 dias" é pedir os 30 — quem
  // quer as duas janelas quer a maior, e a menor já está contida nela.
  if (s.idades.length) {
    const maior = Math.max(...s.idades.map(Number).filter(Number.isFinite))
    if (Number.isFinite(maior)) f.posted_within_days = maior
  }

  // O menor dos escolhidos: pedir "acima de 100k OU acima de 150k" é pedir
  // acima de 100k.
  if (s.salarios.length) {
    const menor = Math.min(...s.salarios.map(Number).filter(Number.isFinite))
    if (Number.isFinite(menor)) f.salary_min = menor
  }
  return f
}

/**
 * O que o currículo preencheu, por eixo.
 *
 * Serve ao selo "from your CV": a barra precisa distinguir o que a pessoa
 * marcou do que a IA chutou, e para isso não basta saber os valores — é
 * preciso saber a ORIGEM de cada um. Um `Set` por eixo, e não um booleano por
 * dropdown, porque a pessoa acrescenta escolhas suas ao lado das da IA e o
 * selo tem de continuar contando só as dela.
 */
export type OrigemCv = Partial<Record<Eixo, ReadonlySet<string>>>

/**
 * Casa um texto livre do CV com uma opção do catálogo.
 *
 * A IA devolve "Spring Boot 3", "AWS (EC2, S3)" ou "postgres" — e o catálogo
 * tem `Spring Boot`, `AWS` e `PostgreSQL`. Comparar por igualdade perderia os
 * três, e a pessoa veria um upload que "não preencheu nada".
 *
 * A regra é conter, nos dois sentidos, sem caixa nem pontuação. **Casa só o
 * que o catálogo já oferece**: valor fora dele viraria um checkbox que não
 * existe, e o filtro simplesmente não sairia na busca.
 *
 * O piso de 2 caracteres evita que "Go" case dentro de "Django" e que "C#"
 * — depois de tirada a pontuação — case com qualquer coisa que tenha "c".
 */
function casar(texto: string, opcoes: Opcao[]): string | null {
  const limpo = normalizarTermo(texto)
  if (limpo.length < 2) return null

  // Igualdade primeiro: sem isto "React" casaria com "React" e com "React
  // Native" se ele existisse no catálogo, e o primeiro da lista venceria.
  const exato = opcoes.find((o) => normalizarTermo(o.valor) === limpo)
  if (exato) return exato.valor

  const parcial = opcoes.find((o) => {
    const alvo = normalizarTermo(o.valor)
    if (alvo.length < 2) return false
    return alvo.includes(limpo) || limpo.includes(alvo)
  })
  return parcial?.valor ?? null
}

/**
 * Minúsculas, sem acento e quase sem pontuação — "Node.js" e "nodejs" são o
 * mesmo termo.
 *
 * `+` e `#` sobrevivem porque são NOME, e não pontuação: sem eles "C#" vira
 * "c" e "C++" vira "c", os dois indistinguíveis entre si e curtos demais para
 * passar no piso de 2 caracteres do `casar` — medido, "C#" no CV não casava
 * com "C#" no catálogo.
 */
function normalizarTermo(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9+#]/g, '')
}

/**
 * O currículo lido vira seleção nos dropdowns.
 *
 * **Acrescenta, nunca substitui.** O que a pessoa já tinha marcado continua
 * marcado: ela pode ter subido o CV depois de escolher dois filtros à mão, e
 * apagar a escolha dela para pôr a da IA no lugar seria a inversão exata do
 * que o card pede.
 *
 * Devolve também a origem, para a barra saber o que veio do CV. Só entram os
 * valores que o `casar` reconheceu — o resto do CV fica de fora em silêncio,
 * porque um filtro que o backend não aceita é um 400 na cara da pessoa.
 */
export function aplicarCv(
  atual: Selecao,
  lido: { stack: string[]; senioridade: string | null; cargos?: string[] },
): { selecao: Selecao; origem: OrigemCv } {
  const selecao: Selecao = { ...atual }
  const origem: OrigemCv = {}

  const juntar = (eixo: Eixo, valores: string[]) => {
    const novos = valores.filter((v) => !atual[eixo].includes(v))
    if (!novos.length) return
    selecao[eixo] = [...atual[eixo], ...novos]
    origem[eixo] = new Set(novos)
  }

  const skills = [
    ...new Set(
      lido.stack.map((s) => casar(s, CATALOGO.skills)).filter((v): v is string => v !== null),
    ),
  ]
  juntar('skills', skills)

  const cargos = [
    ...new Set(
      (lido.cargos ?? [])
        .map((c) => casar(c, CATALOGO.cargos))
        .filter((v): v is string => v !== null),
    ),
  ]
  juntar('cargos', cargos)

  // A senioridade vem do backend já no vocabulário do catálogo (`SENIORIDADES`
  // é a mesma lista dos dois lados), então aqui é conferir que existe — e não
  // casar por texto.
  if (lido.senioridade) {
    const existe = CATALOGO.experiencias.some((o) => o.valor === lido.senioridade)
    if (existe) juntar('experiencias', [lido.senioridade])
  }

  return { selecao, origem }
}
