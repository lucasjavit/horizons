/**
 * Camada 2 — `SalvasService` contra um Postgres de verdade.
 *
 * ## A armadilha que este arquivo existe para segurar
 *
 * **`where: { campo: undefined }` no Prisma DESCARTA a condicao**, em vez de
 * nao casar com nada. Medido pelo QA em 21/08: `DELETE /jobs/saved` sem o
 * parametro devolvia 200 e **zerava a lista inteira** (JOB-05). Vaga salva nao
 * tem `expiresAt` — e o arquivo da pessoa, e a perda e permanente.
 *
 * Por isso os testes de remocao **conferem o que sobrou**, e nao so o codigo
 * do erro: um `deleteMany` que apaga tudo e devolve 400 continuaria errado, e
 * um teste que so olhasse a excecao passaria.
 *
 * E por isso a suite tem SEMPRE uma segunda vaga e uma segunda pessoa em cena.
 * Com uma linha so no banco, "apagou a certa" e "apagou tudo" sao o mesmo
 * resultado, e o teste nao distingue o bug do acerto.
 */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import { SalvasService } from './salvas.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { SalvarVagaDto } from './job.dto';
import {
  clientDeTeste,
  exigirSchemaDeTeste,
  limpar,
  nomeDoSchema,
  prepararSchema,
} from '../../test/banco-de-teste';

const SCHEMA = nomeDoSchema(__filename);

describe('SalvasService (banco)', () => {
  let prisma: PrismaClient;
  let servico: SalvasService;

  beforeAll(async () => {
    prepararSchema(SCHEMA);
    prisma = clientDeTeste(SCHEMA);
    await exigirSchemaDeTeste(prisma, SCHEMA);
    servico = new SalvasService(prisma as unknown as PrismaService);
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
        email: `s${Math.random().toString(36).slice(2)}@teste.local`,
        name: 'Pessoa',
        provider: 'DEV',
      },
      select: { id: true },
    });
    return u.id;
  }

  function vaga(url: string, extra: Partial<SalvarVagaDto> = {}): SalvarVagaDto {
    return {
      url,
      title: 'Backend Engineer',
      company: 'Acme',
      ...extra,
    } as SalvarVagaDto;
  }

  describe('remover — o DELETE sem parametro NAO pode apagar tudo', () => {
    it('url vazia da 400 e nao apaga nada', async () => {
      const id = await criarUsuario();
      await servico.salvar(id, vaga('https://a.com/1'));
      await servico.salvar(id, vaga('https://a.com/2'));

      await expect(servico.remover(id, '')).rejects.toThrow(BadRequestException);

      // O que importa: as duas continuam la. Sem esta linha, um `deleteMany`
      // que apagasse tudo e lancasse depois passaria no teste.
      expect(await servico.listar(id)).toHaveLength(2);
    });

    it('url so de espaco da 400 e nao apaga nada', async () => {
      const id = await criarUsuario();
      await servico.salvar(id, vaga('https://a.com/1'));
      await servico.salvar(id, vaga('https://a.com/2'));

      await expect(servico.remover(id, '   ')).rejects.toThrow(BadRequestException);

      expect(await servico.listar(id)).toHaveLength(2);
    });

    it('url undefined da 400 e nao apaga nada — o caso do JOB-05', async () => {
      const id = await criarUsuario();
      await servico.salvar(id, vaga('https://a.com/1'));
      await servico.salvar(id, vaga('https://a.com/2'));

      // Exatamente o que o controller entregava quando o parametro faltava.
      // Sem a checagem, o Prisma descarta `url: undefined` e o `where` vira
      // `{ userId }` — a lista inteira da pessoa.
      await expect(
        servico.remover(id, undefined as unknown as string),
      ).rejects.toThrow(BadRequestException);

      expect(await servico.listar(id)).toHaveLength(2);
    });

    it('url null da 400 e nao apaga nada', async () => {
      const id = await criarUsuario();
      await servico.salvar(id, vaga('https://a.com/1'));

      await expect(servico.remover(id, null as unknown as string)).rejects.toThrow(
        BadRequestException,
      );

      expect(await servico.listar(id)).toHaveLength(1);
    });

    it('remove SO a vaga pedida', async () => {
      const id = await criarUsuario();
      await servico.salvar(id, vaga('https://a.com/1'));
      await servico.salvar(id, vaga('https://a.com/2'));
      await servico.salvar(id, vaga('https://a.com/3'));

      await servico.remover(id, 'https://a.com/2');

      const restantes = (await servico.listar(id)).map((v) => v.url).sort();
      expect(restantes).toEqual(['https://a.com/1', 'https://a.com/3']);
    });

    it('remover vaga inexistente da 404, e nao apaga as outras', async () => {
      const id = await criarUsuario();
      await servico.salvar(id, vaga('https://a.com/1'));

      await expect(servico.remover(id, 'https://a.com/nao-existe')).rejects.toThrow(
        NotFoundException,
      );

      expect(await servico.listar(id)).toHaveLength(1);
    });
  });

  describe('a vaga de uma pessoa nao alcanca a outra', () => {
    it('remover nao toca na vaga de outro usuario com a MESMA url', async () => {
      const ana = await criarUsuario();
      const bruno = await criarUsuario();
      await servico.salvar(ana, vaga('https://a.com/mesma'));
      await servico.salvar(bruno, vaga('https://a.com/mesma'));

      await servico.remover(ana, 'https://a.com/mesma');

      expect(await servico.listar(ana)).toHaveLength(0);
      // O `userId` no `where` e o que segura isto. Sem ele, remover apagaria
      // a vaga das duas pessoas.
      expect(await servico.listar(bruno)).toHaveLength(1);
    });

    it('listar devolve so as proprias', async () => {
      const ana = await criarUsuario();
      const bruno = await criarUsuario();
      await servico.salvar(ana, vaga('https://a.com/ana'));
      await servico.salvar(bruno, vaga('https://a.com/bruno-1'));
      await servico.salvar(bruno, vaga('https://a.com/bruno-2'));

      expect((await servico.listar(ana)).map((v) => v.url)).toEqual([
        'https://a.com/ana',
      ]);
      expect(await servico.listar(bruno)).toHaveLength(2);
    });
  });

  describe('salvar', () => {
    it('salvar duas vezes a mesma url nao duplica — atualiza o retrato', async () => {
      const id = await criarUsuario();
      await servico.salvar(id, vaga('https://a.com/1', { title: 'Titulo velho' }));
      await servico.salvar(id, vaga('https://a.com/1', { title: 'Titulo novo' }));

      const lista = await servico.listar(id);
      expect(lista).toHaveLength(1);
      // O upsert atualiza: a versao nova do anuncio e a que a pessoa esta vendo.
      expect(lista[0].title).toBe('Titulo novo');
    });

    it('a mesma url para duas pessoas gera duas linhas', async () => {
      const ana = await criarUsuario();
      const bruno = await criarUsuario();

      await servico.salvar(ana, vaga('https://a.com/mesma'));
      await servico.salvar(bruno, vaga('https://a.com/mesma'));

      // A chave unica e (userId, url), e nao url: duas pessoas podem guardar
      // a mesma vaga.
      expect(await prisma.savedJob.count()).toBe(2);
    });

    it('o snapshot vira os campos de salario e elegibilidade no DTO', async () => {
      const id = await criarUsuario();
      await servico.salvar(
        id,
        vaga('https://a.com/1', {
          snapshot: {
            salaryMin: 120000,
            salaryMax: 160000,
            currency: 'USD',
            elegivelGlobal: true,
            paisesElegiveis: ['BR', 'AR'],
          },
        } as Partial<SalvarVagaDto>),
      );

      const [v] = await servico.listar(id);
      expect(v.salaryMin).toBe(120000);
      expect(v.salaryMax).toBe(160000);
      expect(v.currency).toBe('USD');
      expect(v.elegivelGlobal).toBe(true);
      expect(v.paisesElegiveis).toEqual(['BR', 'AR']);
    });

    it('sem snapshot, os campos derivados sao null e nao quebram', async () => {
      const id = await criarUsuario();
      await servico.salvar(id, vaga('https://a.com/1'));

      const [v] = await servico.listar(id);
      expect(v.salaryMin).toBeNull();
      expect(v.currency).toBeNull();
      // `elegivelGlobal` e o unico com default `false`, e nao null: a tela
      // desenha um selo, e `null` viraria "undefined" no texto.
      expect(v.elegivelGlobal).toBe(false);
      expect(v.paisesElegiveis).toBeNull();
    });

    it('o id do DTO e a URL — e o que casa com a lista de resultados', async () => {
      const id = await criarUsuario();
      await servico.salvar(id, vaga('https://a.com/1'));

      const [v] = await servico.listar(id);
      // A estrela na lista de busca compara por este id. Se ele virasse o
      // uuid da linha, nenhuma vaga apareceria como ja salva.
      expect(v.id).toBe('https://a.com/1');
      expect(v.id).toBe(v.url);
    });

    it('data sai como string ISO, nunca Date', async () => {
      const id = await criarUsuario();
      await servico.salvar(id, vaga('https://a.com/1', { postedAt: '2026-08-01T00:00:00.000Z' }));

      const [v] = await servico.listar(id);
      expect(typeof v.foundAt).toBe('string');
      expect(typeof v.postedAt).toBe('string');
      expect(v.postedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('a lista vem da mais recente para a mais antiga', async () => {
      const id = await criarUsuario();
      await servico.salvar(id, vaga('https://a.com/1'));
      await servico.salvar(id, vaga('https://a.com/2'));
      await servico.salvar(id, vaga('https://a.com/3'));

      const urls = (await servico.listar(id)).map((v) => v.url);
      expect(urls[0]).toBe('https://a.com/3');
      expect(urls[2]).toBe('https://a.com/1');
    });

    it('lista de quem nao salvou nada e vazia, e nao erro', async () => {
      const id = await criarUsuario();
      expect(await servico.listar(id)).toEqual([]);
    });
  });

  describe('apagar a conta leva as vagas junto', () => {
    it('onDelete: Cascade — remover o usuario remove as salvas', async () => {
      const id = await criarUsuario();
      await servico.salvar(id, vaga('https://a.com/1'));
      await servico.salvar(id, vaga('https://a.com/2'));
      expect(await prisma.savedJob.count()).toBe(2);

      await prisma.user.delete({ where: { id } });

      // Sem o Cascade a exclusao falharia por foreign key, ou pior, deixaria
      // linha orfa apontando para um usuario que nao existe.
      expect(await prisma.savedJob.count()).toBe(0);
    });
  });
});
