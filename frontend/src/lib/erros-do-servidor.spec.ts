/**
 * APP-02 — a traducao das mensagens do backend.
 *
 * Tres camadas, e a terceira e a que importa a longo prazo:
 *
 * 1. **traduz**: cada mensagem medida pelo QA sai em ingles;
 * 2. **nao apaga**: desconhecida passa como veio, array de validacao continua
 *    funcionando, erro de rede mantem o texto que ja tinha;
 * 3. **nao envelhece**: o ultimo bloco LE `backend/src/` e falha se uma
 *    mensagem mapeada sumir de la. Sem ele o mapa viraria um monte de chaves
 *    mortas em silencio — exatamente o que o CLAUDE.md descreve do
 *    `qa-rapido.py` de 31/08, que se pulava sem avisar.
 *
 * Cada teste daqui foi visto FALHAR com o codigo quebrado de proposito; a
 * tabela de mutacoes esta no relatorio do card.
 */
/// <reference types="node" />
// A referencia acima e o que deixa `node:fs` e `__dirname` existirem AQUI sem
// abrir Node para o `src/` inteiro. `tsconfig.app.json` tem
// `"types": ["vite/client"]` de proposito — por um teste nao se poe `"node"`
// la, que daria a qualquer componente um `node:fs` que o bundle nao atende.
import { AxiosError, AxiosHeaders } from 'axios'
import { describe, expect, it } from 'vitest'
import { traduzirErroDoServidor, traduzirMensagemDaApi } from './erros-do-servidor'
import { errorMessage } from './api'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/** Um AxiosError com resposta, como a tela recebe. */
function erroDaApi(status: number, body: unknown): AxiosError {
  const headers = new AxiosHeaders()
  const config = { headers }
  return new AxiosError('Request failed', 'ERR_BAD_REQUEST', config, {}, {
    status,
    statusText: '',
    headers: {},
    config,
    data: body,
  })
}

// ---------------------------------------------------------------------------
// 1. As cinco mensagens que o card exige
// ---------------------------------------------------------------------------

describe('as mensagens medidas pelo QA saem em ingles', () => {
  /**
   * A mais visivel de todas (card, 27/08): aparece em QUALQUER tela protegida
   * sem sessao. Era o texto do meio de "Something went wrong / Entre para
   * continuar. / Try again" — tres frases, a do meio em outro idioma.
   */
  it('guard: "Entre para continuar." vira ingles', () => {
    expect(traduzirErroDoServidor('Entre para continuar.')).toBe('Sign in to continue.')
  })

  it('CV com formato errado', () => {
    expect(
      traduzirErroDoServidor('Formato nao suportado. Envie o curriculo em PDF ou DOCX.'),
    ).toBe('Unsupported format. Upload your resume as a PDF or DOCX.')
  })

  it('CV em PDF escaneado, sem texto', () => {
    expect(
      traduzirErroDoServidor(
        'Nao consegui ler texto neste arquivo. Se o curriculo for uma imagem escaneada, exporte em PDF de texto e tente de novo.',
      ),
    ).toBe(
      'We could not read any text in this file. If your resume is a scanned image, export it as a text PDF and try again.',
    )
  })

  it('CV acima de 5 MB', () => {
    expect(traduzirErroDoServidor('O arquivo passa de 5 MB. Envie um PDF ou DOCX menor.')).toBe(
      'The file is over 5 MB. Upload a smaller PDF or DOCX.',
    )
  })

  it('/email/sair com token invalido', () => {
    expect(traduzirErroDoServidor('Link invalido ou expirado')).toBe(
      'This link is invalid or has expired',
    )
  })

  /**
   * O criterio de aceite e "nenhuma frase mistura os dois idiomas", e quem
   * monta a frase e `errorMessage` — nao o mapa. Este teste fecha o circuito
   * do guard de ponta a ponta, como a tela o ve.
   */
  it('errorMessage, de ponta a ponta, no 401 do guard', () => {
    const erro = erroDaApi(401, { statusCode: 401, message: 'Entre para continuar.' })
    expect(errorMessage(erro)).toBe('Sign in to continue.')
  })
})

/**
 * Nenhuma traducao pode deixar palavra do portugues para tras.
 *
 * Pega o erro que uma traducao apressada comete: copiar a chave e trocar meia
 * frase. "curriculo", "nao", "voce" sao as pegadas.
 */
describe('nenhum valor traduzido carrega palavra em portugues', () => {
  const PORTUGUES =
    /\b(nao|curriculo|voce|arquivo|entre|senha|configurad[oa]|invalido|expirado|busca|vaga|conta)\b/i

  it.each([
    'Entre para continuar.',
    'Formato nao suportado. Envie o curriculo em PDF ou DOCX.',
    'Link invalido ou expirado',
    'Esta conta foi desativada.',
    'Voce ainda nao tem um perfil de busca',
    'Nenhum arquivo enviado.',
    'O canal do Telegram nao esta configurado.',
  ])('%s', (pt) => {
    const en = traduzirErroDoServidor(pt)
    expect(en).not.toBe(pt)
    expect(en).not.toMatch(PORTUGUES)
  })
})

// ---------------------------------------------------------------------------
// 2. Fallback e array
// ---------------------------------------------------------------------------

describe('mensagem desconhecida: repassa, nao apaga', () => {
  /**
   * A decisao do card: portugues nao traduzido e ruim, apagar e pior. Quem
   * depura perde a unica pista; "Something went wrong" nao diz o que falhou.
   */
  it('passa a string original', () => {
    expect(traduzirErroDoServidor('Uma mensagem que ninguem mapeou ainda')).toBe(
      'Uma mensagem que ninguem mapeou ainda',
    )
  })

  it('nunca devolve vazio nem "undefined" para uma mensagem com texto', () => {
    const saida = traduzirErroDoServidor('Erro novo do backend')
    expect(saida).not.toBe('')
    expect(saida).not.toContain('undefined')
  })

  it('a mensagem em ingles que o backend ja manda passa intacta', () => {
    // telegram.service.ts manda este em ingles de proposito (JOB-04). Nao
    // esta no mapa, e o fallback tem de deixar passar sem estragar.
    expect(traduzirErroDoServidor('This account is already connected to Telegram.')).toBe(
      'This account is already connected to Telegram.',
    )
  })
})

describe('array de mensagens (ValidationPipe com forbidNonWhitelisted)', () => {
  it('junta com virgula, como antes', () => {
    expect(
      traduzirMensagemDaApi([
        'address.city must be shorter than or equal to 80 characters',
        'country must be a string',
      ]),
    ).toBe(
      'address.city must be shorter than or equal to 80 characters, country must be a string',
    )
  })

  it('traduz item em portugues no meio de itens em ingles', () => {
    expect(
      traduzirMensagemDaApi(['Entre para continuar.', 'country must be a string']),
    ).toBe('Sign in to continue., country must be a string')
  })

  it('array de um item nao ganha virgula', () => {
    expect(traduzirMensagemDaApi(['country must be a string'])).toBe(
      'country must be a string',
    )
  })

  it('item vazio nao deixa virgula solta na frente', () => {
    // Sem o filtro, `['', 'x'].join(', ')` imprime ", x" na tela.
    expect(traduzirMensagemDaApi(['', 'country must be a string'])).toBe(
      'country must be a string',
    )
  })

  it('nao-string no array nao vira "null" na tela', () => {
    // O Nest nao promete que o array e so de strings.
    const sujo = [null, 'country must be a string'] as unknown as string[]
    expect(traduzirMensagemDaApi(sujo)).toBe('country must be a string')
  })

  it('array sem nada util cai no generico de errorMessage, e nao em vazio', () => {
    // Era um defeito do codigo antigo: `[].join(', ')` devolvia '' e a caixa
    // de erro aparecia vermelha e MUDA.
    expect(traduzirMensagemDaApi([])).toBe('')
    const erro = erroDaApi(400, { statusCode: 400, message: [] })
    expect(errorMessage(erro)).toBe('Error 400')
  })
})

// ---------------------------------------------------------------------------
// 3. O que a traducao NAO pode ter quebrado
// ---------------------------------------------------------------------------

describe('os erros que nao vem do backend continuam com o texto que tinham', () => {
  it('timeout', () => {
    const headers = new AxiosHeaders()
    const erro = new AxiosError('timeout', 'ECONNABORTED', { headers })
    expect(errorMessage(erro)).toBe('The request took too long.')
  })

  it('API fora do ar (sem resposta)', () => {
    const headers = new AxiosHeaders()
    const erro = new AxiosError('Network Error', 'ERR_NETWORK', { headers })
    expect(errorMessage(erro)).toBe('Could not reach the API. Is it running?')
  })

  it('resposta sem campo message', () => {
    expect(errorMessage(erroDaApi(500, {}))).toBe('Error 500')
  })

  it('erro que nem e do axios', () => {
    expect(errorMessage(new Error('qualquer coisa'))).toBe('Unexpected error.')
  })
})

describe('mensagens com valor interpolado', () => {
  it.each([
    ['Trilha "system-design" nao encontrada', 'Track "system-design" not found'],
    [
      'Aula "cap-theorem" nao encontrada na trilha "system-design"',
      'Lesson "cap-theorem" not found in track "system-design"',
    ],
    ['Aula "abc-123" nao encontrada', 'Lesson "abc-123" not found'],
    ['Nenhum token guardado para openai', 'No token stored for openai'],
    [
      'Voce ja tem 20 buscas salvas. Apague uma para guardar outra.',
      'You already have 20 saved searches. Delete one to save another.',
    ],
  ])('%s', (pt, en) => {
    expect(traduzirErroDoServidor(pt)).toBe(en)
  })

  /**
   * A mensagem longa da aula nao pode sair pela metade.
   *
   * Ha DUAS protecoes independentes para isto no modulo: o padrao longo vem
   * antes na lista, e o padrao curto e ancorado em `$`. Tentei quebrar cada
   * uma isolada (mutacoes M6 e M6b) e nenhuma falhou — justamente porque a
   * outra segura. Entao o teste nao afirma a ordem nem a ancora, que sao
   * implementacao: afirma o resultado, e que ele nao perdeu a trilha no
   * caminho. Quebra quando as DUAS cairem, que e quando o defeito aparece.
   */
  it('a mensagem longa da aula nao sai pela metade', () => {
    const saida = traduzirErroDoServidor('Aula "x" nao encontrada na trilha "y"')
    expect(saida).toBe('Lesson "x" not found in track "y"')
    // O jeito de errar: casar com o padrao curto e engolir a trilha dentro do
    // grupo, imprimindo `Lesson "x" nao encontrada na trilha "y" not found`.
    expect(saida).not.toMatch(/nao encontrada/)
  })
})

// ---------------------------------------------------------------------------
// 4. O mapa nao pode envelheceR em silencio
// ---------------------------------------------------------------------------

/**
 * **Este bloco falha se o backend reescrever uma mensagem mapeada.**
 *
 * Ele le `backend/src/` do disco — o backend e o frontend moram no mesmo
 * repositorio, entao isto nao acopla os dois em tempo de execucao: nada do
 * `erros-do-servidor.ts` conhece o backend, e o bundle nao muda. O acoplamento
 * existe so no teste, que e exatamente onde se quer.
 *
 * Como funciona: concatena todo `.ts` de `backend/src`, remove as quebras de
 * linha e os `' +` da concatenacao de string, e procura cada chave do mapa.
 * Chave que nao estiver mais lá e chave morta — ou o backend mudou o texto (e
 * a tela voltou a mostrar portugues), ou a mensagem sumiu (e a chave e lixo).
 * Nos dois casos alguem precisa olhar.
 *
 * Nao e perfeito: nao pega uma mensagem NOVA que o backend criou e ninguem
 * mapeou. Essa fica no fallback, em portugues — degradacao conhecida e
 * registrada no card, nao surpresa.
 */
describe('as chaves do mapa existem no backend de hoje', () => {
  const arquivosDoBackend = listarTs(join(__dirname, '../../../backend/src'))

  /** Tudo que o backend pode mandar, numa string so, sem as juntas de código. */
  const fonteDoBackend = (() => {
    return arquivosDoBackend
      .map((f) => readFileSync(f, 'utf8'))
      .join('\n')
      // `'texto ' +\n  'resto'` vira `'texto resto'`: e assim que o backend
      // escreve as mensagens longas, e sem isto nenhuma delas seria achada.
      .replace(/'\s*\+\s*\n?\s*'/g, '')
      .replace(/\s*\n\s*/g, ' ')
  })()

  const CHAVES = chavesMapeadas()

  /**
   * Primeiro: o teste esta mesmo lendo o backend inteiro.
   *
   * Sem isto o bloco abaixo passaria vacuamente se o caminho relativo
   * quebrasse (uma pasta movida, por exemplo) e a leitura devolvesse pouco —
   * um teste que se pula em silencio, que e o defeito que o CLAUDE.md conta do
   * `qa-rapido.py` de 31/08. Medido: 100+ arquivos hoje.
   */
  it('leu o backend inteiro, e nao uma pasta so', () => {
    expect(arquivosDoBackend.length).toBeGreaterThan(50)
  })

  it('o mapa tem as 24+ mensagens levantadas, nao duas', () => {
    expect(CHAVES.length).toBeGreaterThanOrEqual(24)
  })

  it.each(CHAVES)('o backend ainda manda: %s', (chave) => {
    expect(fonteDoBackend).toContain(chave)
  })
})

/** Os `.ts` de uma arvore, sem `node_modules` nem os proprios specs. */
function listarTs(dir: string): string[] {
  // `readdirSync` com `recursive` existe no Node 20+, que e o do projeto.
  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((p) => p.endsWith('.ts') && !p.includes('node_modules') && !p.includes('.spec.'))
    .map((p) => join(dir, p))
}

/**
 * As chaves do mapa, lidas do PROPRIO arquivo-fonte.
 *
 * Nao ha como importar o objeto: ele nao e exportado, de proposito — exportar
 * o mapa so para o teste convidaria alguem a ler a traducao direto dele e
 * contornar o fallback. Ler o fonte custa um `readFileSync` e mantem a
 * interface do modulo em duas funcoes.
 */
function chavesMapeadas(): string[] {
  const fonte = readFileSync(join(__dirname, 'erros-do-servidor.ts'), 'utf8')
  const corpo = fonte.slice(
    fonte.indexOf('const TRADUCOES'),
    fonte.indexOf('const PADROES'),
  )
  // Chave entre aspas simples no comeco de linha, antes dos dois pontos. O `:`
  // final e o que separa chave de valor continuado na linha seguinte.
  const chaves = [...corpo.matchAll(/^ {2}'((?:[^'\\]|\\.)+)':/gm)].map((m) =>
    m[1].replace(/\\'/g, "'"),
  )
  if (chaves.length === 0) throw new Error('nao consegui ler as chaves do mapa')
  return chaves
}

/**
 * **A trava: mensagem NOVA do backend nao escapa em portugues.**
 *
 * O bloco acima pega a chave que SUMIU do backend. Este pega o contrario — a
 * mensagem que APARECEU e ninguem mapeou —, que era a brecha registrada no
 * APP-02 como degradacao conhecida.
 *
 * Decisao do stakeholder em 01/10: *"vamos mexer, pois precisamos disso em
 * ingles"*. A alternativa era trocar o contrato da API por codigos de erro —
 * o desenho certo a longo prazo, mas 24 mensagens em 15 modulos, e nao compra
 * nada que esta trava nao compre: aqui a mensagem nao traduzida **nao
 * compila** a suite, e o commit nao passa.
 *
 * ## Como decide o que e portugues
 *
 * Nao da para perguntar o idioma de uma frase sem biblioteca. O que da, e
 * basta, e procurar **marcas que so o portugues tem** no vocabulario que este
 * backend usa: artigo, preposicao e conjugacao que nao existem em ingles
 * (`nao`, `voce`, `esta`, `foi`, `pela`...). O CLAUDE.md manda mensagem **sem
 * acento**, entao acento nao serve de marca — e e justamente por isso que
 * "curriculo" e "nao" parecem texto quebrado em vez de outro idioma, que foi o
 * que originou este card.
 *
 * Falso negativo e possivel (uma frase curta sem nenhuma marca passaria). Esse
 * e o limite aceito: a trava cobre a forma como ESTE backend escreve, e o
 * teste acima garante que o que ja esta mapeado nao se perde.
 */
describe('nenhuma mensagem nova do backend escapa sem traducao', () => {
  /** Palavras que so aparecem em portugues, no vocabulario deste backend. */
  const MARCAS_DE_PORTUGUES = [
    'nao', 'voce', 'esta', 'este', 'esse', 'sua', 'seu', 'foi', 'pela', 'pelo',
    'uma', 'dos', 'das', 'com', 'sem', 'para', 'informe', 'escolha', 'entre',
    'antes', 'ainda', 'conta', 'usuario', 'vaga', 'busca', 'perfil', 'aula',
    'trilha', 'chave', 'token do', 'nenhum', 'desconhecido', 'invalido',
    'expirado', 'restrita', 'desativada', 'configurado', 'encontrado',
    'encontrada', 'suportado', 'possivel', 'desligada', 'arquivo', 'canal',
  ]

  /**
   * As mensagens de excecao do backend, como o Nest as manda.
   *
   * Pega o literal do primeiro argumento de `*Exception(...)`, juntando as
   * concatenadas com `' +` — e assim que as mensagens longas de CV sao
   * escritas, e sem isso elas nem apareceriam.
   */
  const mensagensDoBackend = (() => {
    const fonte = listarTs(join(__dirname, '../../../backend/src'))
      .map((f) => readFileSync(f, 'utf8'))
      .join('\n')
      .replace(/'\s*\+\s*\n?\s*'/g, '')
      .replace(/\s*\n\s*/g, ' ')
    return [...fonte.matchAll(/Exception\(\s*'((?:[^'\\]|\\.)+)'/g)].map((m) =>
      m[1].replace(/\\'/g, "'"),
    )
  })()

  /** Mesmo guard do bloco acima: teste que le pouco nao se pula em silencio. */
  it('achou as mensagens do backend, e nao uma lista vazia', () => {
    expect(new Set(mensagensDoBackend).size).toBeGreaterThanOrEqual(20)
  })

  it('toda mensagem em portugues tem traducao', () => {
    const semTraducao = [...new Set(mensagensDoBackend)]
      .filter((msg) => {
        const palavras = msg.toLowerCase()
        return MARCAS_DE_PORTUGUES.some((marca) =>
          new RegExp(`\\b${marca}\\b`).test(palavras),
        )
      })
      // Traduzida e a que SAI diferente de como entrou. Comparar com o mapa
      // por chave deixaria de fora o que os PADROES resolvem (as mensagens com
      // valor interpolado, como o slug da trilha).
      .filter((msg) => traduzirErroDoServidor(msg) === msg)

    // A mensagem do erro lista o que falta: quem adicionar uma mensagem no
    // backend tem de ler aqui o que fazer, nao um `false !== true`.
    expect(
      semTraducao,
      `Mensagem(ns) em portugues sem traducao em erros-do-servidor.ts.\n` +
        `Acrescente a traducao no mapa TRADUCOES (ou em PADROES, se tiver\n` +
        `valor interpolado):\n` +
        semTraducao.map((m) => `  - ${m}`).join('\n'),
    ).toEqual([])
  })
})
