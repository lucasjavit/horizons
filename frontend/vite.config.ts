// O defineConfig vem de 'vitest/config', e nao de 'vite': e ele que conhece a
// chave `test` abaixo. Com o import de 'vite' o `npm test` passa, mas o
// `tsc -b` do build quebra com "'test' does not exist in type UserConfigExport".
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // O Vitest fica aqui dentro, e nao num vitest.config.ts na raiz, porque o
  // Dockerfile do frontend copia uma lista explicita de arquivos de config —
  // arquivo novo na raiz que nao entrasse naquele COPY seria ignorado em
  // silencio no build.
  test: {
    // Ambiente node: os testes de hoje sao de logica pura (invoice, parsing).
    // Teste de componente vai exigir jsdom + testing-library, e ai isto muda.
    environment: 'node',
    include: ['src/**/*.spec.ts'],
  },
})
