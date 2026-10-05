/**
 * INV-18 — a previa nao pode vazar da folha com palavra sem espaco.
 *
 * **O que este teste prova, e o que nao prova.** O jsdom nao faz layout: nao
 * ha largura, quebra de linha nem `getBoundingClientRect` de verdade aqui. A
 * prova de que nada vaza foi feita no Chromium, medindo o retangulo de cada
 * no de texto contra a folha (antes: a tabela de pagamento ia a 2246px numa
 * folha de 616; depois: nenhum texto fora).
 *
 * O que fica guardado e a **causa**: as quatro declaracoes que fazem a quebra
 * acontecer. Tirar qualquer uma delas traz o defeito de volta sem que nenhum
 * outro teste perceba — a previa e `aria-hidden` e nao tem papel nem rotulo
 * por onde um teste de comportamento a alcance.
 */
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { emptyDraft } from '../../invoice/types'
import type { InvoiceDraft } from '../../invoice/types'
import { InvoicePreview } from './InvoicePreview'

const LINK = `https://pay.example.com/invoice/${'a1b2c3d4e5'.repeat(15)}`

function draft(): InvoiceDraft {
  return {
    ...emptyDraft(),
    invoiceNumber: 'INV-2026-000000000123456789-ACME-CONSULTING',
    paymentFields: [{ id: 'a', label: 'Payment link', value: LINK }],
  }
}

function celulaCom(folha: HTMLElement, texto: string): HTMLElement {
  const achada = [...folha.querySelectorAll<HTMLElement>('td, dt, dd, h3')].find(
    (e) => e.textContent === texto,
  )
  if (!achada) throw new Error(`nao achei "${texto}" na previa`)
  return achada
}

describe('previa da invoice — campo longo', () => {
  it('a folha parte palavra sem espaco, em vez de esticar', () => {
    const { container } = render(<InvoicePreview draft={draft()} />)
    const folha = container.firstElementChild as HTMLElement
    // Herdado por tudo o que esta dentro: FROM, BILL TO, pagamento e itens.
    expect(folha.style.overflowWrap).toBe('anywhere')
  })

  it('quem quebra e o valor: a marca e os rotulos do cabecalho ficam inteiros', () => {
    const { container } = render(<InvoicePreview draft={draft()} />)
    const folha = container.firstElementChild as HTMLElement
    // Com `anywhere`, o que nao for protegido encolhe ate "INVOI / CE".
    expect(celulaCom(folha, 'INVOICE')).toHaveClass('whitespace-nowrap', 'shrink-0')
    expect(celulaCom(folha, 'Invoice #')).toHaveClass('whitespace-nowrap')
    expect(celulaCom(folha, 'Invoice #').parentElement?.parentElement).toHaveClass('min-w-0')
  })

  it('o valor de varias linhas comeca no topo da linha, ao lado do rotulo', () => {
    const { container } = render(<InvoicePreview draft={draft()} />)
    const folha = container.firstElementChild as HTMLElement
    expect(celulaCom(folha, LINK).style.verticalAlign).toBe('top')
    expect(celulaCom(folha, 'Payment link').style.verticalAlign).toBe('top')
  })
})
