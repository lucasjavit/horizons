import {
  validarDocumento,
  dicaDoDocumento,
  paisPorCodigo,
  PAISES,
  PAISES_COM_REGRA,
} from './documentos';

/**
 * Os valores deste arquivo NAO saem da implementacao.
 *
 * Cada documento valido abaixo foi gerado por uma implementacao de referencia
 * independente (Python), escrita a partir da especificacao publica do digito
 * verificador de cada pais. E o que faz este teste ser teste: se o TypeScript
 * calcular diferente da especificacao, o teste falha — em vez de concordar com
 * o proprio codigo que deveria conferir.
 *
 * Os tres bugs medidos em 31/08 tem bloco proprio no fim do arquivo, com o
 * caso exato que passava.
 */

/** Aceito = a validacao nao devolve mensagem. */
function aceita(pais: string, documento: string): boolean {
  return validarDocumento(pais, documento) === null;
}

describe('validarDocumento — CPF (BR)', () => {
  // Gerados pela especificacao: dois digitos verificadores modulo 11, pesos
  // decrescentes de 10 a 2 e depois de 11 a 2.
  const VALIDOS = [
    '12345678909',
    '11144477735',
    '52998224725',
    '00000001910',
    '98765432100',
  ];

  it.each(VALIDOS)('aceita o CPF %s, cujo DV bate com a especificacao', (cpf) => {
    expect(aceita('BR', cpf)).toBe(true);
  });

  it('aceita o CPF com a mascara que a pessoa digita', () => {
    expect(aceita('BR', '123.456.789-09')).toBe(true);
    expect(aceita('BR', '529.982.247-25')).toBe(true);
  });

  it('recusa quando o ultimo digito verificador esta errado', () => {
    // Mesmo corpo dos validos acima, so o DV final trocado.
    expect(aceita('BR', '12345678908')).toBe(false);
    expect(aceita('BR', '52998224726')).toBe(false);
  });

  it('recusa quando o PRIMEIRO digito verificador esta errado', () => {
    // 12345678909 -> o DV1 correto e 0; aqui vai 1, e o DV2 segue o original.
    expect(aceita('BR', '12345678919')).toBe(false);
  });

  it('recusa os repetidos, que passam na formula mas nao sao CPF', () => {
    // Armadilha classica: 111.111.111-11 satisfaz o modulo 11.
    for (let d = 0; d <= 9; d++) {
      const repetido = String(d).repeat(11);
      expect(aceita('BR', repetido)).toBe(false);
    }
  });

  it('recusa comprimento diferente de 11', () => {
    expect(aceita('BR', '1234567890')).toBe(false);
    expect(aceita('BR', '123456789099')).toBe(false);
  });
});

describe('validarDocumento — CUIT/CUIL (AR)', () => {
  // Pesos ciclicos 5,4,3,2,7,6,5,4,3,2 sobre os 10 primeiros digitos.
  const VALIDOS = [
    '20123456786',
    '27123456780',
    '30123456781',
    '23123456785',
    '33123456780',
  ];

  it.each(VALIDOS)('aceita o CUIT %s, cujo DV bate com a especificacao', (cuit) => {
    expect(aceita('AR', cuit)).toBe(true);
  });

  it('aceita o CUIT com os tracos do formato oficial', () => {
    expect(aceita('AR', '20-12345678-6')).toBe(true);
  });

  it('recusa DV errado', () => {
    expect(aceita('AR', '20123456787')).toBe(false);
  });

  it('recusa prefixo que nao existe, ainda que o DV feche', () => {
    // O prefixo diz o tipo (20/23/24/27 fisica, 30/33/34 juridica). 11 digitos
    // quaisquer com verificador certo nao sao um CUIT.
    // 21123456789: DV calculado pela especificacao para o corpo 2112345678.
    const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
    const corpo = '2112345678';
    const soma = pesos.reduce((a, p, i) => a + p * Number(corpo[i]), 0);
    const r = 11 - (soma % 11);
    const dv = r === 11 ? 0 : r === 10 ? 9 : r;
    expect(aceita('AR', corpo + dv)).toBe(false);
  });
});

describe('validarDocumento — RUT (CL)', () => {
  // Modulo 11 com pesos ciclicos 2..7 da direita para a esquerda.
  it.each(['123456785', '76543216', '158341484'])(
    'aceita o RUT %s, cujo DV bate com a especificacao',
    (rut) => {
      expect(aceita('CL', rut)).toBe(true);
    },
  );

  it('aceita o verificador K, que vale 10', () => {
    // 10000013 -> resto 10 -> DV 'K'. Sem tratar o K o RUT chileno nao fecha.
    expect(aceita('CL', '10000013K')).toBe(true);
    expect(aceita('CL', '10000013k')).toBe(true);
  });

  it('aceita o verificador 0, que vem do resto 11', () => {
    expect(aceita('CL', '100000040')).toBe(true);
  });

  it('aceita o RUT com pontos e traco', () => {
    expect(aceita('CL', '12.345.678-5')).toBe(true);
  });

  it('recusa DV errado', () => {
    expect(aceita('CL', '123456784')).toBe(false);
    expect(aceita('CL', '10000013J')).toBe(false);
  });
});

describe('validarDocumento — DNI (PE)', () => {
  it('aceita exatamente 8 digitos', () => {
    expect(aceita('PE', '12345678')).toBe(true);
    expect(aceita('PE', '00000000')).toBe(true);
  });

  it('recusa 7 ou 9 digitos', () => {
    expect(aceita('PE', '1234567')).toBe(false);
    expect(aceita('PE', '123456789')).toBe(false);
  });
});

describe('validarDocumento — cedula de ciudadania (CO)', () => {
  it('aceita de 6 a 10 digitos, que e a regra de comprimento', () => {
    expect(aceita('CO', '123456')).toBe(true);
    expect(aceita('CO', '1234567890')).toBe(true);
  });

  it('recusa 5 digitos e 11 digitos', () => {
    expect(aceita('CO', '12345')).toBe(false);
    expect(aceita('CO', '12345678901')).toBe(false);
  });
});

describe('validarDocumento — RFC (MX)', () => {
  it('aceita pessoa fisica (4 letras) e juridica (3 letras)', () => {
    expect(aceita('MX', 'AAAA880101AAA')).toBe(true);
    expect(aceita('MX', 'ABC880101AB1')).toBe(true);
  });

  it('aceita a letra N com til, que existe em nome mexicano', () => {
    expect(aceita('MX', 'ÑAAA880101AAA')).toBe(true);
  });

  it('recusa mes 00 e mes 13', () => {
    expect(aceita('MX', 'AAAA880001AAA')).toBe(false);
    expect(aceita('MX', 'AAAA881301AAA')).toBe(false);
  });

  it('recusa dia 00', () => {
    expect(aceita('MX', 'AAAA880100AAA')).toBe(false);
  });

  it('aceita 29 de fevereiro em ano bissexto', () => {
    // Recusar quem nasceu em 29/02 seria pior que aceitar um seculo ambiguo.
    expect(aceita('MX', 'AAAA880229AAA')).toBe(true);
  });
});

describe('validarDocumento — o caminho generico', () => {
  it('aceita documento de pais nao modelado, de 4 a 32 caracteres', () => {
    // Ninguem fica sem caminho: quem esta na India ou nas Filipinas preenche.
    expect(aceita('IN', 'ABCDE1234F')).toBe(true);
    expect(aceita('PH', '123-456-789')).toBe(true);
    expect(aceita('US', '123-45-6789')).toBe(true);
  });

  it('recusa curto demais e longo demais', () => {
    expect(aceita('IN', 'ABC')).toBe(false);
    expect(aceita('IN', 'A'.repeat(33))).toBe(false);
  });

  it('recusa caractere que nao pertence ao alfabeto do campo', () => {
    expect(aceita('IN', 'ABC@1234')).toBe(false);
    expect(aceita('IN', 'ABC<script>')).toBe(false);
  });
});

describe('validarDocumento — as regras que valem para todo pais', () => {
  it('aceita vazio: perfil vazio e perfil valido (PLT-10)', () => {
    expect(validarDocumento('BR', '')).toBeNull();
    expect(validarDocumento('BR', '   ')).toBeNull();
    expect(validarDocumento('OTHER', '')).toBeNull();
  });

  it('recusa quando o pais nao existe na lista', () => {
    expect(validarDocumento('ZZ', '12345678909')).toBe('Pick a country first');
  });

  it('devolve mensagem em ingles nomeando o documento e o pais', () => {
    // A mensagem ja e texto de tela: nao pode vazar termo em portugues.
    expect(validarDocumento('BR', '11111111111')).toBe(
      'That is not a valid CPF for Brazil',
    );
    expect(validarDocumento('MX', 'AAAA880231AAA')).toBe(
      'That is not a valid RFC for Mexico',
    );
  });

  it('um documento valido de um pais nao vale no outro', () => {
    // O CPF valido nao pode passar como RUT nem como DNI.
    expect(aceita('CL', '12345678909')).toBe(false);
    expect(aceita('PE', '12345678909')).toBe(false);
    expect(aceita('BR', '10000013K')).toBe(false);
  });
});

/**
 * Os tres bugs medidos em 31/08.
 *
 * Cada um destes casos PASSAVA na validacao antes da correcao. Sao os testes
 * que teriam pego os bugs, e sao os que devem falhar se alguem reintroduzir a
 * regra antiga.
 */
describe('validarDocumento — os bugs de 31/08', () => {
  it('recusa letra colada no CPF: digitos() apagava a letra em vez de reprovar', () => {
    // "CPF 123.456.789-09" virava "12345678909" e PASSAVA.
    expect(aceita('BR', 'CPF 123.456.789-09')).toBe(false);
    expect(aceita('BR', 'AB12345678909')).toBe(false);
    expect(aceita('BR', '12345678909X')).toBe(false);
  });

  it('recusa letra colada no CUIT e no DNI pela mesma razao', () => {
    expect(aceita('AR', 'CUIT 20-12345678-6')).toBe(false);
    expect(aceita('PE', 'DNI 12345678')).toBe(false);
  });

  it('recusa 31 de fevereiro no RFC: a data e conferida contra o mes', () => {
    // "880231" passava no limite generico de 31 dias.
    expect(aceita('MX', 'AAAA880231AAA')).toBe(false);
    // E os vizinhos da mesma familia: 31 em mes de 30 dias.
    expect(aceita('MX', 'AAAA880431AAA')).toBe(false); // abril
    expect(aceita('MX', 'AAAA880631AAA')).toBe(false); // junho
    expect(aceita('MX', 'AAAA880931AAA')).toBe(false); // setembro
    expect(aceita('MX', 'AAAA881131AAA')).toBe(false); // novembro
    // 30 de fevereiro tambem nao existe.
    expect(aceita('MX', 'AAAA880230AAA')).toBe(false);
  });

  it('recusa 29 de fevereiro em ano NAO bissexto', () => {
    // 1989/2089 nao e bissexto; 29/02 ali e erro de digitacao.
    expect(aceita('MX', 'AAAA890229AAA')).toBe(false);
  });

  it('recusa letra na cedula colombiana', () => {
    // "ABC123456" virava "123456" e PASSAVA.
    expect(aceita('CO', 'ABC123456')).toBe(false);
    expect(aceita('CO', '123456ABC')).toBe(false);
    expect(aceita('CO', 'CC 1234567890')).toBe(false);
  });
});

describe('dicaDoDocumento', () => {
  it('mostra no maximo 4 caracteres', () => {
    expect(dicaDoDocumento('12345678909')).toBe('8909');
  });

  it('mostra menos quando o documento e curto, para nao entregar metade dele', () => {
    // 6 caracteres -> 3; mostrar 4 de 6 seria dois tercos do documento.
    expect(dicaDoDocumento('123456').length).toBe(3);
    // 4 caracteres -> 2.
    expect(dicaDoDocumento('1234').length).toBe(2);
  });

  it('nunca devolve mais da metade do documento', () => {
    // A regra do card, verificada em toda faixa de comprimento util.
    for (let n = 2; n <= 20; n++) {
      const doc = '9'.repeat(n);
      expect(dicaDoDocumento(doc).length).toBeLessThanOrEqual(Math.max(1, n / 2));
    }
  });

  it('ignora a mascara ao contar', () => {
    // A dica de "123.456.789-09" tem de ser a mesma de "12345678909".
    expect(dicaDoDocumento('123.456.789-09')).toBe(dicaDoDocumento('12345678909'));
  });

  it('devolve pelo menos 1 caractere quando ha documento', () => {
    expect(dicaDoDocumento('12').length).toBeGreaterThanOrEqual(1);
  });
});

describe('o catalogo de paises', () => {
  it('nao tem codigo repetido', () => {
    const codigos = PAISES.map((p) => p.codigo);
    expect(new Set(codigos).size).toBe(codigos.length);
  });

  it('tem regra propria exatamente para os seis do card', () => {
    expect([...PAISES_COM_REGRA].sort()).toEqual(['AR', 'BR', 'CL', 'CO', 'MX', 'PE']);
  });

  it('todo pais com regra propria esta na lista da tela', () => {
    for (const codigo of PAISES_COM_REGRA) {
      expect(paisPorCodigo(codigo)).toBeDefined();
    }
  });

  /**
   * Onde a promessa do `exemplo` pode ser cobrada, e onde nao pode.
   *
   * O comentario do campo diz que o placeholder nao e um documento valido — um
   * que passa na validacao parece valor ja preenchido, e foi confundido com
   * vazamento do documento salvo na verificacao de 31/08.
   *
   * A promessa so e exigivel onde ha **digito verificador**: BR, AR, CL e MX.
   * O CL entrou aqui em 01/09, quando o QA-02 foi corrigido — ate entao ele
   * era a excecao, e a excecao era o proprio bug.
   * CO e PE validam por comprimento, e o resto cai no caminho generico — ali
   * qualquer placeholder com cara de formato real passa por construcao, e
   * exigir o contrario obrigaria a um exemplo que nao ensina o formato.
   */
  it.each(['BR', 'AR', 'CL', 'MX'])(
    'o exemplo de %s nao e um documento valido',
    (codigo) => {
      const pais = paisPorCodigo(codigo)!;
      expect(aceita(pais.codigo, pais.exemplo)).toBe(false);
    },
  );


  it('OTHER fecha a lista, para quem nao esta nela', () => {
    expect(PAISES[PAISES.length - 1].codigo).toBe('OTHER');
  });
});
