/**
 * Camada 2 — `UsuariosService` contra um Postgres de verdade.
 *
 * As protecoes do PLT-11, que sao a razao deste arquivo existir:
 *
 * 1. **ninguem vira ADMIN pela tela** — o papel vem de `ADMIN_EMAILS`;
 * 2. **o dono nao se rebaixa nem se desativa** — perderia o acesso a tela que
 *    o traria de volta;
 * 3. **manager nao desativa admin** — o cargo viraria forma de derrubar quem
 *    o supervisiona;
 * 4. **manager nao desativa manager** — dois se derrubariam mutuamente.
 *
 * E a regra que amarra as duas pontas: **`canToggleActive` na lista tem de
 * concordar com o que o `PATCH` faz**. Se divergirem, a tela desenha um botao
 * que da 403 — ou, pior, esconde um gesto que era permitido.
 */
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import { UsuariosService } from './usuarios.service';
import type { PrismaService } from '../prisma/prisma.service';
import { POR_PAGINA } from './usuarios.dto';
import {
  clientDeTeste,
  exigirSchemaDeTeste,
  limpar,
  nomeDoSchema,
  prepararSchema,
} from '../../test/banco-de-teste';

const SCHEMA = nomeDoSchema(__filename);

describe('UsuariosService (banco)', () => {
  let prisma: PrismaClient;
  let servico: UsuariosService;

  beforeAll(async () => {
    prepararSchema(SCHEMA);
    prisma = clientDeTeste(SCHEMA);
    await exigirSchemaDeTeste(prisma, SCHEMA);
    servico = new UsuariosService(prisma as unknown as PrismaService);
  }, 120_000);

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await limpar(prisma, SCHEMA);
  });

  let n = 0;
  async function criar(
    role: string,
    extra: Record<string, unknown> = {},
  ): Promise<{ id: string; role: string; email: string; name: string }> {
    n += 1;
    const email = `u${n}.${Math.random().toString(36).slice(2)}@teste.local`;
    const u = await prisma.user.create({
      data: { email, name: `Pessoa ${n}`, provider: 'DEV', role, ...extra },
      select: { id: true, role: true, email: true, name: true },
    });
    return u;
  }

  describe('mudarPapel — ninguem vira admin pela tela', () => {
    it('recusa promover a ADMIN, mesmo vindo de um ADMIN', async () => {
      const admin = await criar('ADMIN');
      const alvo = await criar('COMMON_USER');

      await expect(servico.mudarPapel(admin, alvo.id, 'ADMIN')).rejects.toThrow(
        BadRequestException,
      );

      // E o banco nao mudou: a recusa e antes da gravacao.
      const depois = await prisma.user.findUnique({
        where: { id: alvo.id },
        select: { role: true },
      });
      expect(depois?.role).toBe('COMMON_USER');
    });

    it('recusa REBAIXAR um ADMIN, porque o ADMIN_EMAILS o devolveria', async () => {
      const admin = await criar('ADMIN');
      const outroAdmin = await criar('ADMIN');

      await expect(
        servico.mudarPapel(admin, outroAdmin.id, 'COMMON_USER'),
      ).rejects.toThrow(/ADMIN_EMAILS/);

      const depois = await prisma.user.findUnique({
        where: { id: outroAdmin.id },
        select: { role: true },
      });
      expect(depois?.role).toBe('ADMIN');
    });

    it('o admin nao muda o proprio papel', async () => {
      const admin = await criar('ADMIN');

      await expect(servico.mudarPapel(admin, admin.id, 'COMMON_USER')).rejects.toThrow(
        /proprio papel/,
      );

      const depois = await prisma.user.findUnique({
        where: { id: admin.id },
        select: { role: true },
      });
      expect(depois?.role).toBe('ADMIN');
    });

    it('MANAGER nao muda papel de ninguem', async () => {
      const manager = await criar('MANAGER');
      const alvo = await criar('COMMON_USER');

      await expect(servico.mudarPapel(manager, alvo.id, 'MANAGER')).rejects.toThrow(
        ForbiddenException,
      );

      const depois = await prisma.user.findUnique({
        where: { id: alvo.id },
        select: { role: true },
      });
      expect(depois?.role).toBe('COMMON_USER');
    });

    it('COMMON_USER nao muda papel de ninguem', async () => {
      const comum = await criar('COMMON_USER');
      const alvo = await criar('COMMON_USER');

      await expect(servico.mudarPapel(comum, alvo.id, 'MANAGER')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('o admin PROMOVE a MANAGER, e isso grava', async () => {
      const admin = await criar('ADMIN');
      const alvo = await criar('COMMON_USER');

      const dto = await servico.mudarPapel(admin, alvo.id, 'MANAGER');

      expect(dto.role).toBe('MANAGER');
      const depois = await prisma.user.findUnique({
        where: { id: alvo.id },
        select: { role: true },
      });
      expect(depois?.role).toBe('MANAGER');
    });

    it('o admin REBAIXA um manager', async () => {
      const admin = await criar('ADMIN');
      const alvo = await criar('MANAGER');

      const dto = await servico.mudarPapel(admin, alvo.id, 'COMMON_USER');

      expect(dto.role).toBe('COMMON_USER');
    });

    it('alvo inexistente da 404, e nao 403', async () => {
      const admin = await criar('ADMIN');
      // A ordem importa: buscar antes de decidir o papel evita responder
      // "voce nao pode" sobre alguem que nem existe.
      await expect(
        servico.mudarPapel(admin, '00000000-0000-4000-8000-000000000000', 'MANAGER'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('mudarAtivo — as tres recusas', () => {
    it('ninguem se desativa, nem o admin', async () => {
      const admin = await criar('ADMIN');

      await expect(servico.mudarAtivo(admin, admin.id, false)).rejects.toThrow(
        /propria conta/,
      );

      const depois = await prisma.user.findUnique({
        where: { id: admin.id },
        select: { active: true },
      });
      expect(depois?.active).toBe(true);
    });

    it('manager NAO desativa admin', async () => {
      const manager = await criar('MANAGER');
      const admin = await criar('ADMIN');

      await expect(servico.mudarAtivo(manager, admin.id, false)).rejects.toThrow(
        ForbiddenException,
      );

      const depois = await prisma.user.findUnique({
        where: { id: admin.id },
        select: { active: true },
      });
      expect(depois?.active).toBe(true);
    });

    it('manager NAO desativa outro manager', async () => {
      const manager = await criar('MANAGER');
      const outro = await criar('MANAGER');

      await expect(servico.mudarAtivo(manager, outro.id, false)).rejects.toThrow(
        ForbiddenException,
      );

      const depois = await prisma.user.findUnique({
        where: { id: outro.id },
        select: { active: true },
      });
      expect(depois?.active).toBe(true);
    });

    it('manager desativa COMMON_USER, e o registro diz quem foi', async () => {
      const manager = await criar('MANAGER');
      const alvo = await criar('COMMON_USER');

      const dto = await servico.mudarAtivo(manager, alvo.id, false);

      expect(dto.active).toBe(false);
      expect(dto.deactivatedAt).not.toBeNull();
      // O nome de QUEM desativou, e nao o de quem foi desativado — a tela
      // mostra "disabled by <nome>" e trocar os dois passaria despercebido.
      expect(dto.deactivatedByName).toBe(manager.name);
      expect(dto.deactivatedByName).not.toBe(alvo.name);

      const depois = await prisma.user.findUnique({
        where: { id: alvo.id },
        select: { active: true, deactivatedById: true, deactivatedAt: true },
      });
      expect(depois?.active).toBe(false);
      expect(depois?.deactivatedById).toBe(manager.id);
      expect(depois?.deactivatedAt).toBeInstanceOf(Date);
    });

    it('COMMON_USER nao desativa ninguem', async () => {
      const comum = await criar('COMMON_USER');
      const alvo = await criar('COMMON_USER');

      await expect(servico.mudarAtivo(comum, alvo.id, false)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('reativar LIMPA o registro de desativacao', async () => {
      const admin = await criar('ADMIN');
      const alvo = await criar('COMMON_USER');

      await servico.mudarAtivo(admin, alvo.id, false);
      const dto = await servico.mudarAtivo(admin, alvo.id, true);

      // Manter "disabled by Lucas" ao lado de quem esta dentro faria a tela
      // mentir.
      expect(dto.active).toBe(true);
      expect(dto.deactivatedAt).toBeNull();
      expect(dto.deactivatedByName).toBeNull();

      const depois = await prisma.user.findUnique({
        where: { id: alvo.id },
        select: { deactivatedById: true, deactivatedAt: true },
      });
      expect(depois?.deactivatedById).toBeNull();
      expect(depois?.deactivatedAt).toBeNull();
    });

    it('admin desativa manager', async () => {
      const admin = await criar('ADMIN');
      const alvo = await criar('MANAGER');

      const dto = await servico.mudarAtivo(admin, alvo.id, false);
      expect(dto.active).toBe(false);
    });
  });

  describe('a lista concorda com o que o PATCH faz', () => {
    it('canToggleActive nunca promete um gesto que da 403', async () => {
      const admin = await criar('ADMIN');
      const manager = await criar('MANAGER');
      const outroManager = await criar('MANAGER');
      const comum = await criar('COMMON_USER');

      // A lista pelos olhos do MANAGER.
      const lista = await servico.listar(manager, undefined, 1);

      for (const linha of lista.itens) {
        const permitido = linha.canToggleActive;
        // O que a tela promete tem de bater com o que o servico aceita. Fazer
        // de verdade e nao inspecionar a funcao privada: e a unica forma de o
        // teste pegar as duas regras divergindo.
        let aceitou = true;
        try {
          await servico.mudarAtivo(manager, linha.id, false);
        } catch {
          aceitou = false;
        }
        expect(aceitou).toBe(permitido);
        // Devolve ao estado anterior para nao contaminar a proxima volta.
        if (aceitou) {
          await prisma.user.update({
            where: { id: linha.id },
            data: { active: true, deactivatedAt: null, deactivatedById: null },
          });
        }
      }

      // E a matriz esperada, explicita: manager so mexe em comum.
      const porId = new Map(lista.itens.map((i) => [i.id, i]));
      expect(porId.get(comum.id)?.canToggleActive).toBe(true);
      expect(porId.get(admin.id)?.canToggleActive).toBe(false);
      expect(porId.get(outroManager.id)?.canToggleActive).toBe(false);
      expect(porId.get(manager.id)?.canToggleActive).toBe(false);
    });

    it('canChangeRole e falso para ADMIN e para si mesmo', async () => {
      const admin = await criar('ADMIN');
      const outroAdmin = await criar('ADMIN');
      const comum = await criar('COMMON_USER');

      const lista = await servico.listar(admin, undefined, 1);
      const porId = new Map(lista.itens.map((i) => [i.id, i]));

      expect(porId.get(comum.id)?.canChangeRole).toBe(true);
      expect(porId.get(admin.id)?.canChangeRole).toBe(false);
      expect(porId.get(outroAdmin.id)?.canChangeRole).toBe(false);
    });

    it('isSelf marca so a propria linha', async () => {
      const admin = await criar('ADMIN');
      await criar('COMMON_USER');

      const lista = await servico.listar(admin, undefined, 1);
      const proprias = lista.itens.filter((i) => i.isSelf);

      expect(proprias).toHaveLength(1);
      expect(proprias[0].id).toBe(admin.id);
    });
  });

  describe('a lista nao vaza dado pessoal', () => {
    it('nao devolve documento, telefone nem endereco', async () => {
      const admin = await criar('ADMIN');
      await criar('COMMON_USER', {
        phone: '+55 11 90000-0000',
        documentEnc: 'cifrado',
        documentHint: '4725',
        documentCountry: 'BR',
        addressCity: 'Sao Paulo',
      });

      const lista = await servico.listar(admin, undefined, 1);

      // Gerenciar papel nao precisa do CPF de ninguem. O teste olha o objeto
      // inteiro, e nao uma lista de campos que eu lembrei de conferir: campo
      // novo que vaze quebra isto.
      for (const linha of lista.itens) {
        const chaves = Object.keys(linha);
        for (const proibida of [
          'phone',
          'document',
          'documentEnc',
          'documentHint',
          'documentCountry',
          'addressStreet',
          'addressCity',
          'addressPostalCode',
        ]) {
          expect(chaves).not.toContain(proibida);
        }
      }
      // E o conjunto de chaves e exatamente o contratado.
      expect(Object.keys(lista.itens[0]).sort()).toEqual(
        [
          'active',
          'avatarUrl',
          'canChangeRole',
          'canToggleActive',
          'createdAt',
          'deactivatedAt',
          'deactivatedByName',
          'email',
          'id',
          'isSelf',
          'lastLoginAt',
          'name',
          'role',
        ].sort(),
      );
    });

    it('data sai como string ISO, nunca Date', async () => {
      const admin = await criar('ADMIN');

      const lista = await servico.listar(admin, undefined, 1);
      const linha = lista.itens[0];

      expect(typeof linha.createdAt).toBe('string');
      expect(linha.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe('busca e paginacao', () => {
    it('sem busca, o where e undefined e a lista traz todo mundo', async () => {
      const admin = await criar('ADMIN');
      await criar('COMMON_USER');
      await criar('MANAGER');

      const lista = await servico.listar(admin, undefined, 1);

      expect(lista.total).toBe(3);
      expect(lista.itens).toHaveLength(3);
    });

    it('busca por e-mail filtra, e nao devolve todo mundo', async () => {
      const admin = await criar('ADMIN');
      const alvo = await criar('COMMON_USER', { email: 'procurado@teste.local' });
      await criar('COMMON_USER');

      const lista = await servico.listar(admin, 'procurado', 1);

      expect(lista.total).toBe(1);
      expect(lista.itens[0].id).toBe(alvo.id);
    });

    it('busca por nome, sem diferenciar maiuscula', async () => {
      const admin = await criar('ADMIN');
      await criar('COMMON_USER', { name: 'Fulano De Tal' });

      const lista = await servico.listar(admin, 'fulano', 1);

      expect(lista.total).toBe(1);
      expect(lista.itens[0].name).toBe('Fulano De Tal');
    });

    it('busca so de espaco vale como sem busca', async () => {
      const admin = await criar('ADMIN');
      await criar('COMMON_USER');

      const lista = await servico.listar(admin, '   ', 1);

      // `.trim()` vazio nao pode virar `contains: ''`, que casaria com tudo
      // por acidente em vez de por decisao.
      expect(lista.total).toBe(2);
    });

    it('busca sem resultado devolve lista vazia e pagina 1', async () => {
      const admin = await criar('ADMIN');

      const lista = await servico.listar(admin, 'nao-existe-isto', 1);

      expect(lista.total).toBe(0);
      expect(lista.itens).toHaveLength(0);
      // `paginas` nunca e 0: a tela dividiria por zero ao desenhar "1 de 0".
      expect(lista.paginas).toBe(1);
      expect(lista.pagina).toBe(1);
    });

    it('pagina alem do fim e grampeada na ultima', async () => {
      const admin = await criar('ADMIN');

      // Pedir a pagina 99 de uma lista de 1 nao pode devolver vazio com o
      // contador dizendo que ha 1.
      const lista = await servico.listar(admin, undefined, 99);

      expect(lista.pagina).toBe(1);
      expect(lista.itens).toHaveLength(1);
    });

    it('pagina 0 ou negativa vira 1', async () => {
      const admin = await criar('ADMIN');

      expect((await servico.listar(admin, undefined, 0)).pagina).toBe(1);
      expect((await servico.listar(admin, undefined, -5)).pagina).toBe(1);
    });

    it('a segunda pagina traz os que sobraram, sem repetir', async () => {
      const admin = await criar('ADMIN');
      for (let i = 0; i < POR_PAGINA; i += 1) {
        await criar('COMMON_USER');
      }

      const p1 = await servico.listar(admin, undefined, 1);
      const p2 = await servico.listar(admin, undefined, 2);

      expect(p1.total).toBe(POR_PAGINA + 1);
      expect(p1.itens).toHaveLength(POR_PAGINA);
      expect(p2.itens).toHaveLength(1);

      // Nenhum id nas duas paginas: e o que prova que o `skip` esta certo.
      const ids = new Set(p1.itens.map((i) => i.id));
      expect(ids.has(p2.itens[0].id)).toBe(false);
    });
  });
});
