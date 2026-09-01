/**
 * Camada 1 — `invoice/storage.ts` (QA-04).
 *
 * O rascunho no navegador. O modulo lista tres coisas que podem dar errado, e
 * **cada uma derruba a pagina se for ignorada**: o `localStorage` lancar
 * excecao (Safari privado, cookies desativados), o JSON estar corrompido, e o
 * formato ser de uma versao anterior.
 *
 * Nenhuma pode quebrar um formulario que a pessoa esta preenchendo — e e por
 * isso que a maior parte deste arquivo testa entrada MALFORMADA. O caminho
 * feliz e uma linha; o resto e o que separa "comeca limpo" de "tela branca".
 *
 * `jsdom` ja fornece um `localStorage` real, entao os testes usam o de verdade
 * e o limpam entre si. Onde o assunto e o storage LANCAR, o teste substitui o
 * metodo — e devolve no fim, para nao vazar para o proximo.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearDraft, loadDraft, saveDraft } from './storage'
import { DRAFT_VERSION, emptyDraft } from './types'
import type { InvoiceDraft } from './types'

const CHAVE = 'horizons.invoice.draft.v1'

/** Escreve direto no storage, para montar o estado que se quer LER. */
function semear(valor: unknown) {
  localStorage.setItem(CHAVE, typeof valor === 'string' ? valor : JSON.stringify(valor))
}

describe('storage do rascunho', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  describe('ida e volta', () => {
    it('o que foi salvo volta igual', () => {
      const d = { ...emptyDraft(), invoiceNumber: 'INV-042', dueDate: '2026-10-01' }
      saveDraft(d)
      expect(loadDraft()).toMatchObject({ invoiceNumber: 'INV-042', dueDate: '2026-10-01' })
    })

    it('sem nada guardado, devolve null', () => {
      expect(loadDraft()).toBeNull()
    })

    it('clearDraft apaga', () => {
      saveDraft(emptyDraft())
      clearDraft()
      expect(loadDraft()).toBeNull()
    })
  })

  describe('o que nao pode derrubar o formulario', () => {
    it('JSON corrompido comeca limpo, sem lancar', () => {
      // Tela branca e o desfecho que este catch evita.
      semear('{isso nao e json')
      expect(loadDraft()).toBeNull()
    })

    it('JSON valido que nao e objeto vira null', () => {
      semear('"apenas uma string"')
      expect(loadDraft()).toBeNull()
    })

    it('null gravado literalmente vira null', () => {
      // `JSON.parse('null')` devolve null, e `typeof null === 'object'` — o
      // classico. Sem o `=== null` explicito, o acesso seguinte lancaria.
      semear('null')
      expect(loadDraft()).toBeNull()
    })

    it('versao antiga e descartada em vez de migrada as cegas', () => {
      // Ler um formato antigo como se fosse o novo produz campo faltando em
      // lugar imprevisivel. Descartar custa o rascunho; adivinhar custa a
      // pagina.
      semear({ ...emptyDraft(), version: DRAFT_VERSION - 1, invoiceNumber: 'ANTIGA' })
      expect(loadDraft()).toBeNull()
    })

    it('rascunho sem versao e descartado', () => {
      const { version: _, ...semVersao } = emptyDraft()
      semear(semVersao)
      expect(loadDraft()).toBeNull()
    })

    it('storage que LANCA na leitura nao propaga', () => {
      // Safari privado e cookies desativados: `getItem` lanca. A pagina segue
      // sem rascunho.
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('SecurityError')
      })
      expect(() => loadDraft()).not.toThrow()
      expect(loadDraft()).toBeNull()
    })

    it('storage que LANCA na escrita nao propaga', () => {
      // Cota estourada. Perder o autosave e aceitavel; derrubar o formulario
      // enquanto a pessoa digita, nao.
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError')
      })
      expect(() => saveDraft(emptyDraft())).not.toThrow()
    })

    it('clearDraft que LANCA nao propaga', () => {
      vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
        throw new Error('SecurityError')
      })
      expect(() => clearDraft()).not.toThrow()
    })
  })

  describe('merge com o rascunho vazio', () => {
    it('campo novo do formato ganha o default em vez de vir undefined', () => {
      // Um rascunho salvo antes de `dueDate` existir nao pode devolver
      // `undefined` num input controlado — o React troca para nao-controlado e
      // reclama no console.
      semear({ version: DRAFT_VERSION, invoiceNumber: 'INV-1' })
      const d = loadDraft() as InvoiceDraft
      expect(d.dueDate).toBe('')
      expect(d.paymentDetails).toBe('')
      expect(Array.isArray(d.items)).toBe(true)
    })

    it('objeto aninhado tem merge PROPRIO — `from` parcial nao perde campos', () => {
      // ⚠️ O spread raso deixaria `from` sem `taxId`. E o comentario do modulo
      // que este teste guarda.
      semear({ version: DRAFT_VERSION, from: { name: 'Lucas' } })
      const d = loadDraft() as InvoiceDraft
      expect(d.from.name).toBe('Lucas')
      expect(d.from.taxId).toBe('')
      expect(d.from.address).toBe('')
      expect(d.from.email).toBe('')
    })

    it('`billTo` parcial tambem', () => {
      semear({ version: DRAFT_VERSION, billTo: { email: 'a@b.co' } })
      const d = loadDraft() as InvoiceDraft
      expect(d.billTo.email).toBe('a@b.co')
      expect(d.billTo.name).toBe('')
    })
  })

  describe('moeda', () => {
    it('moeda conhecida sobrevive', () => {
      semear({ ...emptyDraft(), currency: 'EUR' })
      expect(loadDraft()?.currency).toBe('EUR')
    })

    it('moeda desconhecida cai no default em vez de ir para o PDF', () => {
      // Um codigo invalido chegaria ao formatador e sairia no documento.
      semear({ ...emptyDraft(), currency: 'XYZ' })
      expect(loadDraft()?.currency).toBe('USD')
    })

    it('moeda ausente cai no default', () => {
      semear({ version: DRAFT_VERSION })
      expect(loadDraft()?.currency).toBe('USD')
    })
  })

  describe('saneamento das linhas', () => {
    it('linha sem id ganha um — senao o React embaralha ao remover do meio', () => {
      semear({ version: DRAFT_VERSION, items: [{ description: 'A', quantity: '1', rate: '10' }] })
      const d = loadDraft() as InvoiceDraft
      expect(d.items[0].id).toBeTruthy()
      expect(typeof d.items[0].id).toBe('string')
    })

    it('ids ausentes saem DISTINTOS entre si', () => {
      // Dois ids iguais fariam o React tratar duas linhas como uma.
      semear({
        version: DRAFT_VERSION,
        items: [
          { description: 'A', quantity: '1', rate: '1' },
          { description: 'B', quantity: '1', rate: '2' },
        ],
      })
      const d = loadDraft() as InvoiceDraft
      expect(d.items[0].id).not.toBe(d.items[1].id)
    })

    it('id existente e preservado', () => {
      semear({ version: DRAFT_VERSION, items: [{ id: 'meu-id', description: 'A', quantity: '1', rate: '1' }] })
      expect(loadDraft()?.items[0].id).toBe('meu-id')
    })

    it('quantidade numerica (formato antigo) vira o default string', () => {
      // O campo e string de proposito (INV-15). Um numero vindo do storage
      // antigo quebraria o input controlado.
      semear({ version: DRAFT_VERSION, items: [{ id: 'a', description: 'A', quantity: 5, rate: 10 }] })
      const d = loadDraft() as InvoiceDraft
      expect(d.items[0].quantity).toBe('1')
      expect(d.items[0].rate).toBe('')
    })

    it('lista de itens vazia vira uma linha em branco', () => {
      // Zero linhas deixaria a tabela sem nenhuma, e sem lugar para digitar.
      semear({ version: DRAFT_VERSION, items: [] })
      expect(loadDraft()?.items).toHaveLength(1)
    })

    it('itens que nao sao lista viram uma linha em branco', () => {
      semear({ version: DRAFT_VERSION, items: 'nao e lista' })
      expect(loadDraft()?.items).toHaveLength(1)
    })

    it('entradas nao-objeto na lista sao descartadas', () => {
      semear({
        version: DRAFT_VERSION,
        items: [null, 'texto', 42, { id: 'ok', description: 'A', quantity: '1', rate: '1' }],
      })
      const d = loadDraft() as InvoiceDraft
      expect(d.items).toHaveLength(1)
      expect(d.items[0].id).toBe('ok')
    })

    it('lista so de lixo ainda produz uma linha utilizavel', () => {
      semear({ version: DRAFT_VERSION, items: [null, null] })
      expect(loadDraft()?.items).toHaveLength(1)
    })
  })

  describe('saneamento dos campos de pagamento', () => {
    it('ausente vira os rotulos padrao', () => {
      semear({ version: DRAFT_VERSION })
      const d = loadDraft() as InvoiceDraft
      expect(d.paymentFields.length).toBeGreaterThan(0)
      expect(d.paymentFields.map((c) => c.label)).toContain('IBAN')
    })

    it('lista VAZIA e respeitada — a pessoa apagou todas as linhas', () => {
      // ⚠️ Diferente dos itens: aqui vazio e uma escolha, e repor os sete
      // rotulos padrao desfaria o que a pessoa fez, a cada recarga.
      semear({ version: DRAFT_VERSION, paymentFields: [] })
      expect(loadDraft()?.paymentFields).toEqual([])
    })

    it('campo sem id ganha um', () => {
      semear({ version: DRAFT_VERSION, paymentFields: [{ label: 'PIX', value: 'x@y.z' }] })
      const d = loadDraft() as InvoiceDraft
      expect(d.paymentFields[0].id).toBeTruthy()
      expect(d.paymentFields[0].label).toBe('PIX')
    })

    it('valor nao-string vira string vazia', () => {
      semear({ version: DRAFT_VERSION, paymentFields: [{ id: 'a', label: 'IBAN', value: 123 }] })
      expect(loadDraft()?.paymentFields[0].value).toBe('')
    })
  })
})
