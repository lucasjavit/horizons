import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'

// Prisma 7 — configuracao do CLI (migrate, studio, db push).
// A URL fica aqui, fora do schema.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: env('DATABASE_URL'),
  },
})
