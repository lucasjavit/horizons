/**
 * O preparo das suites de componente (QA-03, camada 4).
 *
 * Duas coisas, e as duas evitam falha silenciosa:
 *
 * 1. **Os matchers do `jest-dom`** (`toBeDisabled`, `toHaveTextContent`,
 *    `toHaveAttribute`). Sem eles o teste ainda compila, mas `expect(...)
 *    .toBeDisabled` e `undefined` — e chamar undefined lanca um TypeError que
 *    fala de tipo, e nao do defeito que o teste procurava.
 * 2. **O `cleanup()` entre testes.** Sem ele o DOM acumula: o segundo teste
 *    encontra dois botoes `Load more jobs` — o seu e o que sobrou do anterior —
 *    e `getByRole` lanca por ambiguidade.
 */
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
})
