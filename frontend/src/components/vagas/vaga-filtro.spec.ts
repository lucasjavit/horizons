import { describe, it, expect } from 'vitest'
import {
  aplicarCv,
  paraFiltrosApi,
  temSelecao,
  SELECAO_VAZIA,
  CATALOGO,
} from './vaga-filtro'
import type { Selecao } from './vaga-filtro'

/**
 * O casamento do CV com o catalogo, cobrado pela porta da frente.
 *
 * `casar()` nao e exportado — e detalhe de `aplicarCv`, que e o contrato de
 * verdade: "o curriculo lido vira selecao nos dropdowns". Os testes entram por
 * ali, entao continuam valendo se a funcao interna for reescrita.
 *
 * As regras vem do card e dos comentarios de decisao, nao da implementacao:
 *
 * - **"C#" tem de casar consigo mesmo** — ja quebrou: tirada a pontuacao,
 *   "C#" virava "c", curto demais para o piso de 2 caracteres;
 * - **acrescenta, nunca substitui**: quem marcou filtro a mao nao perde a
 *   escolha ao subir o CV;
 * - **so entra o que o catalogo oferece**, senao viraria um checkbox que nao
 *   existe e um 400 do ValidationPipe.
 */

function vazia(): Selecao {
  // Copia nova a cada teste: nenhum teste herda o que outro selecionou.
  return { ...SELECAO_VAZIA, ...Object.fromEntries(
    Object.keys(SELECAO_VAZIA).map((k) => [k, []]),
  ) } as Selecao
}

function skillsDoCv(...stack: string[]): string[] {
  return aplicarCv(vazia(), { stack, senioridade: null }).selecao.skills
}

describe('aplicarCv — o bug do "C#" (e a familia dele)', () => {
  it('"C#" casa com "C#" do catalogo', () => {
    // O bug medido: sem o # a normalizacao dava "c", que nao passa no piso de
    // 2 caracteres, e a skill sumia do CV silenciosamente.
    expect(skillsDoCv('C#')).toEqual(['C#'])
  })

  it('"c#" em minuscula tambem casa', () => {
    expect(skillsDoCv('c#')).toEqual(['C#'])
  })

  it('"C#" nao vira ".NET" nem outra coisa parecida', () => {
    // Se o # sumisse, "c" casaria por "contem" com quase tudo.
    expect(skillsDoCv('C#')).not.toContain('.NET')
  })

  it('".NET" casa consigo mesmo, apesar do ponto', () => {
    expect(skillsDoCv('.NET')).toEqual(['.NET'])
  })

  it('"Node.js" e "nodejs" sao o mesmo termo', () => {
    expect(skillsDoCv('Node.js')).toEqual(['Node.js'])
    expect(skillsDoCv('nodejs')).toEqual(['Node.js'])
    expect(skillsDoCv('NODE.JS')).toEqual(['Node.js'])
  })

  it('"CI/CD" casa apesar da barra', () => {
    expect(skillsDoCv('CI/CD')).toEqual(['CI/CD'])
  })

  it('"Next.js" casa', () => {
    expect(skillsDoCv('Next.js')).toEqual(['Next.js'])
  })
})

describe('aplicarCv — o piso de 2 caracteres', () => {
  it('"Go" casa com "Go", e NAO com "Django"', () => {
    // O comentario do codigo cita exatamente este par.
    expect(skillsDoCv('Go')).toEqual(['Go'])
  })

  it('termo de 1 caractere nao casa com nada', () => {
    // Sem o piso, "c" casaria com C#, .NET, Scala, React...
    expect(skillsDoCv('c')).toEqual([])
    expect(skillsDoCv('a')).toEqual([])
  })

  it('termo vazio nao casa com nada', () => {
    expect(skillsDoCv('')).toEqual([])
    expect(skillsDoCv('   ')).toEqual([])
  })
})

describe('aplicarCv — o texto livre que a IA devolve', () => {
  it.each([
    ['Spring Boot 3', 'Spring Boot'],
    ['AWS (EC2, S3)', 'AWS'],
    ['postgres', 'PostgreSQL'],
    ['PostgreSQL 15', 'PostgreSQL'],
    ['React.js', 'React'],
  ])('%s casa com %s', (doCv, esperado) => {
    // A IA devolve texto livre; comparar por igualdade perderia todos estes, e
    // a pessoa veria um upload que "nao preencheu nada".
    expect(skillsDoCv(doCv)).toContain(esperado)
  })

  it('a igualdade vem antes do parcial', () => {
    // Sem isso o primeiro da lista que "contem" venceria o casamento exato.
    expect(skillsDoCv('React')).toEqual(['React'])
  })

  it('o que nao esta no catalogo fica de fora, em silencio', () => {
    // Valor fora do catalogo viraria checkbox inexistente e 400 no backend.
    expect(skillsDoCv('COBOL')).toEqual([])
    expect(skillsDoCv('Fortran')).toEqual([])
  })

  it('nao repete a skill quando o CV cita duas variacoes dela', () => {
    expect(skillsDoCv('Node.js', 'nodejs', 'NodeJS')).toEqual(['Node.js'])
  })

  it('um termo do CV rende UMA skill, mesmo citando duas', () => {
    // "TypeScript/JavaScript" contem as duas, e sai so uma: `casar` devolve
    // `string | null`, um valor por termo. Nao e bug — e o limite do desenho,
    // e a IA costuma devolver a stack ja separada em itens.
    //
    // Este teste existe para o limite ser DELIBERADO: se alguem fizer o
    // casamento devolver varias, o teste falha e a decisao volta para a mesa.
    expect(skillsDoCv('TypeScript/JavaScript')).toHaveLength(1)
    // Separados, as duas entram normalmente.
    expect(skillsDoCv('TypeScript', 'JavaScript')).toHaveLength(2)
  })
})

describe('aplicarCv — acrescenta, nunca substitui', () => {
  it('o que a pessoa marcou a mao continua marcado', () => {
    // Ela pode ter escolhido dois filtros antes de subir o CV; apagar a
    // escolha dela seria a inversao exata do que o card pede.
    const atual: Selecao = { ...vazia(), skills: ['Kotlin'] }
    const { selecao } = aplicarCv(atual, { stack: ['Python'], senioridade: null })
    expect(selecao.skills).toContain('Kotlin')
    expect(selecao.skills).toContain('Python')
  })

  it('a escolha da pessoa vem primeiro na lista', () => {
    const atual: Selecao = { ...vazia(), skills: ['Kotlin'] }
    const { selecao } = aplicarCv(atual, { stack: ['Python'], senioridade: null })
    expect(selecao.skills[0]).toBe('Kotlin')
  })

  it('nao duplica o que ja estava marcado', () => {
    const atual: Selecao = { ...vazia(), skills: ['Python'] }
    const { selecao } = aplicarCv(atual, { stack: ['Python'], senioridade: null })
    expect(selecao.skills).toEqual(['Python'])
  })

  it('nao muda o objeto recebido', () => {
    // Mutar a selecao atual quebraria o estado do React sem aviso.
    const atual: Selecao = { ...vazia(), skills: ['Kotlin'] }
    aplicarCv(atual, { stack: ['Python'], senioridade: null })
    expect(atual.skills).toEqual(['Kotlin'])
  })
})

describe('aplicarCv — a origem, para o selo "from your CV"', () => {
  it('marca como do CV so o que o CV trouxe', () => {
    const atual: Selecao = { ...vazia(), skills: ['Kotlin'] }
    const { origem } = aplicarCv(atual, { stack: ['Python'], senioridade: null })
    expect(origem.skills?.has('Python')).toBe(true)
    // Kotlin foi a pessoa que marcou: o selo nao pode contar como da IA.
    expect(origem.skills?.has('Kotlin')).toBe(false)
  })

  it('nao marca origem no eixo em que nada entrou', () => {
    const { origem } = aplicarCv(vazia(), { stack: ['COBOL'], senioridade: null })
    expect(origem.skills).toBeUndefined()
  })

  it('o que ja estava marcado nao vira origem de CV', () => {
    const atual: Selecao = { ...vazia(), skills: ['Python'] }
    const { origem } = aplicarCv(atual, { stack: ['Python'], senioridade: null })
    expect(origem.skills).toBeUndefined()
  })
})

describe('aplicarCv — a senioridade', () => {
  it('aceita a senioridade que o catalogo conhece', () => {
    const { selecao } = aplicarCv(vazia(), { stack: [], senioridade: 'senior' })
    expect(selecao.experiencias).toEqual(['senior'])
  })

  it('recusa senioridade que o backend nao aceita', () => {
    // Mandar outra coisa e 400 do ValidationPipe.
    const { selecao } = aplicarCv(vazia(), { stack: [], senioridade: 'ninja' })
    expect(selecao.experiencias).toEqual([])
  })

  it('a senioridade nao casa por texto, e conferida por igualdade', () => {
    // Ela vem do backend ja no vocabulario do catalogo.
    const { selecao } = aplicarCv(vazia(), { stack: [], senioridade: 'Senior' })
    expect(selecao.experiencias).toEqual([])
  })

  it('senioridade nula nao mexe em nada', () => {
    const { selecao } = aplicarCv(vazia(), { stack: [], senioridade: null })
    expect(selecao.experiencias).toEqual([])
  })
})

describe('aplicarCv — os cargos', () => {
  it('casa o cargo do CV com o do catalogo', () => {
    const { selecao } = aplicarCv(vazia(), {
      stack: [],
      senioridade: null,
      cargos: ['Backend Engineer'],
    })
    expect(selecao.cargos).toEqual(['Backend Engineer'])
  })

  it('cargo ausente nao quebra', () => {
    expect(() => aplicarCv(vazia(), { stack: [], senioridade: null })).not.toThrow()
  })
})

describe('paraFiltrosApi — a traducao para o corpo do POST', () => {
  it('omite campo vazio, em vez de mandar []', () => {
    // Array vazio nao e um filtro, e o ValidationPipe rejeita o que nao
    // reconhece.
    expect(paraFiltrosApi(vazia())).toEqual({})
  })

  it('traduz os nomes que os dois lados chamam diferente', () => {
    const s: Selecao = { ...vazia(), cargos: ['Tech Lead'], skills: ['Go'] }
    const f = paraFiltrosApi(s)
    expect(f.job_titles).toEqual(['Tech Lead'])
    expect(f.technologies).toEqual(['Go'])
  })

  it('manda UMA senioridade, porque o backend nao aceita lista', () => {
    const s: Selecao = { ...vazia(), experiencias: ['senior', 'staff'] }
    expect(paraFiltrosApi(s).seniority).toBe('senior')
  })

  it('"Worldwide" NAO vira location: e a ausencia de restricao', () => {
    // Manda-lo como location faria a busca procurar um pais com esse nome.
    const s: Selecao = { ...vazia(), paises: ['Worldwide'] }
    const f = paraFiltrosApi(s)
    expect(f.locations).toBeUndefined()
    expect(f.remote).toBe('remoto')
  })

  it('"LATAM" NAO vira location: e uma regiao que o backend expande', () => {
    const s: Selecao = { ...vazia(), paises: ['LATAM'] }
    const f = paraFiltrosApi(s)
    expect(f.locations).toBeUndefined()
    expect(f.regiao).toBe('latam')
  })

  it('pais de verdade ao lado de "Worldwide" continua indo como location', () => {
    const s: Selecao = { ...vazia(), paises: ['Worldwide', 'Brazil'] }
    const f = paraFiltrosApi(s)
    expect(f.locations).toEqual(['Brazil'])
    expect(f.remote).toBe('remoto')
  })

  it('os dois portes marcados e o mesmo que nenhum', () => {
    const s: Selecao = { ...vazia(), portes: ['startup', 'grande'] }
    expect(paraFiltrosApi(s).porte).toBeUndefined()
  })

  it('um porte so vai para a busca', () => {
    const s: Selecao = { ...vazia(), portes: ['startup'] }
    expect(paraFiltrosApi(s).porte).toBe('startup')
  })

  it('a idade escolhida e a MAIOR: a menor ja esta contida nela', () => {
    const s: Selecao = { ...vazia(), idades: ['7', '30'] }
    expect(paraFiltrosApi(s).posted_within_days).toBe(30)
  })

  it('o salario escolhido e o MENOR: "100k OU 150k" e pedir acima de 100k', () => {
    const s: Selecao = { ...vazia(), salarios: ['100000', '150000'] }
    expect(paraFiltrosApi(s).salary_min).toBe(100000)
  })
})

describe('temSelecao', () => {
  it('selecao vazia nao tem selecao', () => {
    expect(temSelecao(vazia())).toBe(false)
  })

  it('um eixo preenchido ja conta', () => {
    expect(temSelecao({ ...vazia(), skills: ['Go'] })).toBe(true)
  })
})

describe('o catalogo', () => {
  it('nao tem valor repetido dentro do mesmo eixo', () => {
    for (const [eixo, opcoes] of Object.entries(CATALOGO)) {
      const valores = opcoes.map((o) => o.valor)
      expect(new Set(valores).size, `eixo ${eixo}`).toBe(valores.length)
    }
  })

  it('toda opcao tem valor e rotulo preenchidos', () => {
    for (const [eixo, opcoes] of Object.entries(CATALOGO)) {
      for (const o of opcoes) {
        expect(o.valor, `eixo ${eixo}`).toBeTruthy()
        expect(o.rotulo, `eixo ${eixo}`).toBeTruthy()
      }
    }
  })

  it('toda skill do catalogo casa consigo mesma', () => {
    // A garantia geral que o "C#" quebrou: se uma skill nao casa com o proprio
    // nome, ela nunca entra pelo CV — e ninguem percebe.
    for (const opcao of CATALOGO.skills) {
      expect(skillsDoCv(opcao.valor), `a skill ${opcao.valor}`).toContain(opcao.valor)
    }
  })

  it('todo cargo do catalogo casa consigo mesmo', () => {
    for (const opcao of CATALOGO.cargos) {
      const { selecao } = aplicarCv(vazia(), {
        stack: [],
        senioridade: null,
        cargos: [opcao.valor],
      })
      expect(selecao.cargos, `o cargo ${opcao.valor}`).toContain(opcao.valor)
    }
  })

  it('toda senioridade do catalogo e aceita', () => {
    for (const opcao of CATALOGO.experiencias) {
      const { selecao } = aplicarCv(vazia(), { stack: [], senioridade: opcao.valor })
      expect(selecao.experiencias, `a senioridade ${opcao.valor}`).toContain(opcao.valor)
    }
  })
})
