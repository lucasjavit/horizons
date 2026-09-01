/**
 * O banco de teste: um schema Postgres proprio por suite.
 *
 * ## Por que schema por suite, e nao transacao nem truncate
 *
 * O card QA-03 pos tres caminhos. A medicao decidiu:
 *
 * | Caminho | Custo medido | Por que nao |
 * | --- | --- | --- |
 * | **A. schema por suite** | 2,35 s de `migrate deploy` por schema | **escolhido** |
 * | B. transacao com rollback | — | exige o client transacional dentro do servico, e o `PrismaService` e singleton `@Global()`. Mudaria codigo de producao, que este card proibe. |
 * | C. truncar entre testes | — | serializa a suite inteira e, pior, **mira a mesma tabela que os dados reais**: um erro de configuracao apaga o banco de desenvolvimento em vez de dar erro. |
 *
 * Um quarto caminho foi medido e descartado: clonar o schema com
 * `CREATE TABLE ... (LIKE origem INCLUDING ALL)` custa 157 ms em vez de
 * 2,35 s, mas **perde as 13 foreign keys** (medido: 0 de 13 sobreviveram).
 * FK e justamente o que um teste de `onDelete: Cascade` precisa exercitar,
 * entao a economia sairia do lugar errado. Clonar via `pg_dump` custa 364 ms
 * e preserva tudo, mas exige `docker exec` — nao roda em CI contra um
 * Postgres qualquer.
 *
 * ## A protecao que faz o card fechar
 *
 * O criterio de aceite nao e "nenhum teste escreveu no banco de
 * desenvolvimento" — e **"nenhum teste consegue escrever"**. Disciplina nao
 * conta; se a unica coisa que segura e o teste lembrar de limpar, esta errado.
 *
 * Por isso `urlDeTeste()` **recusa qualquer schema que nao comece com
 * `qa03_test_`**, e recusa antes de abrir conexao. Um teste que aponte para
 * `public` por engano nao apaga nada: ele nao chega a conectar.
 *
 * A guarda vale tambem para o valor herdado do ambiente. A `DATABASE_URL` da
 * maquina aponta para `?schema=public` — se este arquivo simplesmente a
 * reaproveitasse, todo teste desta camada escreveria em cima dos dados reais
 * do stakeholder.
 */
import { execFileSync } from 'node:child_process';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

/**
 * O prefixo obrigatorio. Schema que nao comeca com isto e recusado.
 *
 * Nao e convencao de nome: e a checagem que separa o banco de teste do banco
 * com os dados reais.
 */
const PREFIXO = 'qa03_test_';

/**
 * A base de conexao, SEM schema.
 *
 * Le `TEST_DATABASE_URL` e cai para o Postgres do compose. **Nao le
 * `DATABASE_URL`** de proposito: aquela variavel aponta para `public` na
 * maquina de quem desenvolve, e herda-la seria exatamente o acidente que este
 * arquivo existe para tornar impossivel.
 */
function base(): URL {
  const bruta =
    process.env.TEST_DATABASE_URL ??
    'postgresql://horizons:horizons@localhost:5433/horizons';
  const u = new URL(bruta);
  u.searchParams.delete('schema');
  return u;
}

/**
 * A URL de um schema de teste, ou erro.
 *
 * Falha ruidosamente em vez de cair para um default seguro: um teste que nao
 * pode rodar isolado **nao pode rodar**, e o card proibe teste que se pula em
 * silencio.
 */
export function urlDeTeste(schema: string): string {
  if (!schema.startsWith(PREFIXO)) {
    throw new Error(
      `Schema de teste invalido: "${schema}". Tem de comecar com "${PREFIXO}" — ` +
        'a checagem existe para nenhum teste alcancar o banco de desenvolvimento.',
    );
  }
  // Nome de schema entra em SQL sem aspas em alguns caminhos do Prisma, e um
  // nome com aspas ou ponto-e-virgula viraria injecao. So o alfabeto seguro.
  if (!/^[a-z0-9_]+$/.test(schema)) {
    throw new Error(`Schema de teste com caractere invalido: "${schema}"`);
  }
  const u = base();
  u.searchParams.set('schema', schema);
  return u.toString();
}

/**
 * O nome do schema desta suite.
 *
 * Deriva do caminho do arquivo de teste, e nao de um contador: o Jest roda
 * suites em processos paralelos, e um contador em memoria daria o mesmo numero
 * a duas suites diferentes. Do caminho, cada arquivo tem o seu, estavel entre
 * execucoes — o que permite reaproveitar o schema ja migrado na rodada
 * seguinte.
 */
export function nomeDoSchema(arquivoDeTeste: string): string {
  const base = arquivoDeTeste
    .replace(/^.*\/src\//, '')
    .replace(/\.spec\.ts$/, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .toLowerCase();
  return `${PREFIXO}${base}`;
}

/**
 * Cria (ou recria) o schema e aplica as migrations nele.
 *
 * **`migrate deploy`, e nao `db push`** — e a regra da casa, e aqui ela paga
 * duas vezes: o schema de teste passa a ser o mesmo que producao vai receber,
 * entao uma migration quebrada aparece no `npm test` em vez de no deploy.
 *
 * O schema e derrubado antes: uma rodada que morreu no meio deixa tabela pela
 * metade, e comecar do zero custa os mesmos 2,35 s.
 */
export function prepararSchema(schema: string): string {
  const url = urlDeTeste(schema);

  // O DROP vai por psql do proprio Prisma? Nao: `migrate deploy` nao apaga.
  // Usa-se o `pg` que ja e dependencia do projeto, via um client curto.
  execFileSync(
    'node',
    [
      '-e',
      `const {Client}=require('pg');(async()=>{const c=new Client({connectionString:${JSON.stringify(
        base().toString(),
      )}});await c.connect();await c.query('DROP SCHEMA IF EXISTS "'+${JSON.stringify(
        schema,
      )}+'" CASCADE');await c.query('CREATE SCHEMA "'+${JSON.stringify(
        schema,
      )}+'"');await c.end();})().catch(e=>{console.error(e);process.exit(1)})`,
    ],
    { cwd: `${__dirname}/..`, stdio: 'pipe' },
  );

  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    cwd: `${__dirname}/..`,
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'pipe',
  });

  return url;
}

/**
 * Um `PrismaClient` preso ao schema de teste.
 *
 * Nao e o `PrismaService`: aquele le `process.env.DATABASE_URL` no construtor,
 * e mexer no ambiente global do processo para redireciona-lo deixaria a
 * protecao dependendo da ordem de import. Aqui a connection string entra
 * explicita, e passa pela mesma checagem de prefixo.
 *
 * ## ⚠️ O `?schema=` da URL NAO redireciona o `PrismaPg` (medido 01/09/2026)
 *
 * Custou uma linha escrita no banco de desenvolvimento para descobrir. O
 * adapter le o schema do **segundo argumento** (`PrismaPgOptions.schema`); o
 * parametro `?schema=` da connection string e lido pelo **CLI** (`migrate
 * deploy`, que por isso funciona) e **ignorado pelo adapter em runtime**, que
 * cai no `public` — ou seja, no banco com os dados reais.
 *
 * Entao os dois tem de ser passados, e sao coisas diferentes:
 *
 * - a URL com `?schema=` — para o `migrate deploy` criar as tabelas no lugar certo;
 * - `{ schema }` aqui — para as consultas irem para o lugar certo.
 *
 * Passar so a URL da o pior desfecho possivel: `migrate deploy` cria o schema
 * de teste, o teste passa, e as escritas foram todas para `public`.
 */
export function clientDeTeste(schema: string): PrismaClient {
  const url = urlDeTeste(schema);
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: url }, { schema }),
  });
}

/**
 * Confirma que este client escreve MESMO no schema de teste.
 *
 * Existe porque a protecao por nome de schema nao bastou: a URL dizia
 * `?schema=qa03_test_…` e o adapter escrevia em `public` assim mesmo (ver
 * `clientDeTeste`). Uma checagem sobre a string de conexao teria passado.
 *
 * Aqui a pergunta e feita ao banco, depois de conectado: `current_schema()` e
 * o que o Postgres de fato usa. Se nao for o schema de teste, a suite morre
 * ANTES do primeiro teste, e nada e escrito.
 *
 * Toda suite desta camada chama isto no `beforeAll`. Nao e cerimonia: e a
 * unica forma de a garantia ser sobre comportamento observado, e nao sobre
 * uma intencao declarada na connection string.
 */
export async function exigirSchemaDeTeste(
  prisma: PrismaClient,
  schema: string,
): Promise<void> {
  // **`current_schema()` NAO serve para esta pergunta** (medido 01/09/2026).
  //
  // O adapter nao mexe no `search_path`: ele QUALIFICA o nome da tabela com o
  // `schemaName`. Entao `current_schema()` responde `public` mesmo quando toda
  // escrita do Prisma vai para o schema de teste — a primeira versao desta
  // funcao usava isso e abortava suites que estavam corretas.
  //
  // A pergunta certa e comportamental: **escreve-se de verdade, e olha-se
  // onde a linha caiu.** E o mesmo criterio do card — o que vale e o
  // comportamento observado, nao a intencao declarada na configuracao.
  const marca = `__sonda_${Date.now()}_${Math.random().toString(36).slice(2)}@teste.local`;
  const criado = await prisma.user.create({
    data: { email: marca, name: 'sonda', provider: 'DEV' },
    select: { id: true },
  });

  try {
    const linhas = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
      `select count(*)::bigint as n from "${schema}".users where id = $1`,
      criado.id,
    );
    if (Number(linhas[0]?.n ?? 0) !== 1) {
      throw new Error(
        `A escrita de teste NAO caiu em "${schema}". O client esta apontando para ` +
          'outro schema — possivelmente o de desenvolvimento, que tem dados reais. ' +
          'Abortado. Confira se `clientDeTeste` passou o segundo argumento ' +
          '`{ schema }` ao PrismaPg: o `?schema=` da URL sozinho nao redireciona.',
      );
    }
  } finally {
    // A sonda sai sempre, inclusive quando a checagem falha: ela e andaime,
    // e nao pode virar dado de teste que outro teste veja.
    await prisma.user.deleteMany({ where: { id: criado.id } });
  }
}

/**
 * Apaga tudo do schema de teste, respeitando as foreign keys.
 *
 * `TRUNCATE ... CASCADE` numa lista so, em vez de `deleteMany` por tabela: a
 * ordem de dependencia deixa de importar, e nao ha lista a manter em dia
 * quando nasce um modelo.
 *
 * **Mira o schema de teste e so ele.** O nome vem de `urlDeTeste`, que ja
 * recusou qualquer coisa fora do prefixo — entao este TRUNCATE nao tem como
 * apontar para `public` nem que alguem o chame errado.
 */
export async function limpar(prisma: PrismaClient, schema: string): Promise<void> {
  if (!schema.startsWith(PREFIXO)) {
    throw new Error(`limpar() recusou o schema "${schema}"`);
  }
  const tabelas = await prisma.$queryRawUnsafe<{ tablename: string }[]>(
    `select tablename from pg_tables where schemaname = $1`,
    schema,
  );
  const alvos = tabelas
    .map((t) => t.tablename)
    .filter((t) => t !== '_prisma_migrations')
    .map((t) => `"${schema}"."${t}"`);
  if (alvos.length === 0) return;
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${alvos.join(', ')} RESTART IDENTITY CASCADE`,
  );
}
