import { cifrar, decifrar, SALT_TOKENS, SALT_DOCUMENTOS } from './crypto';

/**
 * O que se cobra da cifragem, e por que.
 *
 * A promessa do arquivo tem tres partes, e cada uma vira bloco aqui:
 *
 * 1. o que entra volta igual — com o MESMO salt;
 * 2. **salts diferentes nao se decifram entre si**, que e o ponto do PLT-09:
 *    quem quebrar os tokens de IA nao ganha nada contra os documentos;
 * 3. valor adulterado **falha alto** em vez de devolver lixo — e o que o
 *    AES-GCM compra, e a razao de nao ser AES-CBC.
 *
 * Nenhum teste depende do que outro cifrou: cada um cifra o proprio valor.
 */

const CHAVE = 'chave-de-teste-com-mais-de-16-caracteres';

describe('cifrar/decifrar', () => {
  const AMBIENTE = process.env;

  beforeEach(() => {
    process.env = { ...AMBIENTE, ENCRYPTION_KEY: CHAVE };
  });

  afterEach(() => {
    process.env = AMBIENTE;
  });

  describe('o que entra volta igual', () => {
    it.each([
      ['um token de API', 'sk-proj-abc123XYZ'],
      ['um CPF', '12345678909'],
      ['texto com acento', 'Jose da Silva Ção'],
      ['texto com emoji', 'chave 🔑 secreta'],
      ['string vazia', ''],
      ['um caractere', 'a'],
      ['texto longo', 'x'.repeat(10000)],
      ['quebra de linha', 'linha1\nlinha2\r\nlinha3'],
      ['os separadores do formato', 'a:b:c:d'],
    ])('%s volta identico', (_nome, valor) => {
      expect(decifrar(cifrar(valor, SALT_TOKENS), SALT_TOKENS)).toBe(valor);
    });
  });

  describe('o texto cifrado nao entrega o original', () => {
    it('o segredo nao aparece no resultado', () => {
      const segredo = 'sk-proj-segredo-muito-secreto';
      expect(cifrar(segredo, SALT_TOKENS)).not.toContain(segredo);
    });

    it('cifrar o MESMO valor duas vezes da resultados diferentes', () => {
      // O IV e aleatorio a cada chamada. Sem isso, dois usuarios com a mesma
      // chave de API teriam a mesma linha no banco, e daria para comparar.
      const a = cifrar('mesmo-valor', SALT_TOKENS);
      const b = cifrar('mesmo-valor', SALT_TOKENS);
      expect(a).not.toBe(b);
      // E ainda assim os dois decifram para o mesmo texto.
      expect(decifrar(a, SALT_TOKENS)).toBe(decifrar(b, SALT_TOKENS));
    });

    it('grava em tres partes base64url, sem caractere que quebre URL ou JSON', () => {
      const guardado = cifrar('valor', SALT_TOKENS);
      const partes = guardado.split(':');
      expect(partes).toHaveLength(3);
      // base64url nao tem '+', '/' nem '='.
      expect(guardado).toMatch(/^[A-Za-z0-9_:-]+$/);
    });
  });

  describe('salts diferentes nao se decifram entre si (PLT-09)', () => {
    it('o que foi cifrado como token NAO decifra como documento', () => {
      // A garantia central: quebrar um dominio nao entrega o outro.
      const guardado = cifrar('12345678909', SALT_TOKENS);
      expect(() => decifrar(guardado, SALT_DOCUMENTOS)).toThrow();
    });

    it('o que foi cifrado como documento NAO decifra como token', () => {
      const guardado = cifrar('sk-proj-abc', SALT_DOCUMENTOS);
      expect(() => decifrar(guardado, SALT_TOKENS)).toThrow();
    });

    it('um salt qualquer inventado tambem nao abre', () => {
      const guardado = cifrar('valor', SALT_TOKENS);
      expect(() => decifrar(guardado, 'salt.inventado')).toThrow();
    });

    it('os dois salts do sistema sao diferentes entre si', () => {
      // Se um dia forem iguais, o isolamento acima deixa de existir em
      // silencio — e nenhum outro teste notaria.
      expect(SALT_TOKENS).not.toBe(SALT_DOCUMENTOS);
    });

    it('cada salt continua abrindo o proprio dominio', () => {
      expect(decifrar(cifrar('a', SALT_TOKENS), SALT_TOKENS)).toBe('a');
      expect(decifrar(cifrar('b', SALT_DOCUMENTOS), SALT_DOCUMENTOS)).toBe('b');
    });
  });

  describe('valor adulterado falha alto, em vez de devolver lixo', () => {
    it('conteudo trocado nao decifra', () => {
      // E o que o GCM compra: autenticacao, e nao so cifragem.
      const [iv, tag] = cifrar('valor-original', SALT_TOKENS).split(':');
      const outro = cifrar('valor-plantado', SALT_TOKENS).split(':')[2];
      expect(() => decifrar([iv, tag, outro].join(':'), SALT_TOKENS)).toThrow();
    });

    it('tag de autenticacao trocada nao decifra', () => {
      const [iv, , conteudo] = cifrar('valor', SALT_TOKENS).split(':');
      const outraTag = cifrar('outro', SALT_TOKENS).split(':')[1];
      expect(() => decifrar([iv, outraTag, conteudo].join(':'), SALT_TOKENS)).toThrow();
    });

    it('IV trocado nao decifra', () => {
      const [, tag, conteudo] = cifrar('valor', SALT_TOKENS).split(':');
      const outroIv = cifrar('outro', SALT_TOKENS).split(':')[0];
      expect(() => decifrar([outroIv, tag, conteudo].join(':'), SALT_TOKENS)).toThrow();
    });

    it.each([
      ['sem separador nenhum', 'abcdef'],
      ['com duas partes', 'abc:def'],
      ['com quatro partes', 'a:b:c:d'],
      ['vazio', ''],
    ])('formato invalido %s e recusado', (_nome, guardado) => {
      expect(() => decifrar(guardado, SALT_TOKENS)).toThrow(
        'Valor guardado em formato invalido',
      );
    });
  });

  describe('a chave de cifragem vem do ambiente', () => {
    it('sem ENCRYPTION_KEY, cifrar lanca em vez de gravar em texto claro', () => {
      // Guardar token em claro por descuido de configuracao seria pior que nao
      // ter a funcionalidade.
      delete process.env.ENCRYPTION_KEY;
      expect(() => cifrar('valor', SALT_TOKENS)).toThrow(/ENCRYPTION_KEY/);
    });

    it('com ENCRYPTION_KEY curta demais, cifrar lanca', () => {
      process.env.ENCRYPTION_KEY = 'curta';
      expect(() => cifrar('valor', SALT_TOKENS)).toThrow(/ENCRYPTION_KEY/);
    });

    it('sem ENCRYPTION_KEY, decifrar tambem lanca', () => {
      const guardado = cifrar('valor', SALT_TOKENS);
      delete process.env.ENCRYPTION_KEY;
      expect(() => decifrar(guardado, SALT_TOKENS)).toThrow(/ENCRYPTION_KEY/);
    });

    it('trocar a ENCRYPTION_KEY torna ilegivel o que ja foi gravado', () => {
      // Consequencia documentada: e o que faz a chave ser permanente em
      // producao. O teste existe para que ninguem se surpreenda com isso.
      const guardado = cifrar('valor', SALT_TOKENS);
      process.env.ENCRYPTION_KEY = 'outra-chave-completamente-diferente';
      expect(() => decifrar(guardado, SALT_TOKENS)).toThrow();
    });
  });
});
