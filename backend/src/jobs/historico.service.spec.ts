/**
 * Camada 2 — `HistoricoService` contra um Postgres de verdade.
 *
 * As regras do JOB-26 que este arquivo segura:
 *
 * - **descartar sobrescreve visto, mas visto NAO sobrescreve descartado** —
 *   sao gestos de peso diferente: descartar e uma decisao, abrir e passagem.
 *   Sem a regra, abrir o anuncio a partir da lista de descartadas (para
 *   conferir antes de restaurar) apagaria o descarte em silencio;
 * - **o `DELETE` sem parametro nao pode apagar o historico inteiro** — a
 *   mesma armadilha do JOB-05;
 * - **url so de espaco nao pode virar linha orfa** — o QA achou em 24/08:
 *   `@IsNotEmpty` nao apara espaco, entao `{"url":"   "}` gravava uma linha
 *   que o DELETE (que apara) nunca mais alcancava.
 */
import { BadRequestException } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import { HistoricoService } from './historico.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { MarcarVagaDto } from './job.dto';
import {
  clientDeTeste,
  exigirSchemaDeTeste,
  limpar,
  nomeDoSchema,
  prepararSchema,
} from '../../test/banco-de-teste';

const SCHEMA = nomeDoSchema(__filename);

describe('HistoricoService (banco)', () => {
  let prisma: PrismaClient;
  let servico: HistoricoService;

  beforeAll(async () => {
    prepararSchema(SCHEMA);
    prisma = clientDeTeste(SCHEMA);
    await exigirSchemaDeTeste(prisma, SCHEMA);
    servico = new HistoricoService(prisma as unknown as PrismaService);
  }, 120_000);

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await limpar(prisma, SCHEMA);
  });

  async function criarUsuario(): Promise<string> {
    const u = await prisma.user.create({
      data: {
        email: `h${Math.random().toString(36).slice(2)}@teste.local`,
        name: 'Pessoa',
        provider: 'DEV',
      },
      select: { id: true },
    });
    return u.id;
  }

  function marca(url: string, estado: 'visto' | 'descartado'): MarcarVagaDto {
    return { url, estado, title: 'Backend Engineer', company: 'Acme' } as MarcarVagaDto;
  }

  describe('descartado ganha de visto, e nao o contrario', () => {
    it('descartar por cima de visto muda o estado', async () => {
      const id = await criarUsuario();
      await servico.marcar(id, marca('https://a.com/1', 'visto'));

      const dto = await servico.marcar(id, marca('https://a.com/1', 'descartado'));

      expect(dto.vistas).toEqual([]);
      expect(dto.descartadas.map((d) => d.url)).toEqual(['https://a.com/1']);
    });

    it('visto por cima de descartado NAO apaga o descarte', async () => {
      const id = await criarUsuario();
      await servico.marcar(id, marca('https://a.com/1', 'descartado'));

      // A pessoa abre o anuncio a partir da lista de descartadas, para
      // conferir antes de restaurar. Isso nao pode desfazer o descarte.
      const dto = await servico.marcar(id, marca('https://a.com/1', 'visto'));

      expect(dto.descartadas.map((d) => d.url)).toEqual(['https://a.com/1']);
      expect(dto.vistas).toEqual([]);

      // E no banco tambem, e nao so no DTO devolvido.
      const linha = await prisma.jobHistory.findUnique({
        where: { userId_url: { userId: id, url: 'https://a.com/1' } },
        select: { estado: true },
      });
      expect(linha?.estado).toBe('descartado');
    });

    it('marcar visto duas vezes nao duplica nem da erro', async () => {
      const id = await criarUsuario();
      await servico.marcar(id, marca('https://a.com/1', 'visto'));
      const dto = await servico.marcar(id, marca('https://a.com/1', 'visto'));

      expect(dto.vistas).toEqual(['https://a.com/1']);
      expect(await prisma.jobHistory.count()).toBe(1);
    });

    it('o titulo se atualiza na remarcacao', async () => {
      const id = await criarUsuario();
      await servico.marcar(id, {
        url: 'https://a.com/1',
        estado: 'descartado',
        title: 'Titulo velho',
        company: 'Acme',
      } as MarcarVagaDto);

      const dto = await servico.marcar(id, {
        url: 'https://a.com/1',
        estado: 'descartado',
        title: 'Titulo novo',
        company: 'Acme',
      } as MarcarVagaDto);

      expect(dto.descartadas[0].title).toBe('Titulo novo');
    });

    it('mas visto sobre descartado NAO atualiza nem o titulo', async () => {
      const id = await criarUsuario();
      await servico.marcar(id, {
        url: 'https://a.com/1',
        estado: 'descartado',
        title: 'Titulo do descarte',
        company: 'Acme',
      } as MarcarVagaDto);

      const dto = await servico.marcar(id, {
        url: 'https://a.com/1',
        estado: 'visto',
        title: 'Titulo da passagem',
        company: 'Acme',
      } as MarcarVagaDto);

      // O ramo inteiro nao roda: nada e gravado.
      expect(dto.descartadas[0].title).toBe('Titulo do descarte');
    });
  });

  describe('url em branco nao pode virar linha orfa', () => {
    it('url so de espaco da 400 e nao grava — o bug de 24/08', async () => {
      const id = await criarUsuario();

      await expect(servico.marcar(id, marca('   ', 'visto'))).rejects.toThrow(
        BadRequestException,
      );

      // A linha nao existe: se existisse, o DELETE (que apara o parametro)
      // nunca a alcancaria, e ela ficaria para sempre.
      expect(await prisma.jobHistory.count()).toBe(0);
    });

    it('url vazia da 400', async () => {
      const id = await criarUsuario();
      await expect(servico.marcar(id, marca('', 'visto'))).rejects.toThrow(
        BadRequestException,
      );
    });

    it('a url gravada e a aparada, e o DELETE a alcanca', async () => {
      const id = await criarUsuario();
      await servico.marcar(id, marca('  https://a.com/1  ', 'descartado'));

      const dto = await servico.listar(id);
      expect(dto.descartadas[0].url).toBe('https://a.com/1');

      // O desfazer manda a url sem espaco, e tem de achar a linha.
      const depois = await servico.desmarcar(id, 'https://a.com/1');
      expect(depois.descartadas).toEqual([]);
    });
  });

  describe('desmarcar — o DELETE sem parametro NAO pode apagar tudo', () => {
    it('url vazia da 400 e nao apaga nada', async () => {
      const id = await criarUsuario();
      await servico.marcar(id, marca('https://a.com/1', 'descartado'));
      await servico.marcar(id, marca('https://a.com/2', 'visto'));

      await expect(servico.desmarcar(id, '')).rejects.toThrow(BadRequestException);

      expect(await prisma.jobHistory.count()).toBe(2);
    });

    it('url undefined da 400 e nao apaga nada — o caso do JOB-05', async () => {
      const id = await criarUsuario();
      await servico.marcar(id, marca('https://a.com/1', 'descartado'));
      await servico.marcar(id, marca('https://a.com/2', 'visto'));

      await expect(
        servico.desmarcar(id, undefined as unknown as string),
      ).rejects.toThrow(BadRequestException);

      expect(await prisma.jobHistory.count()).toBe(2);
    });

    it('url so de espaco da 400 e nao apaga nada', async () => {
      const id = await criarUsuario();
      await servico.marcar(id, marca('https://a.com/1', 'descartado'));

      await expect(servico.desmarcar(id, '  ')).rejects.toThrow(BadRequestException);

      expect(await prisma.jobHistory.count()).toBe(1);
    });

    it('desmarca SO a vaga pedida', async () => {
      const id = await criarUsuario();
      await servico.marcar(id, marca('https://a.com/1', 'descartado'));
      await servico.marcar(id, marca('https://a.com/2', 'descartado'));

      const dto = await servico.desmarcar(id, 'https://a.com/1');

      expect(dto.descartadas.map((d) => d.url)).toEqual(['https://a.com/2']);
    });

    it('desmarcar o que nao existe NAO e erro', async () => {
      const id = await criarUsuario();
      await servico.marcar(id, marca('https://a.com/1', 'descartado'));

      // `deleteMany` e nao `delete`: em duas abas abertas, o segundo desfazer
      // chegaria depois do primeiro e um 404 faria o gesto parecer quebrado.
      const dto = await servico.desmarcar(id, 'https://a.com/nao-existe');

      expect(dto.descartadas).toHaveLength(1);
    });
  });

  describe('o historico e por pessoa', () => {
    it('desmarcar nao toca no historico de outra pessoa com a MESMA url', async () => {
      const ana = await criarUsuario();
      const bruno = await criarUsuario();
      await servico.marcar(ana, marca('https://a.com/mesma', 'descartado'));
      await servico.marcar(bruno, marca('https://a.com/mesma', 'descartado'));

      await servico.desmarcar(ana, 'https://a.com/mesma');

      expect((await servico.listar(ana)).descartadas).toHaveLength(0);
      expect((await servico.listar(bruno)).descartadas).toHaveLength(1);
    });

    it('listar devolve so as proprias marcas', async () => {
      const ana = await criarUsuario();
      const bruno = await criarUsuario();
      await servico.marcar(ana, marca('https://a.com/ana', 'visto'));
      await servico.marcar(bruno, marca('https://a.com/bruno', 'visto'));

      expect((await servico.listar(ana)).vistas).toEqual(['https://a.com/ana']);
      expect((await servico.listar(bruno)).vistas).toEqual(['https://a.com/bruno']);
    });
  });

  describe('listar', () => {
    it('separa vistas de descartadas', async () => {
      const id = await criarUsuario();
      await servico.marcar(id, marca('https://a.com/v1', 'visto'));
      await servico.marcar(id, marca('https://a.com/v2', 'visto'));
      await servico.marcar(id, marca('https://a.com/d1', 'descartado'));

      const dto = await servico.listar(id);

      expect(dto.vistas.sort()).toEqual(['https://a.com/v1', 'https://a.com/v2']);
      expect(dto.descartadas.map((d) => d.url)).toEqual(['https://a.com/d1']);
    });

    it('as descartadas vem com titulo e empresa, para a tela poder desfazer', async () => {
      const id = await criarUsuario();
      await servico.marcar(id, {
        url: 'https://a.com/1',
        estado: 'descartado',
        title: 'Staff Engineer',
        company: 'Globex',
      } as MarcarVagaDto);

      const [d] = (await servico.listar(id)).descartadas;

      // Uma lista de URLs cruas nao se reconhece.
      expect(d.title).toBe('Staff Engineer');
      expect(d.company).toBe('Globex');
      expect(typeof d.marcadaEm).toBe('string');
      expect(d.marcadaEm).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('historico vazio devolve as duas listas vazias, e nao erro', async () => {
      const id = await criarUsuario();
      expect(await servico.listar(id)).toEqual({ vistas: [], descartadas: [] });
    });
  });

  describe('apagar a conta leva o historico junto', () => {
    it('onDelete: Cascade', async () => {
      const id = await criarUsuario();
      await servico.marcar(id, marca('https://a.com/1', 'visto'));
      expect(await prisma.jobHistory.count()).toBe(1);

      await prisma.user.delete({ where: { id } });

      expect(await prisma.jobHistory.count()).toBe(0);
    });
  });
});
