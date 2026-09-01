import { Logger } from '@nestjs/common';
import { AuthService, authDesligada } from './auth.service';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * `papelPara` e a armadilha do PLT-11, e por isso ela e testada aqui.
 *
 * A regra vem do card, e nao da leitura da funcao:
 *
 * ```
 * esta em ADMIN_EMAILS?      -> ADMIN        (a variavel ganha sempre)
 * senao, e MANAGER no banco?  -> MANAGER      (respeita a promocao pela tela)
 * senao                       -> COMMON_USER
 * ```
 *
 * As duas garantias que o card exige:
 *
 * - **sair do ADMIN_EMAILS tira o papel**, e cai para `COMMON_USER`, nao para
 *   `MANAGER` — quem tirou o admin decide se quer dar outro papel;
 * - **ninguem vira admin promovendo-se no banco**, porque `ADMIN` na coluna sem
 *   estar na variavel nao entra em nenhum ramo.
 *
 * O bug que existiu: a forma antiga (`ehAdmin ? ADMIN : USER`) apagava o
 * MANAGER a cada login — o dono promovia pela tela, a pessoa entrava, e voltava
 * a ser comum sem erro nenhum no log.
 */

/**
 * O servico sem banco: `papelPara` nao toca no Prisma.
 *
 * O construtor exige JWT_SECRET, entao ele e posto antes. O `papelPara` e
 * privado de proposito — nao ha razao de produto para exporta-lo, e o teste
 * alcanca por indice sem afrouxar a visibilidade no codigo que vai para o ar.
 */
function servico(): AuthService {
  const prismaFalso = {} as PrismaService;
  return new AuthService(prismaFalso);
}

/**
 * O construtor avisa que GOOGLE_CLIENT_ID nao esta definida, e cada `servico()`
 * repete o aviso. Sao dezenas de linhas de log escondendo o resultado da
 * suite, entao o Logger do Nest fica calado aqui — e so nesta suite.
 */
beforeAll(() => {
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
});

afterAll(() => {
  jest.restoreAllMocks();
});

function papelPara(svc: AuthService, email: string, papelAtual: string | null): string {
  return (svc as unknown as {
    papelPara(email: string, papelAtual: string | null): string;
  }).papelPara(email, papelAtual);
}

describe('AuthService.papelPara', () => {
  const AMBIENTE = process.env;

  beforeEach(() => {
    // Cada teste monta o proprio ambiente: nenhum depende do que outro deixou.
    process.env = { ...AMBIENTE, JWT_SECRET: 'segredo-de-teste-com-16+' };
  });

  afterEach(() => {
    process.env = AMBIENTE;
  });

  describe('ADMIN_EMAILS ganha sempre', () => {
    it('quem esta na lista vira ADMIN, mesmo sendo conta nova', () => {
      process.env.ADMIN_EMAILS = 'dono@exemplo.com';
      expect(papelPara(servico(), 'dono@exemplo.com', null)).toBe('ADMIN');
    });

    it('quem esta na lista vira ADMIN mesmo estando como COMMON_USER no banco', () => {
      process.env.ADMIN_EMAILS = 'dono@exemplo.com';
      expect(papelPara(servico(), 'dono@exemplo.com', 'COMMON_USER')).toBe('ADMIN');
    });

    it('a lista aceita varios e-mails separados por virgula', () => {
      process.env.ADMIN_EMAILS = 'a@x.com,b@x.com,c@x.com';
      const svc = servico();
      expect(papelPara(svc, 'a@x.com', null)).toBe('ADMIN');
      expect(papelPara(svc, 'b@x.com', null)).toBe('ADMIN');
      expect(papelPara(svc, 'c@x.com', null)).toBe('ADMIN');
    });

    it('a lista tolera espaco em volta do e-mail', () => {
      // "a@x.com, b@x.com" e como uma pessoa escreve a variavel de verdade.
      process.env.ADMIN_EMAILS = ' a@x.com , b@x.com ';
      const svc = servico();
      expect(papelPara(svc, 'a@x.com', null)).toBe('ADMIN');
      expect(papelPara(svc, 'b@x.com', null)).toBe('ADMIN');
    });

    it('a comparacao ignora a caixa da variavel', () => {
      process.env.ADMIN_EMAILS = 'Dono@Exemplo.COM';
      expect(papelPara(servico(), 'dono@exemplo.com', null)).toBe('ADMIN');
    });
  });

  describe('sem ADMIN_EMAILS, ninguem e admin', () => {
    it('variavel ausente nao promove ninguem', () => {
      delete process.env.ADMIN_EMAILS;
      expect(papelPara(servico(), 'qualquer@x.com', null)).toBe('COMMON_USER');
    });

    it('variavel vazia nao promove ninguem', () => {
      // Default de seguranca e "ninguem", nao "eu".
      process.env.ADMIN_EMAILS = '';
      expect(papelPara(servico(), 'qualquer@x.com', null)).toBe('COMMON_USER');
    });

    it('variavel so com virgulas nao promove ninguem', () => {
      process.env.ADMIN_EMAILS = ' , , ';
      expect(papelPara(servico(), '', null)).toBe('COMMON_USER');
      expect(papelPara(servico(), 'qualquer@x.com', null)).toBe('COMMON_USER');
    });
  });

  describe('o MANAGER promovido pela tela sobrevive ao login (PLT-11)', () => {
    it('MANAGER no banco continua MANAGER quando nao esta em ADMIN_EMAILS', () => {
      // ESTE e o bug do PLT-11: a forma antiga devolvia COMMON_USER aqui, e a
      // promocao feita pela tela sumia no login seguinte, sem erro no log.
      process.env.ADMIN_EMAILS = 'outro@x.com';
      expect(papelPara(servico(), 'gerente@x.com', 'MANAGER')).toBe('MANAGER');
    });

    it('MANAGER sobrevive mesmo sem ADMIN_EMAILS nenhuma', () => {
      delete process.env.ADMIN_EMAILS;
      expect(papelPara(servico(), 'gerente@x.com', 'MANAGER')).toBe('MANAGER');
    });

    it('ADMIN_EMAILS ainda ganha do MANAGER do banco', () => {
      process.env.ADMIN_EMAILS = 'gerente@x.com';
      expect(papelPara(servico(), 'gerente@x.com', 'MANAGER')).toBe('ADMIN');
    });
  });

  describe('ninguem vira admin escrevendo no banco', () => {
    it('ADMIN na coluna, fora da variavel, cai para COMMON_USER', () => {
      // Promover direto no banco nao sobrevive ao proximo login — e a garantia
      // que impede escalar privilegio por acesso ao Postgres.
      process.env.ADMIN_EMAILS = 'dono@x.com';
      expect(papelPara(servico(), 'esperto@x.com', 'ADMIN')).toBe('COMMON_USER');
    });

    it('ADMIN na coluna sem ADMIN_EMAILS nenhuma tambem cai', () => {
      delete process.env.ADMIN_EMAILS;
      expect(papelPara(servico(), 'esperto@x.com', 'ADMIN')).toBe('COMMON_USER');
    });
  });

  describe('sair do ADMIN_EMAILS cai para COMMON_USER, e nao para MANAGER', () => {
    it('o ex-admin vira comum, nao gerente', () => {
      // A regra explicita do card: quem tirou o admin decide se quer dar outro
      // papel. Cair em MANAGER daria um papel que ninguem concedeu.
      process.env.ADMIN_EMAILS = 'outro@x.com';
      expect(papelPara(servico(), 'ex-admin@x.com', 'ADMIN')).toBe('COMMON_USER');
    });

    it('a sequencia completa: entra na lista, sai da lista', () => {
      const email = 'pessoa@x.com';

      process.env.ADMIN_EMAILS = email;
      const virouAdmin = papelPara(servico(), email, null);
      expect(virouAdmin).toBe('ADMIN');

      // O dono tira o e-mail da variavel e reinicia a API.
      process.env.ADMIN_EMAILS = '';
      expect(papelPara(servico(), email, virouAdmin)).toBe('COMMON_USER');
    });
  });

  describe('papel desconhecido no banco nao e preservado', () => {
    it.each(['SUPERUSER', 'root', 'manager', 'MANAGER ', ''])(
      'o papel %p vira COMMON_USER',
      (papel) => {
        // So a string exata 'MANAGER' e preservada. Qualquer outra coisa na
        // coluna — inclusive minuscula ou com espaco — nao concede nada.
        delete process.env.ADMIN_EMAILS;
        expect(papelPara(servico(), 'x@x.com', papel)).toBe('COMMON_USER');
      },
    );
  });
});

describe('authDesligada', () => {
  const AMBIENTE = process.env;

  beforeEach(() => {
    process.env = { ...AMBIENTE };
  });

  afterEach(() => {
    process.env = AMBIENTE;
  });

  it('so a string exata "true" desliga o login', () => {
    process.env.AUTH_DISABLED = 'true';
    expect(authDesligada()).toBe(true);
  });

  it.each(['false', 'TRUE', 'True', '1', 'yes', 'sim', ''])(
    'o valor %p NAO desliga o login',
    (valor) => {
      // Esquecer a variavel — ou escreve-la errado — fecha o acesso, nunca
      // abre. E a regra do CLAUDE.md, e ela vale para todo valor ambiguo.
      process.env.AUTH_DISABLED = valor;
      expect(authDesligada()).toBe(false);
    },
  );

  it('variavel ausente mantem o login ligado', () => {
    delete process.env.AUTH_DISABLED;
    expect(authDesligada()).toBe(false);
  });
});
