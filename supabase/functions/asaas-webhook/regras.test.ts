import { linhaDaCobranca, termoDoNome, tokenValido } from './regras'

const PAGAMENTO = {
  id: 'pay_123',
  customer: 'cus_9',
  customerName: 'Scofield Arquitetura Ltda',
  description: 'Mensalidade outubro',
  value: 2870,
  dueDate: '2026-10-14',
  paymentDate: '2026-10-13',
  status: 'RECEIVED',
  billingType: 'PIX',
  subscription: null,
}

describe('tokenValido', () => {
  it('aceita só o token configurado', () => {
    expect(tokenValido('segredo', 'segredo')).toBe(true)
    expect(tokenValido('outro', 'segredo')).toBe(false)
    expect(tokenValido('segred', 'segredo')).toBe(false)
    expect(tokenValido(null, 'segredo')).toBe(false)
  })

  it('sem token configurado, recusa tudo', () => {
    expect(tokenValido('', '')).toBe(false)
    expect(tokenValido('qualquer', undefined)).toBe(false)
  })
})

describe('linhaDaCobranca', () => {
  const AGORA = '2026-10-15T12:00:00.000Z'

  it('evento de cobrança vira a linha da tabela', () => {
    expect(linhaDaCobranca({ event: 'PAYMENT_RECEIVED', payment: PAGAMENTO }, AGORA)).toEqual({
      asaas_id: 'pay_123',
      asaas_customer_id: 'cus_9',
      nome_cliente_asaas: 'Scofield Arquitetura Ltda',
      descricao: 'Mensalidade outubro',
      valor: 2870,
      data_vencimento: '2026-10-14',
      data_pagamento: '2026-10-13',
      status: 'RECEIVED',
      forma_pagamento: 'PIX',
      tipo: 'PIX',
      atualizado_em: AGORA,
    })
  })

  it('cobrança de assinatura fica com o tipo SUBSCRIPTION', () => {
    const linha = linhaDaCobranca(
      { event: 'PAYMENT_CREATED', payment: { ...PAGAMENTO, status: 'PENDING', paymentDate: null, subscription: 'sub_1' } },
      AGORA,
    )
    expect(linha).toMatchObject({ tipo: 'SUBSCRIPTION', status: 'PENDING', data_pagamento: null })
  })

  it('cobrança excluída no Asaas fica com o status DELETED', () => {
    expect(linhaDaCobranca({ event: 'PAYMENT_DELETED', payment: PAGAMENTO }, AGORA)?.status).toBe('DELETED')
  })

  it('eventos que não são de cobrança não gravam nada', () => {
    expect(linhaDaCobranca({ event: 'SUBSCRIPTION_CREATED' }, AGORA)).toBeNull()
    expect(linhaDaCobranca({ event: 'PAYMENT_RECEIVED' }, AGORA)).toBeNull()
    expect(linhaDaCobranca({}, AGORA)).toBeNull()
  })
})

describe('termoDoNome', () => {
  it('usa as duas primeiras palavras, sem pontuação', () => {
    expect(termoDoNome('Scofield Arquitetura Ltda')).toBe('Scofield Arquitetura')
    expect(termoDoNome('  Padaria   Sol, ME ')).toBe('Padaria Sol')
    expect(termoDoNome('Muniz & Zordan Advogados')).toBe('Muniz Zordan')
  })

  it('escapa os curingas do ILIKE', () => {
    expect(termoDoNome('100% Fit')).toBe('100\\% Fit')
    expect(termoDoNome('Loja_Nova Centro')).toBe('Loja\\_Nova Centro')
  })

  it('nome curto demais não serve para buscar', () => {
    expect(termoDoNome('AB')).toBeNull()
    expect(termoDoNome('')).toBeNull()
    expect(termoDoNome(undefined)).toBeNull()
  })
})
