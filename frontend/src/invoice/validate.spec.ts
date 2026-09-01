/**
 * Camada 1 — `invoice/validate.ts` (QA-04).
 *
 * Ficou de fora do QA-01, e tem regra de negocio de verdade: o que e
 * obrigatorio, o que e so aviso, e onde estao os tetos.
 *
 * A regra que orienta o arquivo inteiro esta escrita no proprio modulo:
 * **validacao minima de proposito**. Exigir demais num gerador de documento e
 * hostil — muita fatura legitima nao tem tax ID, e o freelancer pode
 * genuinamente nao saber o endereco do cliente. Entao boa parte destes testes
 * afirma o que NAO bloqueia, que e tao regra quanto o que bloqueia.
 */
import { describe, expect, it } from 'vitest'
import { MAX_VALOR, dueDateWarning, validateDraft, validateItem } from './validate'
import { emptyDraft, newItemId } from './types'
import type { InvoiceDraft, LineItem } from './types'

function item(over: Partial<LineItem> = {}): LineItem {
  return { id: newItemId(), description: 'Logo design', quantity: '1', rate: '100', ...over }
}

/** Um rascunho que PASSA — a base para provar um erro de cada vez. */
function draftValido(over: Partial<InvoiceDraft> = {}): InvoiceDraft {
  return {
    ...emptyDraft(),
    invoiceNumber: 'INV-001',
    issueDate: '2026-09-01',
    from: { name: 'Lucas', address: '', email: '', taxId: '' },
    billTo: { name: 'Acme', address: '', email: '' },
    items: [item()],
    ...over,
  }
}

describe('validateItem', () => {
  describe('quantidade', () => {
    it('meia hora e valida — o teto de baixo e zero, nao um', () => {
      // `> 0` e nao `>= 1`: cobrar meia hora e caso de uso real, e um piso de
      // 1 proibiria a fatura por hora do freelancer.
      expect(validateItem(item({ quantity: '0.5' }))).toEqual({})
    })

    it('zero e recusado', () => {
      const i = item({ quantity: '0' })
      expect(validateItem(i)[`${i.id}.quantity`]).toBe('Quantity must be greater than zero.')
    })

    it('negativo e recusado', () => {
      const i = item({ quantity: '-2' })
      expect(validateItem(i)[`${i.id}.quantity`]).toBe('Quantity must be greater than zero.')
    })

    it('o teto e um milhao, e ele passa', () => {
      // O limite e inclusivo: exatamente MAX_VALOR nao pode ser recusado, ou a
      // mensagem ("at most 1,000,000") mentiria.
      expect(validateItem(item({ quantity: String(MAX_VALOR) }))).toEqual({})
    })

    it('um a mais que o teto e recusado, e a mensagem diz o limite', () => {
      const i = item({ quantity: String(MAX_VALOR + 1) })
      expect(validateItem(i)[`${i.id}.quantity`]).toBe('Quantity must be at most 1,000,000.')
    })

    it('campo vazio nao e erro DE QUANTIDADE — e so incompleto', () => {
      // Quem esta digitando passa por vazio o tempo todo. Marcar erro a cada
      // campo em branco faria o formulario gritar durante o preenchimento.
      expect(validateItem(item({ quantity: '' }))).toEqual({})
    })

    it('so espacos tambem nao acusa', () => {
      expect(validateItem(item({ quantity: '   ' }))).toEqual({})
    })
  })

  describe('valor unitario', () => {
    it('zero e valido — linha de cortesia existe', () => {
      // A regra do rate e `< 0`, e nao `<= 0`: um item gratuito numa fatura
      // (desconto, brinde, hora nao cobrada) e legitimo e precisa aparecer.
      expect(validateItem(item({ rate: '0' }))).toEqual({})
    })

    it('negativo e recusado', () => {
      const i = item({ rate: '-1' })
      expect(validateItem(i)[`${i.id}.rate`]).toBe('Rate cannot be negative.')
    })

    it('o teto vale em CENTAVOS — um milhao passa', () => {
      // `parseAmountToCents` devolve centavos, e o teto e `MAX_VALOR * 100`.
      // Comparar centavos com MAX_VALOR direto cortaria em 10.000.
      expect(validateItem(item({ rate: String(MAX_VALOR) }))).toEqual({})
    })

    it('acima do teto e recusado', () => {
      const i = item({ rate: String(MAX_VALOR + 1) })
      expect(validateItem(i)[`${i.id}.rate`]).toBe('Rate must be at most 1,000,000.')
    })

    it('a virgula decimal e lida pela moeda, e nao multiplica por 100 (INV-11)', () => {
      // `1,5` em BRL e um e meio, nao cento e cinquenta. Se fosse lido como
      // 150 o teto ainda passaria — o que este teste guarda e que a leitura
      // usa a moeda, provando pelo valor que ESTOURA o teto de um jeito e nao
      // do outro.
      const i = item({ rate: '999.999,99' })
      expect(validateItem(i, 'BRL')).toEqual({})
    })
  })

  it('erros de dois campos da mesma linha convivem no mapa', () => {
    const i = item({ quantity: '0', rate: '-5' })
    const e = validateItem(i)
    expect(e[`${i.id}.quantity`]).toBeTruthy()
    expect(e[`${i.id}.rate`]).toBeTruthy()
  })

  it('as chaves sao prefixadas pelo id da linha', () => {
    // E o que permite duas linhas invalidas nao se sobrescreverem no mapa do
    // rascunho — sem o prefixo, a segunda apagaria o erro da primeira.
    const a = item({ id: 'linha-a', quantity: '0' })
    const b = item({ id: 'linha-b', quantity: '0' })
    const juntos = { ...validateItem(a), ...validateItem(b) }
    expect(Object.keys(juntos)).toEqual(['linha-a.quantity', 'linha-b.quantity'])
  })
})

describe('validateDraft', () => {
  it('o rascunho minimo valido nao acusa nada', () => {
    expect(validateDraft(draftValido())).toEqual({})
  })

  describe('o que e obrigatorio', () => {
    it('numero da invoice', () => {
      expect(validateDraft(draftValido({ invoiceNumber: '' })).invoiceNumber).toBe(
        'Invoice number is required.',
      )
    })

    it('numero so com espacos nao vale', () => {
      expect(validateDraft(draftValido({ invoiceNumber: '   ' })).invoiceNumber).toBeTruthy()
    })

    it('data de emissao', () => {
      expect(validateDraft(draftValido({ issueDate: '' })).issueDate).toBe(
        'Issue date is required.',
      )
    })

    it('quem emite', () => {
      const d = draftValido()
      d.from = { ...d.from, name: '' }
      expect(validateDraft(d)['from.name']).toBe('Your name or company is required.')
    })

    it('para quem e a cobranca', () => {
      const d = draftValido()
      d.billTo = { ...d.billTo, name: '' }
      expect(validateDraft(d)['billTo.name']).toBe("The client's name is required.")
    })

    it('pelo menos um item com descricao E valor', () => {
      expect(validateDraft(draftValido({ items: [item({ description: '' })] })).items).toBe(
        'Add at least one item with a description and a rate.',
      )
    })

    it('item com descricao mas sem valor nao conta', () => {
      expect(validateDraft(draftValido({ items: [item({ rate: '' })] })).items).toBeTruthy()
    })

    it('uma linha valida entre linhas vazias basta', () => {
      // Linha em branco no meio e normal — a pessoa adicionou e nao usou.
      // Exigir que TODAS estejam preenchidas bloquearia a fatura por isso.
      const d = draftValido({ items: [item({ description: '', rate: '' }), item()] })
      expect(validateDraft(d).items).toBeUndefined()
    })
  })

  describe('o que NAO e obrigatorio — validacao minima de proposito', () => {
    it('tax ID pode faltar', () => {
      // Muita fatura legitima nao tem: exigir bloquearia quem nao tem CNPJ.
      const d = draftValido()
      d.from = { ...d.from, taxId: '' }
      expect(validateDraft(d)).toEqual({})
    })

    it('endereco pode faltar dos dois lados', () => {
      const d = draftValido()
      d.from = { ...d.from, address: '' }
      d.billTo = { ...d.billTo, address: '' }
      expect(validateDraft(d)).toEqual({})
    })

    it('vencimento pode faltar', () => {
      expect(validateDraft(draftValido({ dueDate: '' }))).toEqual({})
    })

    it('e-mail vazio nao e erro', () => {
      expect(validateDraft(draftValido())).toEqual({})
    })
  })

  describe('e-mail — regra frouxa de proposito', () => {
    it('e-mail comum passa', () => {
      const d = draftValido()
      d.from = { ...d.from, email: 'lucas@example.com' }
      expect(validateDraft(d)['from.email']).toBeUndefined()
    })

    it('endereco com + e subdominio passa', () => {
      // O pior erro possivel aqui e reprovar endereco valido: a pessoa nao tem
      // como consertar o que esta certo. Regex de RFC estrita faz exatamente
      // isso, e por isso a regra e `\S+@\S+\.\S+`.
      const d = draftValido()
      d.billTo = { ...d.billTo, email: 'contas+invoice@sub.acme.co.uk' }
      expect(validateDraft(d)['billTo.email']).toBeUndefined()
    })

    it('texto sem arroba e recusado', () => {
      const d = draftValido()
      d.from = { ...d.from, email: 'nao-e-email' }
      expect(validateDraft(d)['from.email']).toBe('Enter a valid email address.')
    })

    it('sem ponto no dominio e recusado', () => {
      const d = draftValido()
      d.from = { ...d.from, email: 'lucas@acme' }
      expect(validateDraft(d)['from.email']).toBeTruthy()
    })

    it('o e-mail do cliente e checado separado do de quem emite', () => {
      const d = draftValido()
      d.from = { ...d.from, email: 'ok@example.com' }
      d.billTo = { ...d.billTo, email: 'quebrado' }
      const e = validateDraft(d)
      expect(e['from.email']).toBeUndefined()
      expect(e['billTo.email']).toBeTruthy()
    })
  })

  it('os erros das LINHAS entram no mapa do rascunho', () => {
    // E o que faz o botao de baixar bloquear com uma linha invalida: sem esta
    // fusao, a quantidade zerada passaria batido e o PDF sairia errado.
    const linha = item({ id: 'linha-x', quantity: '0' })
    expect(validateDraft(draftValido({ items: [linha] }))['linha-x.quantity']).toBeTruthy()
  })

  it('a moeda do rascunho e usada ao ler os valores das linhas', () => {
    // Sem repassar a moeda, `1.234,56` em BRL seria lido pela regra do ponto e
    // viraria outro numero — e o teto acusaria onde nao devia.
    const d = draftValido({ currency: 'BRL', items: [item({ rate: '1.234,56' })] })
    expect(validateDraft(d)).toEqual({})
  })
})

describe('dueDateWarning', () => {
  it('vencimento antes da emissao AVISA, e nao bloqueia', () => {
    // Aviso e nao erro: retroagir data e pratica contabil real, e nao cabe ao
    // gerador impedir. Por isso ele nao entra no mapa de erros.
    const d = draftValido({ issueDate: '2026-09-10', dueDate: '2026-09-01' })
    expect(dueDateWarning(d)).toBe('The due date is earlier than the issue date.')
    expect(validateDraft(d)).toEqual({})
  })

  it('vencimento depois da emissao nao avisa', () => {
    expect(dueDateWarning(draftValido({ issueDate: '2026-09-01', dueDate: '2026-09-30' }))).toBeNull()
  })

  it('mesmo dia nao avisa — a vista e valido', () => {
    expect(dueDateWarning(draftValido({ issueDate: '2026-09-01', dueDate: '2026-09-01' }))).toBeNull()
  })

  it('sem vencimento nao avisa', () => {
    expect(dueDateWarning(draftValido({ dueDate: '' }))).toBeNull()
  })

  it('sem emissao nao avisa', () => {
    expect(dueDateWarning(draftValido({ issueDate: '', dueDate: '2026-09-01' }))).toBeNull()
  })

  it('compara na virada do ano — a comparacao e ISO, nao textual ingenua', () => {
    // '2027-01-05' > '2026-12-30' em ordem lexicografica de ISO, que e
    // justamente por que o formato ISO permite comparar string. O caso da
    // virada e onde um formato DD/MM quebraria.
    expect(
      dueDateWarning(draftValido({ issueDate: '2026-12-30', dueDate: '2027-01-05' })),
    ).toBeNull()
    expect(
      dueDateWarning(draftValido({ issueDate: '2027-01-05', dueDate: '2026-12-30' })),
    ).toBeTruthy()
  })
})
