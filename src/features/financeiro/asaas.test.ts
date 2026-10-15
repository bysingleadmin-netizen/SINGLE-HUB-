import { formaDoAsaas, situacaoDoAsaas } from './asaas'

describe('situacaoDoAsaas', () => {
  it('traduz o status do Asaas em selo', () => {
    expect(situacaoDoAsaas('RECEIVED')).toEqual({ rotulo: 'Recebido', tom: 'verde' })
    expect(situacaoDoAsaas('CONFIRMED')).toEqual({ rotulo: 'Recebido', tom: 'verde' })
    expect(situacaoDoAsaas('RECEIVED_IN_CASH')).toEqual({ rotulo: 'Recebido', tom: 'verde' })
    expect(situacaoDoAsaas('PENDING')).toEqual({ rotulo: 'Pendente', tom: 'amarelo' })
    expect(situacaoDoAsaas('OVERDUE')).toEqual({ rotulo: 'Atrasado', tom: 'vermelho' })
    expect(situacaoDoAsaas('REFUNDED')).toEqual({ rotulo: 'Estornado', tom: 'cinza' })
    expect(situacaoDoAsaas('DELETED')).toEqual({ rotulo: 'Cancelado', tom: 'cinza' })
    expect(situacaoDoAsaas('CANCELLED')).toEqual({ rotulo: 'Cancelado', tom: 'cinza' })
  })

  it('status desconhecido aparece como veio, em cinza', () => {
    expect(situacaoDoAsaas('AWAITING_RISK_ANALYSIS')).toEqual({ rotulo: 'AWAITING_RISK_ANALYSIS', tom: 'cinza' })
    expect(situacaoDoAsaas(null)).toEqual({ rotulo: 'Sem status', tom: 'cinza' })
  })
})

describe('formaDoAsaas', () => {
  it('traduz a forma de pagamento', () => {
    expect(formaDoAsaas('PIX')).toBe('Pix')
    expect(formaDoAsaas('BOLETO')).toBe('Boleto')
    expect(formaDoAsaas('CREDIT_CARD')).toBe('Cartão de crédito')
    expect(formaDoAsaas('UNDEFINED')).toBe('A definir')
    expect(formaDoAsaas(null)).toBeNull()
  })
})
