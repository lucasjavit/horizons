/**
 * A aplicacao de teste da camada 3: o `AppModule` inteiro, sobre o banco de
 * teste, atendendo `supertest`.
 *
 * ## Por que o AppModule inteiro, e nao um modulo por suite
 *
 * A camada 3 existe para testar o que so aparece quando as pecas estao
 * montadas: o guard global (`APP_GUARD`), o `ValidationPipe` com
 * `forbidNonWhitelisted`, o prefixo `/api` e a ordem em que as rotas foram
 * registradas. Um `Test.createTestingModule({ controllers: [X] })` monta o
 * controller SEM o guard global — e um teste de papel sobre uma aplicacao sem
 * guard passa sempre, medindo nada.
 *
 * ## O `PrismaService` e substituido, e isso e a protecao
 *
 * `PrismaService` le `process.env.DATABASE_URL` **no construtor** — e na
 * maquina de quem desenvolve aquela variavel aponta para o schema `public`,
 * com os 4 usuarios e as 5 chaves de IA cifradas do stakeholder.
 *
 * Entao ele nao e usado: o `overrideProvider` troca a instancia pelo client de
 * `clientDeTeste()`, que so conecta em schema com o prefixo `qa03_test_`. Nao
 * se mexe em `process.env.DATABASE_URL` de proposito — isso deixaria a
 * protecao dependendo da ordem de import, e um `import` que rodasse antes
 * ganharia o valor errado.
 *
 * O `exigirSchemaDeTeste()` confirma, por escrita real, que as linhas caem no
 * schema de teste antes de qualquer suite comecar.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { PrismaClient } from '@prisma/client';
import * as jwt from 'jsonwebtoken';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { clientDeTeste, exigirSchemaDeTeste, prepararSchema } from './banco-de-teste';

/**
 * ⚠️ A guarda que faz a camada 3 valer alguma coisa.
 *
 * `AUTH_DISABLED=true` faz o `AuthGuard` retornar ANTES de olhar papel: toda
 * rota passa, e todo mundo vira a conta de desenvolvimento. Um teste de papel
 * nesse modo **passa sem testar nada** — anonimo receberia 200 e o `expect`
 * de 401 seria o unico a falhar, o que faria alguem "consertar" o teste.
 *
 * Por isso a suite morre aqui, com a razao escrita, em vez de se pular. O card
 * QA-03 proibe teste que se pula em silencio, e este e o caso em que o silencio
 * custaria mais: a suite ficaria verde justamente enquanto a protecao que ela
 * mede esta desligada.
 *
 * Nao se resolve fixando `AUTH_DISABLED=false` no `ambiente.ts`: isso esconderia
 * a configuracao real da maquina, e a suite passaria a dizer que o fail closed
 * funciona num modo em que a aplicacao nao roda.
 */
export function exigirLoginLigado(): void {
  if (process.env.AUTH_DISABLED === 'true') {
    throw new Error(
      'AUTH_DISABLED=true — esta suite mede papel e fail closed, e com o login ' +
        'desligado o guard retorna antes de olhar papel: TODA rota responderia ' +
        '200 e o teste passaria sem medir nada. Rode com AUTH_DISABLED=false ' +
        '(ou sem a variavel). A suite falha de proposito em vez de se pular.',
    );
  }
}

/** O que uma suite da camada 3 recebe montado. */
export interface AplicacaoDeTeste {
  app: INestApplication;
  prisma: PrismaClient;
  /** O servidor http cru, que e o que o `supertest` recebe. */
  servidor: unknown;
}

/**
 * Sobe a aplicacao no schema de teste.
 *
 * **O pipe e o prefixo sao copiados de `src/main.ts` a mao**, e nao ha como
 * nao ser: `main.ts` chama `app.listen()`, e importa-lo abriria a porta 3333
 * no meio do `npm test`. A duplicacao e real e tem custo — se alguem trocar o
 * `forbidNonWhitelisted` la, aqui continuaria ligado — e por isso existe um
 * teste que confere que o 400 acontece de verdade (`contratos.e2e.spec.ts`),
 * em vez de confiar nesta montagem.
 */
export async function subirAplicacao(schema: string): Promise<AplicacaoDeTeste> {
  prepararSchema(schema);
  const prisma = clientDeTeste(schema);
  // Antes de qualquer rota existir: se a escrita nao cair no schema de teste, a
  // suite morre aqui, e nada e escrito no banco de desenvolvimento.
  await exigirSchemaDeTeste(prisma, schema);

  const modulo = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService)
    .useValue(prisma)
    .compile();

  const app = modulo.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.init();

  return { app, prisma, servidor: app.getHttpServer() };
}

/**
 * Assina um token para um usuario que existe no banco de teste.
 *
 * Usa o mesmo `JWT_SECRET` que o `ambiente.ts` define — que **nao e o de
 * producao**. Um token assinado aqui nao vale na aplicacao de verdade, e
 * vice-versa.
 *
 * O `role` vai no payload porque o token real o carrega, mas ele nao decide
 * nada: o guard rele o usuario do banco a cada request (CLAUDE.md), e e o
 * papel gravado que vale. Ha um teste que prova exatamente isso — token
 * dizendo ADMIN sobre uma linha COMMON_USER continua sendo negado.
 */
export function assinarToken(usuario: { id: string; email: string; role?: string }): string {
  const segredo = process.env.JWT_SECRET;
  if (!segredo) {
    throw new Error('JWT_SECRET ausente no ambiente de teste — veja test/ambiente.ts');
  }
  return jwt.sign(
    { sub: usuario.id, email: usuario.email, role: usuario.role ?? 'COMMON_USER' },
    segredo,
    { expiresIn: '1h' },
  );
}
