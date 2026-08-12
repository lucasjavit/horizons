import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'

// Prisma 7 — configuracao do CLI (migrate, studio, db push).
// A URL fica aqui, fora do schema.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: env('DATABASE_URL'),
  },
  // Prisma 7: o seed vive aqui, nao mais no bloco "prisma" do package.json.
  migrations: {
    seed: 'ts-node --compiler-options {"module":"CommonJS"} prisma/seed.ts',
  },
})
