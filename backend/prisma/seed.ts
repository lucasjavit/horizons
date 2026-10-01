import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL nao definida — copie .env.example para .env');
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const DEFAULT_USER_EMAIL = process.env.DEFAULT_USER_EMAIL ?? 'eu@horizons.local';

/**
 * O seed, depois do PLT-13.
 *
 * **Era o seed das trilhas** — 75 aulas em 13 modulos, de `prisma/seed/`. Com
 * as trilhas removidas (01/10) sobrou uma coisa so, e ela nao e opcional: o
 * usuario padrao.
 *
 * **Por que ele continua.** `AUTH_DISABLED=true` faz toda requisicao ser a
 * conta de `DEFAULT_USER_EMAIL` (`auth.service.ts`), e o `qa-rapido.py` conta
 * com ela para conferir os papeis. O CLAUDE.md registra o que acontece quando
 * esse usuario desaparece numa migration: em 31/08 oito checagens de papel
 * passaram a se pular em silencio, e nada falhava. Apagar o seed inteiro
 * repetiria exatamente aquele defeito.
 *
 * Nao ha mais conteudo a semear: as vagas vem da busca, e o invoice roda no
 * navegador.
 */
async function main(): Promise<void> {
  const user = await prisma.user.upsert({
    where: { email: DEFAULT_USER_EMAIL },
    update: {},
    create: { email: DEFAULT_USER_EMAIL, name: 'Eu' },
  });
  console.log(`usuario padrao: ${user.email}`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
