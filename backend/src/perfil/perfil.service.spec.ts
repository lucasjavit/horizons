/**
 * Camada 2 — `PerfilService` contra um Postgres de verdade.
 *
 * Os testes vem das REGRAS escritas no card PLT-10 e no proprio servico, e
 * nao da leitura do `if`. As tres que este arquivo existe para segurar:
 *
 * 1. **trocar de pais apaga o documento guardado** — um CPF valido nao e um
 *    CUIT, e aceitar em silencio o documento antigo e o defeito nomeado;
 * 2. **"Not set" tambem apaga** — o bug que o QA achou em 31/08: com `pais &&`
 *    no lugar de `corpo.country !== undefined`, escolher "Not set" deixava o
 *    documento orfao, sem gesto na tela capaz de remove-lo;
 * 3. **campo ausente nao mexe; string vazia apaga** — quem salva so o telefone
 *    nao pode perder o endereco.
 *
 * Por que com banco e nao com duble: o que se quer provar e o `data:` que
 * chega ao Prisma, e um duble que eu mesmo escrevo confirmaria o que eu acho
 * que o Prisma faz com `undefined` — que e exatamente a armadilha (JOB-05).
 */
import { BadRequestException } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import { PerfilService } from './perfil.service';
import type { PrismaService } from '../prisma/prisma.service';
import { decifrar, SALT_DOCUMENTOS } from '../settings/crypto';
import {
  clientDeTeste,
  exigirSchemaDeTeste,
  limpar,
  nomeDoSchema,
  prepararSchema,
} from '../../test/banco-de-teste';

const SCHEMA = nomeDoSchema(__filename);

/** Um CPF valido e um CUIT valido, para exercitar a troca de pais. */
const CPF = '529.982.247-25';
const CUIT = '20-24568789-4';

describe('PerfilService (banco)', () => {
  let prisma: PrismaClient;
  let servico: PerfilService;

  beforeAll(async () => {
    prepararSchema(SCHEMA);
    prisma = clientDeTeste(SCHEMA);
    // Prova, escrevendo, que este client nao alcanca o banco de
    // desenvolvimento. Falha aqui aborta a suite antes do primeiro teste.
    await exigirSchemaDeTeste(prisma, SCHEMA);
    servico = new PerfilService(prisma as unknown as PrismaService);
  }, 120_000);

  afterAll(async () => {
    await prisma.$disconnect();
  });

  /**
   * Cada teste comeca do zero e cria o proprio usuario.
   *
   * O card proibe teste que dependa de dado que outro criou — e aqui isso
   * nao e disciplina: o `limpar` roda antes de CADA teste, entao um teste que
   * dependesse do vizinho falharia na primeira execucao.
   */
  beforeEach(async () => {
    await limpar(prisma, SCHEMA);
  });

  async function criarUsuario(dados: Record<string, unknown> = {}): Promise<string> {
    const u = await prisma.user.create({
      data: {
        email: `p${Math.random().toString(36).slice(2)}@teste.local`,
        name: 'Pessoa',
        provider: 'DEV',
        ...dados,
      },
      select: { id: true },
    });
    return u.id;
  }

  describe('trocar de pais e o documento guardado', () => {
    it('apaga o documento quando o pais muda e nao vem documento novo', async () => {
      const id = await criarUsuario();
      await servico.salvar(id, { country: 'BR', document: CPF });

      const antes = await servico.ler(id);
      expect(antes.documentHint).not.toBeNull();
      expect(antes.documentCountry).toBe('BR');

      // Muda so o pais. O CPF guardado nao vale como documento argentino.
      const depois = await servico.salvar(id, { country: 'AR' });

      expect(depois.country).toBe('AR');
      expect(depois.documentHint).toBeNull();
      expect(depois.documentCountry).toBeNull();

      // E o valor cifrado saiu do banco de verdade, e nao so do DTO.
      const linha = await prisma.user.findUnique({
        where: { id },
        select: { documentEnc: true },
      });
      expect(linha?.documentEnc).toBeNull();
    });

    it('"Not set" apaga o documento — o bug de 31/08', async () => {
      const id = await criarUsuario();
      await servico.salvar(id, { country: 'BR', document: CPF });

      // "Not set" na tela manda `country: ''`. Com a regra antiga (`pais &&`)
      // este caso caia fora dos tres ramos e o documento sobrevivia orfao:
      // pais nulo, documento cifrado, e nenhum gesto capaz de apaga-lo.
      const depois = await servico.salvar(id, { country: '' });

      expect(depois.country).toBeNull();
      expect(depois.documentHint).toBeNull();
      expect(depois.documentCountry).toBeNull();

      const linha = await prisma.user.findUnique({
        where: { id },
        select: { documentEnc: true },
      });
      expect(linha?.documentEnc).toBeNull();
    });

    it('mandar o pais IGUAL nao apaga o documento', async () => {
      const id = await criarUsuario();
      await servico.salvar(id, { country: 'BR', document: CPF });

      // A tela reenvia o formulario inteiro; `country` vem sempre. Se a regra
      // fosse "veio country, apaga", salvar o telefone apagaria o CPF.
      const depois = await servico.salvar(id, { country: 'BR', phone: '+55 11 90000-0000' });

      expect(depois.documentHint).not.toBeNull();
      expect(depois.documentCountry).toBe('BR');
    });

    it('trocar de pais MANDANDO o documento novo guarda o novo', async () => {
      const id = await criarUsuario();
      await servico.salvar(id, { country: 'BR', document: CPF });

      const depois = await servico.salvar(id, { country: 'AR', document: CUIT });

      expect(depois.documentCountry).toBe('AR');
      const linha = await prisma.user.findUnique({
        where: { id },
        select: { documentEnc: true },
      });
      expect(decifrar(linha!.documentEnc!, SALT_DOCUMENTOS)).toBe(CUIT);
    });

    it('document: "" apaga sem trocar de pais', async () => {
      const id = await criarUsuario();
      await servico.salvar(id, { country: 'BR', document: CPF });

      const depois = await servico.salvar(id, { document: '' });

      expect(depois.documentHint).toBeNull();
      expect(depois.documentCountry).toBeNull();
      // O pais continua: apagar o documento nao e mudar de pais.
      expect(depois.country).toBe('BR');
    });
  });

  describe('o documento e cifrado, e nunca volta em claro', () => {
    it('grava cifrado e devolve so a dica', async () => {
      const id = await criarUsuario();
      const dto = await servico.salvar(id, { country: 'BR', document: CPF });

      // O DTO nao tem campo `document` — nem parcialmente.
      expect(dto).not.toHaveProperty('document');
      expect(dto).not.toHaveProperty('documentEnc');
      expect(dto.documentHint).toBe('4725');

      const linha = await prisma.user.findUnique({
        where: { id },
        select: { documentEnc: true },
      });
      // Cifrado: o CPF nao aparece cru no que foi gravado.
      expect(linha!.documentEnc).not.toContain('529');
      expect(decifrar(linha!.documentEnc!, SALT_DOCUMENTOS)).toBe(CPF);
    });

    it('recusa documento invalido para o pais, e nao grava nada', async () => {
      const id = await criarUsuario();
      // CUIT argentino apresentado como CPF brasileiro.
      await expect(servico.salvar(id, { country: 'BR', document: CUIT })).rejects.toThrow(
        BadRequestException,
      );

      const linha = await prisma.user.findUnique({
        where: { id },
        select: { documentEnc: true, country: true },
      });
      // A recusa e ANTES da gravacao: nem o pais entrou.
      expect(linha?.documentEnc).toBeNull();
      expect(linha?.country).toBeNull();
    });

    it('recusa documento sem pais escolhido', async () => {
      const id = await criarUsuario();
      await expect(servico.salvar(id, { document: CPF })).rejects.toThrow(
        /Escolha o pais/,
      );
    });
  });

  describe('salvar um campo preserva os outros', () => {
    it('salvar so o telefone nao apaga o endereco nem o documento', async () => {
      const id = await criarUsuario();
      await servico.salvar(id, {
        country: 'BR',
        document: CPF,
        address: { street: 'Rua das Flores', number: '10', city: 'Sao Paulo' },
      });

      // So o telefone. Em Prisma, `undefined` no `data:` descarta o campo —
      // e o que se quer aqui, e o teste existe para isso continuar verdade.
      const depois = await servico.salvar(id, { phone: '+55 11 98888-7777' });

      expect(depois.phone).toBe('+55 11 98888-7777');
      expect(depois.address.street).toBe('Rua das Flores');
      expect(depois.address.number).toBe('10');
      expect(depois.address.city).toBe('Sao Paulo');
      expect(depois.documentHint).not.toBeNull();
      expect(depois.country).toBe('BR');
    });

    it('mexer no endereco nao apaga o telefone', async () => {
      const id = await criarUsuario();
      await servico.salvar(id, { phone: '+55 11 97777-6666' });

      const depois = await servico.salvar(id, { address: { city: 'Recife' } });

      expect(depois.phone).toBe('+55 11 97777-6666');
      expect(depois.address.city).toBe('Recife');
    });

    it('campo de endereco ausente nao vira null', async () => {
      const id = await criarUsuario();
      await servico.salvar(id, {
        address: { street: 'Av Paulista', number: '1000', city: 'Sao Paulo', state: 'SP' },
      });

      // `address` presente, mas so com `city`. Os outros nao vieram: nao mexem.
      const depois = await servico.salvar(id, { address: { city: 'Campinas' } });

      expect(depois.address.city).toBe('Campinas');
      expect(depois.address.street).toBe('Av Paulista');
      expect(depois.address.number).toBe('1000');
      expect(depois.address.state).toBe('SP');
    });

    it('string vazia num campo de endereco APAGA aquele campo', async () => {
      const id = await criarUsuario();
      await servico.salvar(id, {
        address: { street: 'Av Paulista', complement: 'apto 42', city: 'Sao Paulo' },
      });

      // Apagar o complemento e gesto legitimo: mudou de apartamento para casa.
      const depois = await servico.salvar(id, { address: { complement: '' } });

      expect(depois.address.complement).toBeNull();
      expect(depois.address.street).toBe('Av Paulista');
      expect(depois.address.city).toBe('Sao Paulo');
    });

    it('endereco sobrevive a troca de moradia campo a campo', async () => {
      const id = await criarUsuario();
      await servico.salvar(id, {
        address: {
          street: 'Rua A',
          number: '1',
          district: 'Centro',
          city: 'Curitiba',
          state: 'PR',
          postalCode: '80010-000',
          country: 'BR',
        },
      });

      const depois = await servico.salvar(id, {
        address: { street: 'Rua B', number: '2', city: 'Florianopolis', state: 'SC' },
      });

      expect(depois.address.street).toBe('Rua B');
      expect(depois.address.city).toBe('Florianopolis');
      // Nao vieram no corpo: continuam.
      expect(depois.address.district).toBe('Centro');
      expect(depois.address.postalCode).toBe('80010-000');
      expect(depois.address.country).toBe('BR');
    });
  });

  describe('validacao de endereco', () => {
    it('recusa endereco invalido ANTES de gravar qualquer campo', async () => {
      const id = await criarUsuario();
      await servico.salvar(id, { phone: '+55 11 96666-5555' });

      // Um caractere fora do alfabeto de logradouro derruba o salvamento
      // inteiro — inclusive o telefone que veio junto e era valido.
      await expect(
        servico.salvar(id, {
          phone: '+55 11 95555-4444',
          address: { city: 'São Paulo <script>' },
        }),
      ).rejects.toThrow(BadRequestException);

      const depois = await servico.ler(id);
      expect(depois.phone).toBe('+55 11 96666-5555');
      expect(depois.address.city).toBeNull();
    });

    it('recusa codigo postal invalido', async () => {
      const id = await criarUsuario();
      await expect(
        servico.salvar(id, { address: { postalCode: '!!!!!!!!!!' } }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('leitura', () => {
    it('usuario inexistente da BadRequest, e nao null', async () => {
      // Um uuid bem formado que nao existe. Nao se usa string qualquer: o
      // CLAUDE.md registra que id impossivel derruba o Postgres.
      await expect(
        servico.ler('00000000-0000-4000-8000-000000000000'),
      ).rejects.toThrow(BadRequestException);
    });

    it('perfil vazio volta com todos os campos null, e nao undefined', async () => {
      const id = await criarUsuario();
      const dto = await servico.ler(id);

      expect(dto.country).toBeNull();
      expect(dto.phone).toBeNull();
      expect(dto.documentHint).toBeNull();
      expect(dto.documentCountry).toBeNull();
      // O endereco volta como objeto com nulos, e nao ausente: a tela desenha
      // os campos sem precisar checar se `address` existe.
      expect(dto.address).toEqual({
        street: null,
        number: null,
        complement: null,
        district: null,
        city: null,
        state: null,
        postalCode: null,
        country: null,
      });
    });

    it('pais fora da lista curada volta como null, e nao como rotulo vazio', async () => {
      // Simula um pais que saiu da lista depois de gravado — so o banco pode
      // produzir este estado, entao o teste precisa do banco.
      const id = await criarUsuario({ country: 'XX', addressCountry: 'XX' });

      const dto = await servico.ler(id);

      expect(dto.country).toBeNull();
      expect(dto.address.country).toBeNull();
    });
  });

  describe('a lista de paises', () => {
    it('nao toca no banco e marca quem tem regra de verdade', () => {
      const paises = servico.paises();
      const br = paises.find((p) => p.codigo === 'BR');
      expect(br?.validado).toBe(true);
      // Todo pais tem os campos que a tela desenha.
      for (const p of paises) {
        expect(typeof p.nome).toBe('string');
        expect(p.nome.length).toBeGreaterThan(0);
        expect(typeof p.ddi).toBe('string');
      }
    });
  });
});
