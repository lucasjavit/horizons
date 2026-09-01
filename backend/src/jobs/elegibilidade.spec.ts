import { lerElegibilidade, aceitaQuemMoraEm } from './elegibilidade';
import type { VagaDto } from './job.dto';

/**
 * "Esta vaga aceita quem mora onde eu moro?" — a pergunta que o produto existe
 * para responder, e que aqui e respondida SEM IA.
 *
 * As regras vem do card, e nao da leitura da funcao:
 *
 * - **o campo booleano vence o texto livre.** Medido em 19/08: 32 das 45 vagas
 *   tinham `regime: 'remoto'` com o `location` mostrando escritorio ("San
 *   Francisco HQ"). Classificar pelo texto marcaria 71% como presencial —
 *   todas erradas.
 * - **"nao disse" nao e "nao aceita"** (JOB-09). `null` e resposta legitima e
 *   diferente de `false`.
 * - **o escritorio E a restricao** ate a descricao dizer o contrario: errar
 *   para o lado restritivo e o certo.
 * - **`paises` nunca e lista vazia** — a tela leria como "nao aceita ninguem".
 */

function vaga(v: Partial<VagaDto>): VagaDto {
  return v as VagaDto;
}

describe('lerElegibilidade — sem fronteira declarada', () => {
  it.each([
    'Worldwide',
    'Remote - Worldwide',
    'Anywhere',
    'Global',
    'Globally',
    'Fully remote',
    'Any location',
    'Location independent',
  ])('%s aceita de qualquer lugar', (local) => {
    const e = lerElegibilidade(vaga({ local, regime: 'remoto' }));
    expect(e.global).toBe(true);
    expect(e.precisaLer).toBe(false);
  });

  it('a conclusao vem acompanhada do trecho que a sustenta', () => {
    // Sem o trecho nao ha conclusao: a tela precisa mostrar em que se baseou.
    const e = lerElegibilidade(vaga({ local: 'Worldwide', regime: 'remoto' }));
    expect(e.trecho).toBe('Worldwide');
  });

  it('sem fronteira NAO precisa de IA', () => {
    expect(lerElegibilidade(vaga({ local: 'Worldwide' })).precisaLer).toBe(false);
  });
});

describe('lerElegibilidade — remoto com pais amarrado', () => {
  it('"Remote, Canada" restringe ao Canada', () => {
    // O pais aqui e restricao, nao endereco.
    const e = lerElegibilidade(vaga({ local: 'Remote, Canada', regime: 'remoto' }));
    expect(e.global).toBe(false);
    expect(e.paises).toEqual(['Canada']);
    expect(e.precisaLer).toBe(false);
  });

  it('"Brazil - Remote" tambem restringe', () => {
    const e = lerElegibilidade(vaga({ local: 'Brazil - Remote', regime: 'remoto' }));
    expect(e.paises).toEqual(['Brazil']);
    expect(e.global).toBe(false);
  });

  it('nao confunde "Remote, HQ" com um pais chamado HQ', () => {
    const e = lerElegibilidade(vaga({ local: 'Remote, HQ', regime: 'remoto' }));
    expect(e.paises ?? []).not.toContain('HQ');
  });

  it('nao confunde "Remote, Global" com um pais', () => {
    // "Global" cai no caminho de sem fronteira, nao no de pais.
    const e = lerElegibilidade(vaga({ local: 'Remote, Global', regime: 'remoto' }));
    expect(e.global).toBe(true);
  });
});

describe('lerElegibilidade — o campo vence o texto (a medicao de 19/08)', () => {
  it('"San Francisco HQ" com regime remoto: o lugar continua sendo a restricao', () => {
    // O escritorio E a restricao ate a descricao dizer o contrario. Errar para
    // o lado restritivo e o certo — quem mora fora ve que nao bate, em vez de
    // receber um "aceita todo mundo" sem base (o erro do JOB-09).
    const e = lerElegibilidade(vaga({ local: 'San Francisco HQ', regime: 'remoto' }));
    expect(e.global).toBe(false);
    expect(e.paises).not.toBeNull();
    expect(e.precisaLer).toBe(false);
  });

  it('o ruido do ATS sai do nome do lugar', () => {
    const e = lerElegibilidade(vaga({ local: 'New York City Office', regime: 'remoto' }));
    expect(e.paises?.[0]).not.toMatch(/office/i);
  });

  it('"LATAM [Remote]" nao vira "LATAM []"', () => {
    // Medido em 20/08: a ordem da limpeza importa, e errar nela deixa lixo.
    const e = lerElegibilidade(vaga({ local: 'LATAM [Remote]', regime: 'remoto' }));
    expect(e.paises).toEqual(['LATAM']);
  });

  it.each([
    ['Berlin [EMEA]', 'Berlin'],
    ['LATAM [Contract]', 'LATAM'],
    ['Toronto [Full-time]', 'Toronto'],
  ])('o colchete E o que esta dentro dele saem de %p', (local, esperado) => {
    // O caso de cima nao distingue as duas limpezas: com "[Remote]" a palavra
    // ja saiu antes, e sobram colchetes vazios que qualquer regra remove. So
    // com CONTEUDO dentro do colchete se ve que ele tem de sair inteiro —
    // senao "EMEA" e "Contract" viram parte do nome do lugar.
    const e = lerElegibilidade(vaga({ local, regime: 'remoto' }));
    expect(e.paises).toEqual([esperado]);
  });

  it('parenteses e o que esta dentro deles saem', () => {
    const e = lerElegibilidade(vaga({ local: 'Berlin (Hybrid)', regime: 'presencial' }));
    expect(e.paises?.[0]).toBe('Berlin');
  });

  it('vaga presencial com lugar tambem e respondida sem IA', () => {
    const e = lerElegibilidade(vaga({ local: 'Serbia', regime: 'presencial' }));
    expect(e.paises).toEqual(['Serbia']);
    expect(e.precisaLer).toBe(false);
  });
});

describe('lerElegibilidade — quando so a IA resolve', () => {
  it('remoto por campo e sem lugar legivel precisa de IA', () => {
    // O unico caso que sobra: a empresa marcou remoto e nao disse de onde.
    const e = lerElegibilidade(vaga({ local: '', regime: 'remoto' }));
    expect(e.precisaLer).toBe(true);
    expect(e.global).toBe(false);
    expect(e.paises).toBeNull();
  });

  it('"nao disse" NAO vira "aceita todo mundo"', () => {
    // E o erro que o JOB-09 corrigiu.
    const e = lerElegibilidade(vaga({ local: '', regime: 'remoto' }));
    expect(e.global).toBe(false);
  });

  it('sem local e sem regime, so a descricao resolve', () => {
    const e = lerElegibilidade(vaga({ local: '', regime: undefined }));
    expect(e.precisaLer).toBe(true);
    expect(e.trecho).toBeNull();
  });

  it('local ausente e tratado como local vazio', () => {
    expect(() => lerElegibilidade(vaga({ regime: 'remoto' }))).not.toThrow();
    expect(lerElegibilidade(vaga({ regime: 'remoto' })).precisaLer).toBe(true);
  });

  it('duas letras nao dizem nada, e caem para a IA', () => {
    const e = lerElegibilidade(vaga({ local: 'XY', regime: 'remoto' }));
    expect(e.precisaLer).toBe(true);
  });
});

describe('lerElegibilidade — a invariante da lista de paises', () => {
  it.each([
    ['Worldwide', 'remoto'],
    ['Remote, Canada', 'remoto'],
    ['San Francisco HQ', 'remoto'],
    ['', 'remoto'],
    ['', undefined],
    ['LATAM [Remote]', 'remoto'],
  ])('para %p / %p, paises e null ou lista NAO vazia', (local, regime) => {
    // Lista vazia seria lida pela tela como "nao aceita ninguem", que e
    // diferente de "nao se sabe".
    const e = lerElegibilidade(vaga({ local, regime: regime as VagaDto['regime'] }));
    if (e.paises !== null) expect(e.paises.length).toBeGreaterThan(0);
  });
});

describe('aceitaQuemMoraEm', () => {
  it('vaga global aceita qualquer pais', () => {
    const e = lerElegibilidade(vaga({ local: 'Worldwide', regime: 'remoto' }));
    expect(aceitaQuemMoraEm(e, 'Brazil')).toBe(true);
    expect(aceitaQuemMoraEm(e, 'India')).toBe(true);
  });

  it('vaga presa a um pais aceita quem mora nele', () => {
    const e = lerElegibilidade(vaga({ local: 'Remote, Brazil', regime: 'remoto' }));
    expect(aceitaQuemMoraEm(e, 'Brazil')).toBe(true);
  });

  it('vaga presa a um pais recusa quem mora em outro', () => {
    const e = lerElegibilidade(vaga({ local: 'Remote, Canada', regime: 'remoto' }));
    expect(aceitaQuemMoraEm(e, 'Brazil')).toBe(false);
  });

  it('devolve null quando so a IA pode responder', () => {
    // null e resposta legitima, e DIFERENTE de false: "nao disse" nao e "nao
    // aceita". Foi o erro que o JOB-09 corrigiu.
    const e = lerElegibilidade(vaga({ local: '', regime: 'remoto' }));
    expect(aceitaQuemMoraEm(e, 'Brazil')).toBeNull();
  });

  it('null e false sao valores distintos, e nao ambos "falsy"', () => {
    const semResposta = lerElegibilidade(vaga({ local: '', regime: 'remoto' }));
    const recusa = lerElegibilidade(vaga({ local: 'Remote, Canada', regime: 'remoto' }));
    expect(aceitaQuemMoraEm(semResposta, 'Brazil')).toBeNull();
    expect(aceitaQuemMoraEm(recusa, 'Brazil')).toBe(false);
    expect(aceitaQuemMoraEm(semResposta, 'Brazil')).not.toBe(
      aceitaQuemMoraEm(recusa, 'Brazil'),
    );
  });

  it('ignora acento e caixa ao comparar o pais', () => {
    const e = lerElegibilidade(vaga({ local: 'Remote, Mexico', regime: 'remoto' }));
    expect(aceitaQuemMoraEm(e, 'MEXICO')).toBe(true);
    expect(aceitaQuemMoraEm(e, 'méxico')).toBe(true);
  });
});
