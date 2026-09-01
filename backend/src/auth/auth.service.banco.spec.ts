/**
 * Camada 2 — `AuthService` contra um Postgres de verdade.
 *
 * O `auth.service.spec.ts` da camada 1 ja cobre `papelPara` e `authDesligada`
 * como logica pura. **Este arquivo cobre o que so o banco prova**: o `upsert`
 * por e-mail, que e onde as duas regras de papel viram gravacao.
 *
 * - **PLT-03: a conta antiga e ADOTADA, e nao duplicada.** O upsert e por
 *   e-mail, entao quem ja tinha progresso das trilhas (criado pelo guard
 *   antigo, sem `providerId`) entra na mesma linha — com o progresso e os
 *   tokens junto. Uma linha nova deixaria a pessoa olhando uma trilha zerada.
 * - **PLT-11: o MANAGER sobrevive ao login.** A regra antiga era
 *   `ehAdmin ? ADMIN : COMMON_USER`, e ela apagava a promocao a cada entrada:
 *   o dono promovia pela tela, a pessoa entrava, e voltava a ser comum **sem
 *   erro nenhum no log**.
 *
 * `loginComGoogle` exige um id token verificado pelo Google, entao o que se
 * exercita aqui e `usuarioDeDesenvolvimento` (que faz o mesmo upsert) e as
 * consultas de `verificar`. A regra de papel em si e a mesma funcao privada
 * nos dois caminhos.
 */
import { UnauthorizedException } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import * as jwt from 'jsonwebtoken';
import { AuthService } from './auth.service';
import type { PrismaService } from '../prisma/prisma.service';
import {
  clientDeTeste,
  exigirSchemaDeTeste,
  limpar,
  nomeDoSchema,
  prepararSchema,
} from '../../test/banco-de-teste';

const SCHEMA = nomeDoSchema(__filename);

describe('AuthService (banco)', () => {
  let prisma: PrismaClient;
  const AMBIENTE = { ...process.env };

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
    process.env = { ...AMBIENTE };
  });

  afterEach(() => {
    process.env = { ...AMBIENTE };
  });

  /**
   * O servico com o ambiente que o teste pediu.
   *
   * Construido POR TESTE, e nao no `beforeAll`: o `AuthService` le
   * `JWT_SECRET` no construtor, e `ADMIN_EMAILS` a cada chamada — mas o
   * `DEFAULT_USER_EMAIL` de `usuarioDeDesenvolvimento` tambem e lido por
   * chamada, entao construir aqui deixa cada teste dono do proprio ambiente.
   */
  function servico(env: Record<string, string> = {}): AuthService {
    Object.assign(process.env, env);
    return new AuthService(prisma as unknown as PrismaService);
  }

  describe('usuarioDeDesenvolvimento — o upsert por e-mail', () => {
    it('cria a conta quando o banco esta vazio', async () => {
      const auth = servico({ DEFAULT_USER_EMAIL: 'dev@teste.local', ADMIN_EMAILS: '' });

      const u = await auth.usuarioDeDesenvolvimento();

      expect(u.email).toBe('dev@teste.local');
      expect(u.role).toBe('COMMON_USER');
      expect(await prisma.user.count()).toBe(1);
    });

    it('chamar duas vezes NAO cria uma segunda conta', async () => {
      const auth = servico({ DEFAULT_USER_EMAIL: 'dev@teste.local', ADMIN_EMAILS: '' });

      const a = await auth.usuarioDeDesenvolvimento();
      const b = await auth.usuarioDeDesenvolvimento();

      expect(a.id).toBe(b.id);
      expect(await prisma.user.count()).toBe(1);
    });

    it('ADOTA a conta que ja existia, com o progresso junto (PLT-03)', async () => {
      // A conta do guard antigo: sem provider do Google, com progresso.
      const antiga = await prisma.user.create({
        data: { email: 'dev@teste.local', name: 'Conta antiga', provider: 'DEV' },
        select: { id: true },
      });
      const trilha = await prisma.track.create({
        data: { slug: 't', title: 'Trilha', description: 'd', icon: '📘' },
        select: { id: true },
      });
      const modulo = await prisma.module.create({
        data: { trackId: trilha.id, slug: 'm', title: 'Modulo', goal: 'Aprender' },
        select: { id: true },
      });
      const aula = await prisma.lesson.create({
        data: { moduleId: modulo.id, slug: 'a', title: 'Aula', kind: 'ARTICLE' },
        select: { id: true },
      });
      await prisma.progress.create({
        data: { userId: antiga.id, lessonId: aula.id, completed: true },
      });

      const auth = servico({ DEFAULT_USER_EMAIL: 'dev@teste.local', ADMIN_EMAILS: '' });
      const u = await auth.usuarioDeDesenvolvimento();

      // A MESMA linha: o id nao mudou, entao o progresso continua ligado.
      expect(u.id).toBe(antiga.id);
      expect(await prisma.user.count()).toBe(1);
      expect(await prisma.progress.count({ where: { userId: u.id } })).toBe(1);
    });

    it('NAO mexe no nome de quem ja existe', async () => {
      await prisma.user.create({
        data: { email: 'dev@teste.local', name: 'Nome escolhido', provider: 'DEV' },
      });

      const auth = servico({ DEFAULT_USER_EMAIL: 'dev@teste.local', ADMIN_EMAILS: '' });
      const u = await auth.usuarioDeDesenvolvimento();

      // O `update: {}` e de proposito: esta conta costuma ser a que ja tem o
      // progresso, e sobrescrever o nome seria mexer no que ninguem pediu.
      expect(u.name).toBe('Nome escolhido');
    });

    it('o e-mail e normalizado para minusculas', async () => {
      const auth = servico({ DEFAULT_USER_EMAIL: 'DEV@Teste.Local', ADMIN_EMAILS: '' });

      const u = await auth.usuarioDeDesenvolvimento();

      // Sem isto, 'DEV@x' e 'dev@x' viram duas contas e o progresso se parte.
      expect(u.email).toBe('dev@teste.local');
    });

    it('conta nova em ADMIN_EMAILS nasce ADMIN', async () => {
      const auth = servico({
        DEFAULT_USER_EMAIL: 'chefe@teste.local',
        ADMIN_EMAILS: 'chefe@teste.local',
      });

      const u = await auth.usuarioDeDesenvolvimento();

      expect(u.role).toBe('ADMIN');
      const linha = await prisma.user.findUnique({
        where: { email: 'chefe@teste.local' },
        select: { role: true },
      });
      expect(linha?.role).toBe('ADMIN');
    });

    it('ADMIN_EMAILS vazio nao faz ninguem admin', async () => {
      const auth = servico({ DEFAULT_USER_EMAIL: 'dev@teste.local', ADMIN_EMAILS: '' });

      const u = await auth.usuarioDeDesenvolvimento();

      // Default de seguranca e "ninguem", nao "eu".
      expect(u.role).toBe('COMMON_USER');
    });
  });

  describe('verificar — o token e uma alegacao, o banco decide', () => {
    const SEGREDO = 'segredo-de-teste-qa03-com-mais-de-16';

    function assinar(sub: string): string {
      return jwt.sign({ sub }, SEGREDO, { expiresIn: '30d' });
    }

    it('devolve o usuario do BANCO, e nao o que o token diz', async () => {
      const auth = servico({ JWT_SECRET: SEGREDO, ADMIN_EMAILS: '' });
      const u = await prisma.user.create({
        data: {
          email: 'a@teste.local',
          name: 'Ana',
          provider: 'DEV',
          role: 'COMMON_USER',
        },
        select: { id: true },
      });

      // Um token que ALEGA ser admin. O papel tem de vir do banco.
      const token = jwt.sign({ sub: u.id, role: 'ADMIN' }, SEGREDO, { expiresIn: '30d' });
      const resolvido = await auth.verificar(token);

      expect(resolvido.role).toBe('COMMON_USER');
    });

    it('papel rebaixado no banco vale na requisicao seguinte', async () => {
      const auth = servico({ JWT_SECRET: SEGREDO, ADMIN_EMAILS: '' });
      const u = await prisma.user.create({
        data: { email: 'm@teste.local', name: 'M', provider: 'DEV', role: 'MANAGER' },
        select: { id: true },
      });
      const token = assinar(u.id);

      expect((await auth.verificar(token)).role).toBe('MANAGER');

      await prisma.user.update({ where: { id: u.id }, data: { role: 'COMMON_USER' } });

      // O mesmo token, o papel novo. Nao se espera o token de 30 dias expirar.
      expect((await auth.verificar(token)).role).toBe('COMMON_USER');
    });

    it('conta desativada derruba a sessao, com o mesmo token', async () => {
      const auth = servico({ JWT_SECRET: SEGREDO, ADMIN_EMAILS: '' });
      const u = await prisma.user.create({
        data: { email: 'd@teste.local', name: 'D', provider: 'DEV' },
        select: { id: true },
      });
      const token = assinar(u.id);

      expect((await auth.verificar(token)).id).toBe(u.id);

      await prisma.user.update({ where: { id: u.id }, data: { active: false } });

      await expect(auth.verificar(token)).rejects.toThrow(UnauthorizedException);
    });

    it('token de um usuario que sumiu do banco da 401', async () => {
      const auth = servico({ JWT_SECRET: SEGREDO, ADMIN_EMAILS: '' });
      const token = assinar('00000000-0000-4000-8000-000000000000');

      await expect(auth.verificar(token)).rejects.toThrow(UnauthorizedException);
    });

    it('token assinado com OUTRO segredo da 401', async () => {
      const auth = servico({ JWT_SECRET: SEGREDO, ADMIN_EMAILS: '' });
      const u = await prisma.user.create({
        data: { email: 'x@teste.local', name: 'X', provider: 'DEV' },
        select: { id: true },
      });
      const forjado = jwt.sign({ sub: u.id }, 'outro-segredo-completamente', {
        expiresIn: '30d',
      });

      await expect(auth.verificar(forjado)).rejects.toThrow(UnauthorizedException);
    });

    it('token expirado da 401', async () => {
      const auth = servico({ JWT_SECRET: SEGREDO, ADMIN_EMAILS: '' });
      const u = await prisma.user.create({
        data: { email: 'e@teste.local', name: 'E', provider: 'DEV' },
        select: { id: true },
      });
      const vencido = jwt.sign({ sub: u.id }, SEGREDO, { expiresIn: '-1s' });

      await expect(auth.verificar(vencido)).rejects.toThrow(UnauthorizedException);
    });

    it('o usuario resolvido NAO carrega o documento nem o telefone', async () => {
      const auth = servico({ JWT_SECRET: SEGREDO, ADMIN_EMAILS: '' });
      const u = await prisma.user.create({
        data: {
          email: 'p@teste.local',
          name: 'P',
          provider: 'DEV',
          phone: '+55 11 90000-0000',
          documentEnc: 'cifrado',
          documentHint: '4725',
        },
        select: { id: true },
      });

      const resolvido = await auth.verificar(assinar(u.id));

      // O `AuthUser` circula em toda request. Nao ha por que o CPF estar ali.
      expect(Object.keys(resolvido).sort()).toEqual(
        ['avatarUrl', 'email', 'id', 'name', 'role'].sort(),
      );
    });
  });

  describe('o boot recusa segredo fraco', () => {
    it('sem JWT_SECRET, o construtor derruba', () => {
      delete process.env.JWT_SECRET;
      expect(() => new AuthService(prisma as unknown as PrismaService)).toThrow(
        /JWT_SECRET/,
      );
    });

    it('com JWT_SECRET curta demais, o construtor derruba', () => {
      process.env.JWT_SECRET = 'curta';
      expect(() => new AuthService(prisma as unknown as PrismaService)).toThrow(
        /JWT_SECRET/,
      );
    });
  });
});
