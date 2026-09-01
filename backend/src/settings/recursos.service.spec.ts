/**
 * Camada 2 — `RecursosService.paraProduto()` contra um Postgres de verdade.
 *
 * ## O que o PLT-12 fecha, e por que o teste e sobre o CONJUNTO de chaves
 *
 * A rota aberta era a mesma que a de admin, filtrada. O JOB-33 e o JOB-36
 * acrescentaram `provedores`, `ordemDaIa` e `iaDaBusca` ao DTO, e o comentario
 * que justificava a abertura ("so um booleano aqui") envelheceu sem que nada
 * apontasse para ele: **usuario comum passou a receber os quatro ultimos
 * caracteres da chave do admin.**
 *
 * Por isso o teste central deste arquivo nao confere "tem os dois campos" —
 * ele confere que **nao ha um terceiro**. Um teste que so verificasse a
 * presenca de `leituraCvAtiva` e `historicoAtivo` passaria feliz com o `hint`
 * de volta ao lado deles, que e exatamente o defeito que o card nomeia.
 *
 * Os tres colaboradores de IA entram como dubles: `paraProduto` so pergunta a
 * eles "ha chave que sirva?", e subir a cadeia inteira traria seis SDKs para
 * responder um booleano.
 */
import type { PrismaClient } from '@prisma/client';
import { RecursosService } from './recursos.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { IaService } from '../ia/ia.service';
import type { OrdemDaIaService } from '../ia/ordem.service';
import type { SaudeDaIaService } from '../ia/saude.service';
import {
  clientDeTeste,
  exigirSchemaDeTeste,
  limpar,
  nomeDoSchema,
  prepararSchema,
} from '../../test/banco-de-teste';

const SCHEMA = nomeDoSchema(__filename);

/** As chaves das flags, como estao gravadas no banco. */
const LEITURA_CV = 'jobs.leituraCv';
const HISTORICO = 'jobs.historico';

describe('RecursosService.paraProduto (banco)', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prepararSchema(SCHEMA);
    prisma = clientDeTeste(SCHEMA);
    await exigirSchemaDeTeste(prisma, SCHEMA);
  }, 120_000);

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await limpar(prisma, SCHEMA);
  });

  /** O servico com um `IaService` que responde o que o teste mandar. */
  function servicoCom(temChaveDeIa: boolean): RecursosService {
    const ia = { disponivel: () => Promise.resolve(temChaveDeIa) } as unknown as IaService;
    const ordem = {} as OrdemDaIaService;
    const saude = {} as SaudeDaIaService;
    return new RecursosService(prisma as unknown as PrismaService, ia, ordem, saude);
  }

  async function gravarFlag(chave: string, valor: boolean): Promise<void> {
    await prisma.appSetting.create({ data: { chave, valor: valor ? 'true' : 'false' } });
  }

  /**
   * Uma chave de provedor gravada, com dono.
   *
   * `ApiToken` exige `userId` (a chave e de uma conta) e guarda o valor
   * cifrado em `secret` — o `hint` e o que a tela de admin mostra, e e
   * justamente o campo que vazou por meses antes do PLT-12.
   */
  async function criarChave(provider: 'ANTHROPIC' | 'OPENAI', hint: string): Promise<void> {
    const dono = await prisma.user.create({
      data: {
        email: `r${Math.random().toString(36).slice(2)}@teste.local`,
        name: 'Admin',
        provider: 'DEV',
      },
      select: { id: true },
    });
    await prisma.apiToken.create({
      data: { userId: dono.id, provider, secret: 'valor-cifrado-de-teste', hint },
    });
  }

  describe('a rota de produto devolve EXATAMENTE dois booleanos', () => {
    it('nao ha um terceiro campo — nem hint, nem provedores, nem ordem', async () => {
      await gravarFlag(LEITURA_CV, true);
      // Uma chave de IA gravada, com hint. Se ela vazar, o teste pega.
      await criarChave('ANTHROPIC', 'ABCD');

      const dto = await servicoCom(true).paraProduto();

      // O conjunto EXATO. Campo novo em `RecursosDeProdutoDto` quebra isto de
      // proposito: acrescentar um campo a rota aberta tem de ser uma decisao
      // deliberada, e nao um efeito colateral de mexer no DTO de admin.
      expect(Object.keys(dto).sort()).toEqual(['historicoAtivo', 'leituraCvAtiva']);

      // E os dois sao booleanos de verdade, e nao string 'true' do banco.
      expect(typeof dto.leituraCvAtiva).toBe('boolean');
      expect(typeof dto.historicoAtivo).toBe('boolean');
    });

    it('o hint da chave NAO aparece em lugar nenhum da resposta', async () => {
      await criarChave('OPENAI', 'sk99');

      const dto = await servicoCom(true).paraProduto();

      // Serializa e procura: pega o hint aninhado em qualquer profundidade,
      // que um `Object.keys` de primeiro nivel deixaria passar.
      expect(JSON.stringify(dto)).not.toContain('sk99');
      expect(JSON.stringify(dto)).not.toContain('cifrado');
    });
  });

  describe('a dependencia manda sobre a flag', () => {
    it('leitura de CV ligada MAS sem chave de IA devolve falso', async () => {
      await gravarFlag(LEITURA_CV, true);

      const dto = await servicoCom(false).paraProduto();

      // Oferecer o upload sem chave seria prometer o que falha no envio.
      expect(dto.leituraCvAtiva).toBe(false);
    });

    it('leitura de CV ligada COM chave devolve verdadeiro', async () => {
      await gravarFlag(LEITURA_CV, true);

      const dto = await servicoCom(true).paraProduto();

      expect(dto.leituraCvAtiva).toBe(true);
    });

    it('leitura de CV desligada com chave continua falso', async () => {
      await gravarFlag(LEITURA_CV, false);

      const dto = await servicoCom(true).paraProduto();

      expect(dto.leituraCvAtiva).toBe(false);
    });
  });

  describe('os defaults sao diferentes, e a diferenca e deliberada', () => {
    it('sem linha no banco, a leitura de CV nasce DESLIGADA', async () => {
      // Nada gravado. `flag()` responde false para ausente: o recurso depende
      // de chave paga, e ligar sozinho gastaria dinheiro de quem nao pediu.
      const dto = await servicoCom(true).paraProduto();

      expect(dto.leituraCvAtiva).toBe(false);
    });

    it('sem linha no banco, o historico nasce LIGADO', async () => {
      // `flagLigadaPorPadrao()`: nao depende de chave nem gasta nada, entao
      // desligado por omissao so privaria a pessoa do recurso.
      const dto = await servicoCom(true).paraProduto();

      expect(dto.historicoAtivo).toBe(true);
    });

    it('o historico desligado explicitamente fica desligado', async () => {
      await gravarFlag(HISTORICO, false);

      const dto = await servicoCom(true).paraProduto();

      expect(dto.historicoAtivo).toBe(false);
    });

    it('o historico com valor invalido no banco NAO liga sozinho', async () => {
      // Uma linha gravada a mao com lixo. `valor === 'true'` e a comparacao
      // certa: qualquer outra coisa e desligado, e nao "presente logo ligado".
      await prisma.appSetting.create({ data: { chave: HISTORICO, valor: 'sim' } });

      const dto = await servicoCom(true).paraProduto();

      expect(dto.historicoAtivo).toBe(false);
    });
  });

  describe('as duas flags sao independentes', () => {
    it('desligar o historico nao mexe na leitura de CV', async () => {
      await gravarFlag(LEITURA_CV, true);
      await gravarFlag(HISTORICO, false);

      const dto = await servicoCom(true).paraProduto();

      expect(dto.leituraCvAtiva).toBe(true);
      expect(dto.historicoAtivo).toBe(false);
    });

    it('desligar a leitura de CV nao mexe no historico', async () => {
      await gravarFlag(LEITURA_CV, false);
      await gravarFlag(HISTORICO, true);

      const dto = await servicoCom(true).paraProduto();

      expect(dto.leituraCvAtiva).toBe(false);
      expect(dto.historicoAtivo).toBe(true);
    });
  });
});
