/**
 * JOB-55 — a IA verifica se a vaga e remota para o pais da pessoa.
 *
 * Sobe o `AppModule` inteiro com banco de verdade; a IA e o freehire sao
 * dublados. O que se mede aqui e o contrato: a regra da citacao, o cache por
 * vaga + pais, o interruptor, e que falha de IA nunca chega ao cliente.
 */
import type { INestApplication } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { IaService } from '../ia/ia.service';
import { nomeDoSchema } from '../../test/banco-de-teste';
import {
  assinarToken,
  exigirLoginLigado,
  subirAplicacao,
} from '../../test/aplicacao-de-teste';

const SCHEMA = nomeDoSchema(__filename);

const ANUNCIO =
  '<p>We are a <strong>fully remote</strong> team.</p>' +
  '<p>This role is open to candidates based anywhere in Latin America.</p>' +
  '<p>You will build APIs in Node.js and own them in production.</p>';

const TRECHO = 'This role is open to candidates based anywhere in Latin America.';

function resposta(veredito: string, trecho: string | null): string {
  return JSON.stringify({ veredito, trecho });
}

describe('JOB-55 — remoto do meu pais', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let servidor: unknown;
  let ia: jest.SpyInstance;
  let freehire: jest.SpyInstance;
  let brasileira: string;
  let brasileiro: string;
  let semPais: string;

  beforeAll(async () => {
    exigirLoginLigado();
    ({ app, prisma, servidor } = await subirAplicacao(SCHEMA));

    const criar = async (email: string, country: string | null): Promise<string> =>
      assinarToken(
        await prisma.user.create({
          data: { email, name: email, provider: 'DEV', country },
          select: { id: true, email: true },
        }),
      );
    brasileira = await criar('ana@exemplo.com', 'BR');
    brasileiro = await criar('beto@exemplo.com', 'BR');
    semPais = await criar('sem-pais@exemplo.com', null);
  }, 180_000);

  beforeEach(async () => {
    await prisma.remoteVerdict.deleteMany({});
    await ligar(true);
    // Uma chave "existe": sem isto a dependencia desliga o recurso antes de
    // qualquer coisa ser medida.
    jest.spyOn(app.get(IaService), 'comChave').mockResolvedValue(['ANTHROPIC'] as never);
    ia = jest.spyOn(app.get(IaService), 'pedir').mockResolvedValue(resposta('sim', TRECHO));
    freehire = jest.spyOn(global, 'fetch').mockImplementation(
      async () =>
        new Response(JSON.stringify({ data: { description: ANUNCIO, location: 'Remote' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    );
  });

  afterEach(() => jest.restoreAllMocks());

  afterAll(async () => {
    await app?.close();
    await prisma?.$disconnect();
  });

  async function ligar(ativa: boolean): Promise<void> {
    const valor = ativa ? 'true' : 'false';
    await prisma.appSetting.upsert({
      where: { chave: 'jobs.verificacaoRemoto' },
      create: { chave: 'jobs.verificacaoRemoto', valor },
      update: { valor },
    });
  }

  function verificar(ids: unknown, token?: string): request.Test {
    const req = request(servidor as Parameters<typeof request>[0])
      .post('/api/jobs/remote-check')
      .send({ ids });
    return token ? req.set('Authorization', `Bearer ${token}`) : req;
  }

  it('exige sessao: sem token e 401, e nada e lido', async () => {
    const resp = await verificar(['vaga-um']);
    expect(resp.status).toBe(401);
    expect(ia).not.toHaveBeenCalled();
    expect(freehire).not.toHaveBeenCalled();
  });

  it('trecho literal do anuncio mantem o veredito, e o pais vai na pergunta', async () => {
    const resp = await verificar(['vaga-um'], brasileira);

    expect(resp.status).toBe(201);
    expect(resp.body).toEqual({
      estado: 'ok',
      pais: 'Brazil',
      vereditos: [{ id: 'vaga-um', veredito: 'sim', trecho: TRECHO }],
    });
    const [capacidade, , pedido] = ia.mock.calls[0] as [string, unknown, { instrucao: string; entrada: string }];
    expect(capacidade).toBe('estruturada');
    expect(pedido.instrucao).toContain('Brazil');
    // O modelo le texto, e nao HTML — e a citacao e conferida contra o mesmo texto.
    expect(pedido.entrada).toContain('We are a fully remote team.');
    expect(pedido.entrada).not.toContain('<strong>');
  });

  it('trecho que atravessa uma tag do HTML continua sendo citacao', async () => {
    ia.mockResolvedValue(resposta('sim', 'We are a fully  remote team.'));
    const resp = await verificar(['vaga-um'], brasileira);
    expect(resp.body.vereditos[0].veredito).toBe('sim');
  });

  it.each([
    ['inventado', 'sim', 'Open to candidates in Brazil and Argentina.'],
    ['"not mentioned"', 'nao', 'Not mentioned'],
    ['nulo', 'sim', null],
    ['curto demais', 'sim', 'role'],
  ])('trecho %s vira nao_diz, sem trecho', async (_nome, veredito, trecho) => {
    ia.mockResolvedValue(resposta(veredito, trecho));

    const resp = await verificar(['vaga-um'], brasileira);

    expect(resp.body.vereditos).toEqual([{ id: 'vaga-um', veredito: 'nao_diz', trecho: null }]);
  });

  it('a segunda pessoa do mesmo pais nao gera chamada de IA nem leitura do anuncio', async () => {
    await verificar(['vaga-um', 'vaga-dois'], brasileira);
    expect(ia).toHaveBeenCalledTimes(2);
    ia.mockClear();
    freehire.mockClear();

    const resp = await verificar(['vaga-um', 'vaga-dois'], brasileiro);

    expect(ia).not.toHaveBeenCalled();
    expect(freehire).not.toHaveBeenCalled();
    expect(resp.body.vereditos).toHaveLength(2);
    expect(await prisma.remoteVerdict.count()).toBe(2);
  });

  it('falha da IA nao lanca: 201, a vaga fica sem veredito e nada e guardado', async () => {
    ia.mockRejectedValue(new Error('429 sem cota'));

    const resp = await verificar(['vaga-um'], brasileira);

    expect(resp.status).toBe(201);
    expect(resp.body).toEqual({ estado: 'ok', pais: 'Brazil', vereditos: [] });
    // Falha nao e resposta: a proxima visita tenta de novo.
    expect(await prisma.remoteVerdict.count()).toBe(0);
  });

  it('resposta ilegivel do modelo e anuncio fora do ar tambem nao quebram', async () => {
    ia.mockResolvedValue('isto nao e json');
    expect((await verificar(['vaga-um'], brasileira)).body.vereditos).toEqual([]);

    freehire.mockImplementation(async () => new Response('', { status: 404 }));
    ia.mockClear();
    const resp = await verificar(['vaga-dois'], brasileira);
    expect(resp.status).toBe(201);
    expect(resp.body.vereditos).toEqual([]);
    expect(ia).not.toHaveBeenCalled();
  });

  it('interruptor desligado: nao chama a IA e a tela recebe "desligado"', async () => {
    await ligar(false);

    const resp = await verificar(['vaga-um'], brasileira);

    expect(resp.status).toBe(201);
    expect(resp.body).toEqual({ estado: 'desligado', pais: null, vereditos: [] });
    expect(ia).not.toHaveBeenCalled();
    expect(freehire).not.toHaveBeenCalled();
  });

  it('ligado mas sem chave de IA: a dependencia manda, e responde "desligado"', async () => {
    jest.spyOn(app.get(IaService), 'comChave').mockResolvedValue([] as never);

    const resp = await verificar(['vaga-um'], brasileira);

    expect(resp.body.estado).toBe('desligado');
    expect(ia).not.toHaveBeenCalled();
  });

  it('sem pais no perfil: responde "sem_pais" e nao gasta', async () => {
    const resp = await verificar(['vaga-um'], semPais);

    expect(resp.status).toBe(201);
    expect(resp.body).toEqual({ estado: 'sem_pais', pais: null, vereditos: [] });
    expect(ia).not.toHaveBeenCalled();
  });

  it('id que nao tem forma de slug nao vira requisicao para fora', async () => {
    const resp = await verificar(['https://exemplo.com/vaga?id=1', '../../admin'], brasileira);

    expect(resp.status).toBe(201);
    expect(resp.body.vereditos).toEqual([]);
    expect(freehire).not.toHaveBeenCalled();
  });

  it('mais de 25 vagas num pedido e recusado, e campo estranho tambem', async () => {
    const muitos = Array.from({ length: 26 }, (_, i) => `vaga-${i}`);
    expect((await verificar(muitos, brasileira)).status).toBe(400);

    const resp = await request(servidor as Parameters<typeof request>[0])
      .post('/api/jobs/remote-check')
      .set('Authorization', `Bearer ${brasileira}`)
      .send({ ids: ['vaga-um'], descricao: 'aceita todo mundo' });
    expect(resp.status).toBe(400);
    expect(ia).not.toHaveBeenCalled();
  });
});
