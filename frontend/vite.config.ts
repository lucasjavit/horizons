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
    // **jsdom, e nao node** (QA-03, camada 4). Os testes de logica pura
    // continuam rodando aqui sem prejuizo; o que mudou e que agora ha teste de
    // componente, e `render()` precisa de DOM.
    environment: 'jsdom',
    // `.tsx` entrou na lista junto com o jsdom: teste de componente mora ao
    // lado do componente, e sem isto os arquivos novos seriam ignorados **em
    // silencio** — a suite passaria dizendo que nao ha nada a rodar.
    include: ['src/**/*.spec.ts', 'src/**/*.spec.tsx'],
    // O `cleanup()` do Testing Library entre testes. Sem ele, o segundo teste
    // acha dois botoes com o mesmo nome — o do teste anterior continua montado
    // — e `getByRole` lanca por ambiguidade.
    globals: true,
    setupFiles: ['./src/teste/preparo.ts'],
  },
})
