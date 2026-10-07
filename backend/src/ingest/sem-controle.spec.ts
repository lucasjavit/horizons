/**
 * JOB-54 — a varredura de caractere de controle, no nivel da funcao.
 *
 * Camada 1 (sem banco, sem HTTP) porque o que esta em jogo aqui e a logica da
 * recursao: profundidade, chave de objeto, array dentro de array. Esses casos
 * sao caros de montar por HTTP e baratos aqui, e o e2e cobre a outra metade —
 * que o 400 chega mesmo e que nada e gravado.
 *
 * Cada teste foi visto FALHAR com a mutacao correspondente; a tabela esta no
 * relatorio do card.
 */
import {
  PROFUNDIDADE_MAXIMA_DO_SNAPSHOT,
  semCaractereDeControle,
} from './sem-controle';

describe('JOB-54 — semCaractereDeControle', () => {
  describe('o que tem de ser RECUSADO', () => {
    it('NUL numa string solta', () => {
      expect(semCaractereDeControle('ruim\u0000')).toBe(false);
    });

    it.each([
      ['\u0000', 'NUL'],
      ['\u0001', 'SOH'],
      ['\u0008', 'backspace'],
      ['\u000B', 'vertical tab'],
      ['\u000C', 'form feed'],
      ['\u001B', 'escape'],
      ['\u001F', 'unit separator'],
      ['\u007F', 'delete'],
      ['\u009F', 'C1 final'],
    ])('o controle %j (%s) e recusado', (caractere) => {
      expect(semCaractereDeControle(`antes${caractere}depois`)).toBe(false);
    });

    it('NUL dentro de um array de string (o caso de `skills`)', () => {
      expect(semCaractereDeControle(['node', 'type\u0000script'])).toBe(false);
    });

    it('NUL no VALOR de uma chave do snapshot', () => {
      expect(semCaractereDeControle({ salaryTrecho: 'USD 90k\u0000' })).toBe(false);
    });

    it('NUL na CHAVE do snapshot', () => {
      // O caso que uma varredura so de valores deixaria passar. O Prisma
      // serializa o objeto inteiro para a coluna Json, e o Postgres recusa o
      // mesmo jeito — o NUL nao precisa estar no valor para derrubar.
      expect(semCaractereDeControle({ 'ru\u0000im': 'ok' })).toBe(false);
    });

    it('NUL fundo no snapshot aninhado', () => {
      const fundo = { a: { b: { c: { d: [{ e: 'x\u0000' }] } } } };
      expect(semCaractereDeControle(fundo)).toBe(false);
    });

    it('objeto MAIS FUNDO que o teto e recusado, e nao ignorado', () => {
      // ⚠️ O ponto da decisao: parar de olhar seria deixar o NUL entrar por
      // baixo do teto. Acima do limite a resposta e "nao sei, recuso".
      let fundo: unknown = 'folha-limpa';
      for (let i = 0; i < PROFUNDIDADE_MAXIMA_DO_SNAPSHOT + 5; i += 1) {
        fundo = { dentro: fundo };
      }
      expect(semCaractereDeControle(fundo)).toBe(false);
    });

    it('objeto absurdamente fundo NAO estoura a pilha — recusa e volta', () => {
      // A recursao nao pode virar a arma nova: sem o teto, isto trocaria o 500
      // do NUL por um 500 de `Maximum call stack size exceeded`.
      let fundo: unknown = 'folha';
      for (let i = 0; i < 200_000; i += 1) fundo = { dentro: fundo };
      expect(() => semCaractereDeControle(fundo)).not.toThrow();
      expect(semCaractereDeControle(fundo)).toBe(false);
    });
  });

  describe('o que tem de PASSAR — senao a correcao quebra vaga real', () => {
    it('tab, LF e CR passam: aparecem em descricao copiada de HTML', () => {
      expect(semCaractereDeControle('linha 1\nlinha 2\r\n\tindentado')).toBe(true);
    });

    it('texto normal, acento, emoji e RTL passam', () => {
      // O review do JOB-50 provou que emoji e RTL sao gravados como dado
      // literal. Esta correcao nao pode ter mudado isso.
      expect(semCaractereDeControle('Engenheiro Sênior 🚀 مرحبا')).toBe(true);
    });

    it('snapshot realista passa', () => {
      expect(
        semCaractereDeControle({
          salaryMin: 90000,
          salaryMax: 140000,
          currency: 'USD',
          salaryTrecho: 'We offer $90,000 - $140,000 USD.',
          nulo: null,
          lista: ['a', 'b'],
          booleano: true,
        }),
      ).toBe(true);
    });

    it('`null`, numero e booleano nao estouram', () => {
      // `typeof null === 'object'` e `Object.entries(null)` estoura — o guarda
      // explicito existe por isso.
      for (const valor of [null, undefined, 0, 42, true, false]) {
        expect(semCaractereDeControle(valor)).toBe(true);
      }
    });

    it('objeto no limite exato da profundidade passa', () => {
      // A fronteira do teto: no limite ainda se olha. Um `>=` no lugar do `>`
      // recusaria aqui, e um teto que recusa o que cabe e um teto errado.
      let fundo: unknown = 'folha-limpa';
      for (let i = 0; i < PROFUNDIDADE_MAXIMA_DO_SNAPSHOT - 1; i += 1) {
        fundo = { dentro: fundo };
      }
      expect(semCaractereDeControle(fundo)).toBe(true);
    });
  });

  describe('a regex nao guarda estado entre chamadas', () => {
    it('a MESMA string ruim e recusada duas vezes seguidas', () => {
      // A armadilha concreta: uma regex com a flag `g` guarda `lastIndex`, e a
      // segunda chamada comecaria do meio da string. O validador erraria
      // alternadamente — o pior modo de falha possivel, porque o teste de um
      // caso passa e o board real nao.
      const ruim = 'x'.repeat(50) + '\u0000';
      expect(semCaractereDeControle(ruim)).toBe(false);
      expect(semCaractereDeControle(ruim)).toBe(false);
      expect(semCaractereDeControle(ruim)).toBe(false);
    });
  });
});
