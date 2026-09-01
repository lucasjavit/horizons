/**
 * Camada 3 — **a matriz de papeis**, pela API de verdade.
 *
 * As 11 checagens que viviam no `scripts/qa-rapido.py` e dependiam da
 * aplicacao de pe. Aqui elas rodam no `npm test`, e ganham o que o script nao
 * podia ter:
 *
 * - **o usuario de cada papel e criado pela suite**, em vez de procurado no
 *   banco. Em 31/08 o script tinha 8 checagens se pulando em silencio porque o
 *   papel `USER` virou `COMMON_USER` numa migration e o `select ... where role
 *   = 'USER'` deixou de achar linha — o bloco caia no `skip` e nada falhava
 *   (CLAUDE.md). Criando, nao ha o que nao achar.
 * - **nenhum teste depende do que outro criou**: o `limpar()` roda entre eles.
 *
 * O corte que a matriz mede e o do PLT-09, em uma frase: **Manager opera,
 * Admin configura.** Ver a lista e desligar uma conta abusiva e operar; mudar
 * o papel de alguem e configurar.
 */
import type { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { limpar, nomeDoSchema } from '../../test/banco-de-teste';
import {
  assinarToken,
  exigirLoginLigado,
  subirAplicacao,
  type AplicacaoDeTeste,
} from '../../test/aplicacao-de-teste';

const SCHEMA = nomeDoSchema(__filename);

/**
 * As rotas de `/config`, que so o ADMIN alcanca.
 *
 * A lista existe porque o defeito que ela cobre nasceu de um comentario que
 * envelheceu: `GET /settings/recursos` era aberto quando so devolvia um
 * booleano, e continuou aberto quando passou a devolver o `hint` das chaves e a
 * ordem da cadeia de IA (PLT-12). Nada apontava para a frase desatualizada.
 * Aqui aponta.
 */
const SO_ADMIN = [
  'GET /api/settings/recursos',
  'GET /api/settings/tokens',
  'GET /api/settings/deploy/prontidao',
  'GET /api/jobs/descobertas',
  'GET /api/email/metricas',
];

describe('matriz de papeis (camada 3)', () => {
  let ctx: AplicacaoDeTeste;
  let prisma: PrismaClient;

  beforeAll(async () => {
    exigirLoginLigado();
    ctx = await subirAplicacao(SCHEMA);
    prisma = ctx.prisma;
  }, 180_000);

  afterAll(async () => {
    await ctx?.app.close();
    await prisma?.$disconnect();
  });

  beforeEach(async () => {
    await limpar(prisma, SCHEMA);
  });

  let n = 0;
  /** Cria a conta E o token dela. O papel vem do banco, que e quem decide. */
  async function conta(role: string): Promise<{ id: string; email: string; token: string }> {
    n += 1;
    const email = `p${n}.${Math.random().toString(36).slice(2)}@teste.local`;
    const u = await prisma.user.create({
      data: { email, name: `Pessoa ${n}`, provider: 'DEV', role },
      select: { id: true, email: true, role: true },
    });
    return { id: u.id, email: u.email, token: assinarToken(u) };
  }

  function pedir(caminho: string, token?: string): request.Test {
    const [verbo, rota] = caminho.split(' ');
    const agente = request(ctx.servidor as Parameters<typeof request>[0]);
    const req = verbo === 'GET' ? agente.get(rota) : agente.post(rota);
    return token ? req.set('Authorization', `Bearer ${token}`) : req;
  }

  describe('anonimo — 401 em tudo que guarda dado de alguem', () => {
    it.each(SO_ADMIN)('%s sem token responde 401', async (rota) => {
      const resp = await pedir(rota);
      expect(resp.status).toBe(401);
    });

    it('GET /api/usuarios sem token responde 401', async () => {
      const resp = await pedir('GET /api/usuarios');
      expect(resp.status).toBe(401);
    });

    it('401 e nao 403: quem nao entrou nao recebe "voce nao pode"', async () => {
      // A diferenca importa para a tela: 401 manda entrar, 403 diz que entrar
      // nao adianta. Trocar os dois faria a tela oferecer o gesto errado.
      const resp = await pedir('GET /api/settings/tokens');
      expect(resp.status).toBe(401);
      expect(resp.status).not.toBe(403);
    });
  });

  describe('COMMON_USER — 403 em tudo de administracao', () => {
    it.each(SO_ADMIN)('%s nega o usuario comum com 403', async (rota) => {
      const { token } = await conta('COMMON_USER');
      const resp = await pedir(rota, token);
      expect(resp.status).toBe(403);
    });

    it('GET /api/usuarios nega o usuario comum — a gestao tem TRES niveis', async () => {
      // Este e invisivel na tela: a listagem nao pode ser @AdminOnly() (o
      // manager ve), e um decorador trocado por engano abriria a lista de todo
      // mundo — ou deixaria o manager de fora sem ninguem notar.
      const { token } = await conta('COMMON_USER');
      const resp = await pedir('GET /api/usuarios', token);
      expect(resp.status).toBe(403);
    });

    it('mas alcanca o que e dele: /api/auth/me e /api/perfil', async () => {
      // O contrapositivo. Sem ele, um guard que negasse tudo a quem nao e
      // admin passaria nos testes acima e derrubaria o produto inteiro.
      const { token, id } = await conta('COMMON_USER');

      const me = await pedir('GET /api/auth/me', token);
      expect(me.status).toBe(200);
      expect(me.body.id).toBe(id);

      const perfil = await pedir('GET /api/perfil', token);
      expect(perfil.status).toBe(200);
    });

    it('e a rota de PRODUTO o atende — a aba Jobs depende dela', async () => {
      const { token } = await conta('COMMON_USER');
      const resp = await pedir('GET /api/settings/recursos/produto', token);
      expect(resp.status).toBe(200);
    });
  });

  describe('MANAGER — opera, mas nao configura', () => {
    it('ve a lista de usuarios', async () => {
      const { token } = await conta('MANAGER');
      const resp = await pedir('GET /api/usuarios', token);
      expect(resp.status).toBe(200);
      expect(Array.isArray(resp.body.itens)).toBe(true);
    });

    it('NAO muda papel de ninguem — isso e configurar', async () => {
      const manager = await conta('MANAGER');
      const alvo = await conta('COMMON_USER');

      const resp = await request(ctx.servidor as Parameters<typeof request>[0])
        .patch(`/api/usuarios/${alvo.id}/papel`)
        .set('Authorization', `Bearer ${manager.token}`)
        .send({ role: 'MANAGER' });

      expect(resp.status).toBe(403);
      // E o banco nao mudou: a recusa e antes da gravacao.
      const depois = await prisma.user.findUnique({
        where: { id: alvo.id },
        select: { role: true },
      });
      expect(depois?.role).toBe('COMMON_USER');
    });

    /**
     * ⚠️ **Quem recusou foi o GUARD, e nao so o servico.**
     *
     * Medido em 01/09/2026: tirar o `@AdminOnly()` de `PATCH :id/papel` **nao
     * quebrava o teste acima**. O `UsuariosService.mudarPapel` recusa o
     * manager por conta propria, entao a resposta continuava 403 — a protecao
     * em profundidade segurava, e o teste nao via a diferenca.
     *
     * Isso e bom (duas barreiras, nao uma) e perigoso ao mesmo tempo: o
     * decorador poderia ser removido por engano num refactor e nenhum teste
     * apontaria. A rota ficaria protegida **por acidente** — dependendo de uma
     * regra escrita para outro fim, num arquivo que ninguem associa a
     * autorizacao.
     *
     * Este teste separa as duas camadas pela MENSAGEM. O guard responde a
     * frase do `AuthGuard`; o servico responde a sua. Sao textos diferentes, e
     * e a unica evidencia observavel de qual das duas atendeu.
     */
    it('e quem recusa e o GUARD — a barreira da rota, nao so a do servico', async () => {
      const manager = await conta('MANAGER');
      const alvo = await conta('COMMON_USER');

      const resp = await request(ctx.servidor as Parameters<typeof request>[0])
        .patch(`/api/usuarios/${alvo.id}/papel`)
        .set('Authorization', `Bearer ${manager.token}`)
        .send({ role: 'MANAGER' });

      expect(resp.status).toBe(403);
      // A frase do guard, de `AuthGuard.canActivate`. Se o `@AdminOnly()` sair
      // da rota, quem responde passa a ser o servico — com outra mensagem — e
      // este teste falha avisando qual barreira sumiu.
      expect(resp.body.message).toBe('Esta acao e restrita a administradores.');
    });

    it('DESATIVA um comum — isso e operar', async () => {
      const manager = await conta('MANAGER');
      const alvo = await conta('COMMON_USER');

      const resp = await request(ctx.servidor as Parameters<typeof request>[0])
        .patch(`/api/usuarios/${alvo.id}/ativo`)
        .set('Authorization', `Bearer ${manager.token}`)
        .send({ active: false });

      expect(resp.status).toBe(200);
      const depois = await prisma.user.findUnique({
        where: { id: alvo.id },
        select: { active: true },
      });
      expect(depois?.active).toBe(false);
    });

    it.each(SO_ADMIN)('%s continua negado ao manager', async (rota) => {
      const { token } = await conta('MANAGER');
      const resp = await pedir(rota, token);
      expect(resp.status).toBe(403);
    });
  });

  describe('ADMIN — alcanca a administracao', () => {
    it.each(SO_ADMIN)('%s atende o admin', async (rota) => {
      const { token } = await conta('ADMIN');
      const resp = await pedir(rota, token);
      // 200 e o esperado; o que nao pode e 401/403. Uma rota que consulte
      // servico externo pode devolver 500 num ambiente sem rede, e isso nao e
      // falha de papel — mas negar acesso e.
      expect([401, 403]).not.toContain(resp.status);
    });

    it('ninguem vira ADMIN pela API, nem por mao de admin', async () => {
      // O papel de admin vem do ADMIN_EMAILS, reavaliado a cada login. Um
      // caminho pela API criaria a segunda fonte de verdade que o proximo
      // login desfaz — a pessoa apareceria como admin ate entrar de novo.
      const admin = await conta('ADMIN');
      const alvo = await conta('COMMON_USER');

      const resp = await request(ctx.servidor as Parameters<typeof request>[0])
        .patch(`/api/usuarios/${alvo.id}/papel`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ role: 'ADMIN' });

      // 400 e nao 403: o `@IsIn` do DTO barra antes de chegar ao servico.
      expect(resp.status).toBe(400);
      const depois = await prisma.user.findUnique({
        where: { id: alvo.id },
        select: { role: true },
      });
      expect(depois?.role).toBe('COMMON_USER');
    });

    it('o dono nao se rebaixa — perderia a tela que o traria de volta', async () => {
      const admin = await conta('ADMIN');

      const resp = await request(ctx.servidor as Parameters<typeof request>[0])
        .patch(`/api/usuarios/${admin.id}/papel`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ role: 'COMMON_USER' });

      expect(resp.status).toBe(403);
      const depois = await prisma.user.findUnique({
        where: { id: admin.id },
        select: { role: true },
      });
      expect(depois?.role).toBe('ADMIN');
    });

    it('o dono nao se desativa', async () => {
      const admin = await conta('ADMIN');

      const resp = await request(ctx.servidor as Parameters<typeof request>[0])
        .patch(`/api/usuarios/${admin.id}/ativo`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ active: false });

      expect(resp.status).toBe(403);
      const depois = await prisma.user.findUnique({
        where: { id: admin.id },
        select: { active: true },
      });
      expect(depois?.active).toBe(true);
    });

    it('promove a MANAGER, e isso grava', async () => {
      const admin = await conta('ADMIN');
      const alvo = await conta('COMMON_USER');

      const resp = await request(ctx.servidor as Parameters<typeof request>[0])
        .patch(`/api/usuarios/${alvo.id}/papel`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ role: 'MANAGER' });

      expect(resp.status).toBe(200);
      expect(resp.body.role).toBe('MANAGER');
    });
  });

  describe('o papel vem do BANCO, e nao do token', () => {
    it('token dizendo ADMIN sobre uma linha COMMON_USER e negado', async () => {
      // A razao de o guard pagar um SELECT por request (CLAUDE.md): o token e
      // uma alegacao, o banco decide. Sem isto, quem conseguisse assinar um
      // token viraria admin sem tocar no banco.
      const { id, email } = await conta('COMMON_USER');
      const mentiroso = assinarToken({ id, email, role: 'ADMIN' });

      const resp = await pedir('GET /api/settings/tokens', mentiroso);
      expect(resp.status).toBe(403);
    });

    it('rebaixar no banco vale na requisicao SEGUINTE, sem esperar o token expirar', async () => {
      const admin = await conta('ADMIN');

      const antes = await pedir('GET /api/settings/tokens', admin.token);
      expect(antes.status).toBe(200);

      // O papel muda no banco; o token continua o mesmo, e continua valido.
      await prisma.user.update({
        where: { id: admin.id },
        data: { role: 'COMMON_USER' },
      });

      const depois = await pedir('GET /api/settings/tokens', admin.token);
      expect(depois.status).toBe(403);
    });
  });
});
