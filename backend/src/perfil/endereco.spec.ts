import { validarTextoDeEndereco, validarCodigoPostal } from './endereco';

/**
 * O endereco vale pelo que ele NAO recusa.
 *
 * A regra escrita no cabecalho de `endereco.ts` e explicita: campos separados
 * com validacao frouxa, alfabeto latino ESTENDIDO, e nenhuma conferencia do
 * codigo postal contra o pais. Os testes abaixo cobram exatamente isso — a
 * falha que importa aqui e recusar quem mora onde o formato e outro, e nao
 * aceitar um endereco estranho.
 */

describe('validarTextoDeEndereco — quem tem de passar', () => {
  it('aceita vazio: nenhum campo do endereco e obrigatorio (PLT-10)', () => {
    expect(validarTextoDeEndereco('City', '', 80)).toBeNull();
    expect(validarTextoDeEndereco('City', '   ', 80)).toBeNull();
  });

  it.each([
    ['Bogotá', 'acento no publico-alvo colombiano'],
    ['São Paulo', 'til, e a cidade mais provavel do publico'],
    ['Ñuñoa', 'N com til, comuna de Santiago'],
    ['Córdoba', 'acento, Argentina'],
    ['Medellín', 'acento, Colombia'],
    ['Brasília', 'acento'],
  ])('aceita a cidade real %s (%s)', (cidade) => {
    // Um [A-Za-z] recusaria as seis — e sao nomes de cidade do publico-alvo.
    expect(validarTextoDeEndereco('City', cidade, 80)).toBeNull();
  });

  it.each([
    ["Avenida O'Higgins 1234", 'apostrofo, avenida chilena'],
    ['Calle 26 #13-19', 'o # usado na Colombia'],
    ['Rua das Flores, 100 - 1º andar', 'o indicador ordinal º'],
    ['Av. Paulista, 1000', 'ponto e virgula'],
    ['Km 5,5 s/n', 'a barra de "sem numero"'],
  ])('aceita o logradouro real %s (%s)', (rua) => {
    expect(validarTextoDeEndereco('Street', rua, 120)).toBeNull();
  });

  it('nao exige numero nem ordem: ha endereco rural sem numero', () => {
    expect(validarTextoDeEndereco('Street', 'Estrada da Serra', 120)).toBeNull();
  });

  it('aceita texto no limite exato do comprimento', () => {
    expect(validarTextoDeEndereco('City', 'a'.repeat(80), 80)).toBeNull();
  });

  it('conta o comprimento depois do trim', () => {
    // Espaco em volta nao pode consumir o limite de quem cabe.
    expect(validarTextoDeEndereco('City', '  ' + 'a'.repeat(80) + '  ', 80)).toBeNull();
  });
});

describe('validarTextoDeEndereco — quem tem de ser recusado', () => {
  it('recusa acima do limite, dizendo o rotulo e o maximo', () => {
    expect(validarTextoDeEndereco('City', 'a'.repeat(81), 80)).toBe(
      'City is too long (max 80)',
    );
  });

  it('usa o rotulo recebido na mensagem, para a tela apontar o campo certo', () => {
    expect(validarTextoDeEndereco('State', 'a'.repeat(10), 5)).toBe(
      'State is too long (max 5)',
    );
  });

  it.each(['<script>alert(1)</script>', 'rua@casa', 'rua"aspas"', 'rua\\barra', 'a{b}'])(
    'recusa %s, que barra colar coisa no campo errado',
    (valor) => {
      expect(validarTextoDeEndereco('Street', valor, 120)).not.toBeNull();
    },
  );

  it('a mensagem de alfabeto e em ingles e nomeia o campo', () => {
    const msg = validarTextoDeEndereco('Street', 'rua@casa', 120);
    expect(msg).toContain('Street');
    // Texto de tela nasce em ingles. O travessao e tipografia legitima, entao
    // o que se cobra e a ausencia de acento — que so apareceria em portugues.
    expect(msg).not.toMatch(/[áàâãéêíóôõúüçÁÀÂÃÉÊÍÓÔÕÚÜÇ]/);
  });
});

describe('validarCodigoPostal', () => {
  it('aceita vazio', () => {
    expect(validarCodigoPostal('')).toBeNull();
    expect(validarCodigoPostal('   ')).toBeNull();
  });

  it.each([
    ['01310-100', 'CEP brasileiro'],
    ['C1425DKE', 'Argentina, alfanumerico desde 1998'],
    ['15001', 'Peru, 5 digitos'],
    ['110111', 'Colombia'],
    ['8320000', 'Chile'],
    ['SW1A 1AA', 'Reino Unido, com espaco'],
    ['1234 AB', 'Holanda'],
  ])('aceita %s (%s) sem conferir contra o pais', (cep) => {
    // A regra do card: recusar um codigo postal valido de um pais nao modelado
    // e pior que aceitar um estranho.
    expect(validarCodigoPostal(cep)).toBeNull();
  });

  it('aceita nos dois extremos de comprimento', () => {
    expect(validarCodigoPostal('12')).toBeNull();
    expect(validarCodigoPostal('a'.repeat(16))).toBeNull();
  });

  it('recusa curto e longo demais, com a mensagem de comprimento', () => {
    expect(validarCodigoPostal('1')).toBe('Postal code must be 2 to 16 characters');
    expect(validarCodigoPostal('a'.repeat(17))).toBe(
      'Postal code must be 2 to 16 characters',
    );
  });

  it('recusa o que nao e letra, digito, espaco ou traco', () => {
    expect(validarCodigoPostal('01310.100')).not.toBeNull();
    expect(validarCodigoPostal('12#45')).not.toBeNull();
    expect(validarCodigoPostal('12/45')).not.toBeNull();
  });

  it('recusa separador na borda, que e digitacao pela metade', () => {
    expect(validarCodigoPostal('-1234')).not.toBeNull();
    expect(validarCodigoPostal('1234-')).not.toBeNull();
  });
});
