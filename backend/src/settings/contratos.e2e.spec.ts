/**
 * Camada 3 — **os contratos de entrada e de saida.**
 *
 * Duas garantias diferentes, e as duas ja falharam neste projeto:
 *
 * ## 1. `forbidNonWhitelisted` — campo sem decorador rejeita com 400
 *
 * O `ValidationPipe` global e configurado com `whitelist` e
 * `forbidNonWhitelisted` (CLAUDE.md). Sem o segundo, um campo desconhecido no
 * corpo seria **descartado em silencio**: quem digitou veria "salvo" e o dado
 * nao estaria la.
 *
 * ## 2. Os DTOs de resposta nao carregam segredo
 *
 * **O PLT-12 nasceu de um `hint` que vazou por meses.** `GET /settings/recursos`
 * era aberto quando so devolvia um booleano; o JOB-33 e o JOB-36
 * acrescentaram `provedores`, `ordemDaIa` e `iaDaBusca` ao DTO, e o comentario
 * que justificava a abertura ("nao ha chave nem segredo nesta resposta")
 * envelheceu sem que nada apontasse para ele. Usuario comum passou a receber os
 * quatro ultimos caracteres da chave do admin.
 *
 * Este arquivo e a rede que faltava. Ele nao confere uma lista de campos
 * proibidos que alguem lembrou de escrever: ele **varre a resposta inteira,
 * recursivamente**, atras de qualquer chave que cheire a segredo. Campo novo
 * que vaze quebra isto, mesmo que ninguem tenha pensado nele.
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
 * Nomes de campo que nao podem sair numa resposta de PRODUTO.
 *
 * A lista e por SUBSTRING e minuscula: `documentEnc`, `document_hint` e
 * `cpfDocument` caem todos. Um teste que comparasse nomes exatos deixaria
 * passar a variacao que alguem escrever amanha.
 */
const CHEIRO_DE_SEGREDO = [
  'document',
  'hint',
  'token',
  'secret',
  'apikey',
  'api_key',
  'senha',
  'password',
  'enc',
];

/**
 * Percorre o objeto inteiro e devolve o caminho de toda chave suspeita.
 *
 * Recursivo de proposito: o vazamento do PLT-12 estava DENTRO de
 * `provedores[].hint`, e nao no primeiro nivel da resposta. Um
 * `Object.keys(corpo)` teria passado.
 */
function chavesSuspeitas(valor: unknown, caminho = ''): string[] {
  if (valor === null || typeof valor !== 'object') return [];
  if (Array.isArray(valor)) {
    return valor.flatMap((item, i) => chavesSuspeitas(item, `${caminho}[${i}]`));
  }
  const achados: string[] = [];
  for (const [chave, dentro] of Object.entries(valor as Record<string, unknown>)) {
    const onde = caminho ? `${caminho}.${chave}` : chave;
    const minuscula = chave.toLowerCase();
    if (CHEIRO_DE_SEGREDO.some((p) => minuscula.includes(p))) {
      achados.push(onde);
    }
    achados.push(...chavesSuspeitas(dentro, onde));
  }
  return achados;
}

describe('contratos de entrada e saida (camada 3)', () => {
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
  async function conta(role: string): Promise<{ id: string; email: string; token: string }> {
    n += 1;
    const email = `c${n}.${Math.random().toString(36).slice(2)}@teste.local`;
    const u = await prisma.user.create({
      data: { email, name: `Pessoa ${n}`, provider: 'DEV', role },
      select: { id: true, email: true, role: true },
    });
    return { id: u.id, email: u.email, token: assinarToken(u) };
  }

  function agente() {
    return request(ctx.servidor as Parameters<typeof request>[0]);
  }

  describe('forbidNonWhitelisted — campo desconhecido da 400', () => {
    it('PUT /perfil com campo inventado rejeita, e nao ignora', async () => {
      const { token } = await conta('COMMON_USER');

      const resp = await agente()
        .put('/api/perfil')
        .set('Authorization', `Bearer ${token}`)
        .send({ phone: '+55 11 90000-0000', campoQueNaoExiste: 'x' });

      expect(resp.status).toBe(400);
      // A mensagem diz QUAL campo sobrou: sem isso, quem manda o corpo errado
      // recebe um 400 mudo e nao sabe o que tirar.
      expect(JSON.stringify(resp.body)).toContain('campoQueNaoExiste');
    });

    it('e o corpo valido do lado passa — o pipe nao rejeita tudo', async () => {
      // O contrapositivo. Um `forbidNonWhitelisted` mal configurado que
      // recusasse corpo legitimo passaria no teste acima.
      const { token } = await conta('COMMON_USER');

      const resp = await agente()
        .put('/api/perfil')
        .set('Authorization', `Bearer ${token}`)
        .send({ phone: '+55 11 90000-0000' });

      expect(resp.status).toBe(200);
      expect(resp.body.phone).toBe('+55 11 90000-0000');
    });

    it('campo desconhecido DENTRO do endereco tambem rejeita', async () => {
      // O `@ValidateNested` so enxerga os decoradores de dentro se o `@Type`
      // estiver la. Sem ele o endereco entra SEM validacao nenhuma — falha
      // silenciosa, que e a pior (ver `perfil.dto.ts`).
      const { token } = await conta('COMMON_USER');

      const resp = await agente()
        .put('/api/perfil')
        .set('Authorization', `Bearer ${token}`)
        .send({ address: { city: 'Sao Paulo', campoIntruso: 'x' } });

      expect(resp.status).toBe(400);
    });

    it('PATCH /usuarios/:id/papel com role fora da lista da 400', async () => {
      const admin = await conta('ADMIN');
      const alvo = await conta('COMMON_USER');

      const resp = await agente()
        .patch(`/api/usuarios/${alvo.id}/papel`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ role: 'IMPERADOR' });

      expect(resp.status).toBe(400);
    });

    it('tipo errado tambem da 400 — `active` como string nao vira booleano', async () => {
      // `transform: true` converte o que o DTO declara, e o `@IsBoolean()`
      // recusa o resto. Sem isso, `"false"` (string) seria truthy e desativaria
      // a conta que alguem queria reativar.
      const admin = await conta('ADMIN');
      const alvo = await conta('COMMON_USER');

      const resp = await agente()
        .patch(`/api/usuarios/${alvo.id}/ativo`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ active: 'false' });

      expect(resp.status).toBe(400);
    });

    it('query desconhecida em GET /usuarios tambem rejeita', async () => {
      const { token } = await conta('ADMIN');

      const resp = await agente()
        .get('/api/usuarios?paginaX=2')
        .set('Authorization', `Bearer ${token}`);

      expect(resp.status).toBe(400);
    });
  });

  describe('a rota de PRODUTO devolve exatamente dois booleanos (PLT-12)', () => {
    it('nao ha um terceiro campo, seja ele qual for', async () => {
      const { token } = await conta('COMMON_USER');

      const resp = await agente()
        .get('/api/settings/recursos/produto')
        .set('Authorization', `Bearer ${token}`);

      expect(resp.status).toBe(200);
      // Igualdade de conjunto, e nao "contem": e o que pega o campo
      // acrescentado sem pensar. Qualquer chave a mais reprova aqui.
      expect(Object.keys(resp.body).sort()).toEqual(['historicoAtivo', 'leituraCvAtiva']);
      expect(typeof resp.body.leituraCvAtiva).toBe('boolean');
      expect(typeof resp.body.historicoAtivo).toBe('boolean');
    });

    it('e nada nela cheira a segredo, em nivel nenhum', async () => {
      const { token } = await conta('COMMON_USER');

      const resp = await agente()
        .get('/api/settings/recursos/produto')
        .set('Authorization', `Bearer ${token}`);

      expect(chavesSuspeitas(resp.body)).toEqual([]);
    });

    it('o ADMIN tambem a alcanca — ela e de produto, nao de papel', async () => {
      const { token } = await conta('ADMIN');
      const resp = await agente()
        .get('/api/settings/recursos/produto')
        .set('Authorization', `Bearer ${token}`);
      expect(resp.status).toBe(200);
    });
  });

  describe('GET /perfil nunca devolve o documento', () => {
    it('devolve o hint, e NAO o documento em claro nem o cifrado', async () => {
      // O documento nunca volta para a tela, nem parcialmente: o que volta e
      // `documentHint`, os ultimos digitos (mesmo gesto do `hint` do ApiToken).
      const { id, token } = await conta('COMMON_USER');
      await prisma.user.update({
        where: { id },
        data: {
          documentEnc: 'cifrado-de-mentira',
          documentHint: '4725',
          documentCountry: 'BR',
        },
      });

      const resp = await agente()
        .get('/api/perfil')
        .set('Authorization', `Bearer ${token}`);

      expect(resp.status).toBe(200);
      const chaves = Object.keys(resp.body);
      expect(chaves).toContain('documentHint');
      // Estes tres nunca: `document` e o valor, `documentEnc` e a cifra.
      expect(chaves).not.toContain('document');
      expect(chaves).not.toContain('documentEnc');
      // E o corpo inteiro, como texto, nao carrega a cifra em canto nenhum.
      expect(JSON.stringify(resp.body)).not.toContain('cifrado-de-mentira');
    });

    it('o hint tem so os ultimos digitos, e nao o documento inteiro', async () => {
      const { id, token } = await conta('COMMON_USER');
      await prisma.user.update({
        where: { id },
        data: { documentEnc: 'x', documentHint: '4725', documentCountry: 'BR' },
      });

      const resp = await agente()
        .get('/api/perfil')
        .set('Authorization', `Bearer ${token}`);

      expect(resp.body.documentHint).toBe('4725');
      expect(String(resp.body.documentHint).length).toBeLessThanOrEqual(4);
    });
  });

  describe('GET /usuarios nao carrega dado pessoal', () => {
    it('nenhuma chave suspeita na lista inteira, em nivel nenhum', async () => {
      const admin = await conta('ADMIN');
      const alvo = await conta('COMMON_USER');
      await prisma.user.update({
        where: { id: alvo.id },
        data: {
          phone: '+55 11 90000-0000',
          documentEnc: 'cifrado',
          documentHint: '4725',
          documentCountry: 'BR',
          addressCity: 'Sao Paulo',
        },
      });

      const resp = await agente()
        .get('/api/usuarios')
        .set('Authorization', `Bearer ${admin.token}`);

      expect(resp.status).toBe(200);
      // A varredura recursiva: o jeito mais seguro de nao vazar um campo e
      // nunca busca-lo, e este teste pega o campo acrescentado ao `select:`
      // sem pensar.
      expect(chavesSuspeitas(resp.body)).toEqual([]);
      expect(JSON.stringify(resp.body)).not.toContain('cifrado');
      expect(JSON.stringify(resp.body)).not.toContain('90000-0000');
    });

    it('as chaves de uma linha sao exatamente as contratadas', async () => {
      const admin = await conta('ADMIN');

      const resp = await agente()
        .get('/api/usuarios')
        .set('Authorization', `Bearer ${admin.token}`);

      expect(Object.keys(resp.body.itens[0]).sort()).toEqual(
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
  });

  describe('GET /auth/me nao devolve mais do que a identidade', () => {
    it('sem documento, telefone nem endereco', async () => {
      const { id, token } = await conta('COMMON_USER');
      await prisma.user.update({
        where: { id },
        data: { phone: '+55 11 91111-1111', documentEnc: 'cifra', documentHint: '9999' },
      });

      const resp = await agente()
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(resp.status).toBe(200);
      expect(chavesSuspeitas(resp.body)).toEqual([]);
      expect(Object.keys(resp.body).sort()).toEqual(
        ['avatarUrl', 'email', 'id', 'name', 'role'].sort(),
      );
    });
  });

  describe('GET /auth/config e publica e nao vaza segredo', () => {
    it('devolve so o que a tela de login precisa', async () => {
      // O healthcheck do compose bate aqui, sem token. Ela nao pode carregar
      // nada alem do necessario para desenhar (ou nao) o botao do Google.
      const resp = await agente().get('/api/auth/config');

      expect(resp.status).toBe(200);
      expect(Object.keys(resp.body).sort()).toEqual(
        ['authDisabled', 'enabled', 'googleClientId'].sort(),
      );
      // `googleClientId` e publico por natureza (vai para o navegador), mas o
      // JWT_SECRET jamais pode aparecer aqui.
      expect(JSON.stringify(resp.body)).not.toContain(process.env.JWT_SECRET as string);
    });
  });
});
