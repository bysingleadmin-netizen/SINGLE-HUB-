import type { ClientPayment } from '@/types/database'
import {
  cartoesDe,
  proximoMes,
  restante,
  separarCartoes,
  situacaoDoPagamento,
  valorRecebido,
  vencimentoNoMes,
} from './cartoes'

const HOJE = '2026-10-09'

function pagamento(mes: string, parcial: Partial<ClientPayment> = {}): ClientPayment {
  return {
    id: `p-${mes}`,
    client_id: 'c1',
    mes_referencia: mes,
    valor: 1500,
    data_vencimento: `${mes.slice(0, 8)}10`,
    data_pagamento: null,
    status: 'pendente',
    created_at: '2026-01-01',
    ...parcial,
  }
}

const pago = (mes: string, parcial: Partial<ClientPayment> = {}) =>
  pagamento(mes, { status: 'pago', data_pagamento: `${mes.slice(0, 8)}09`, ...parcial })

describe('meses e vencimentos', () => {
  it('cai no último dia quando o mês é mais curto', () => {
    expect(vencimentoNoMes('2026-02-01', 31)).toBe('2026-02-28')
    expect(vencimentoNoMes('2028-02-01', 31)).toBe('2028-02-29')
    expect(vencimentoNoMes('2026-10-01', 5)).toBe('2026-10-05')
  })

  it('vira o ano ao passar de dezembro', () => {
    expect(proximoMes('2026-12-01')).toBe('2027-01-01')
    expect(proximoMes('2026-09-01')).toBe('2026-10-01')
  })
})

describe('cartoesDe', () => {
  it('ordena por mês, marca como atrasado o que venceu e separa o histórico', () => {
    const cartoes = cartoesDe(
      [
        pagamento('2026-11-01'),
        pagamento('2026-10-01', { data_vencimento: '2026-10-05' }),
        pago('2026-09-01', { forma_pagamento: 'pix' }),
        pago('2026-08-01'),
        pagamento('2026-07-01', { status: 'cancelado' }),
      ],
      HOJE,
    )
    expect(cartoes.map((c) => [c.mes, c.status])).toEqual([
      ['2026-07-01', 'cancelado'],
      ['2026-08-01', 'pago'],
      ['2026-09-01', 'pago'],
      ['2026-10-01', 'atrasado'],
      ['2026-11-01', 'pendente'],
    ])

    const { abertos, historico } = separarCartoes(cartoes)
    expect(abertos.map((c) => c.mes)).toEqual(['2026-10-01', '2026-11-01'])
    // O histórico vem do mais recente para o mais antigo, e o cancelado não entra em lugar nenhum
    expect(historico.map((c) => c.mes)).toEqual(['2026-09-01', '2026-08-01'])
    expect(historico[0]).toMatchObject({ forma: 'pix', dataPagamento: '2026-09-09' })
  })

  it('cobrança que vence hoje ainda não está atrasada', () => {
    expect(cartoesDe([pagamento('2026-10-01', { data_vencimento: HOJE })], HOJE)[0].status).toBe('pendente')
  })
})

describe('pagamento parcial', () => {
  it('situação pelo quanto entrou', () => {
    expect(situacaoDoPagamento(1000, 1000)).toBe('pago')
    expect(situacaoDoPagamento(1000, 1200)).toBe('pago')
    expect(situacaoDoPagamento(1000, 400)).toBe('parcial')
    expect(situacaoDoPagamento(1000, 0)).toBe('pendente')
  })

  it('valor recebido usa valor_pago e, sem a coluna, o status', () => {
    expect(valorRecebido({ status: 'pendente', valor: 1000, valor_pago: 400 })).toBe(400)
    expect(valorRecebido({ status: 'pago', valor: 1000 })).toBe(1000)
    expect(valorRecebido({ status: 'pendente', valor: 1000 })).toBe(0)
  })

  it('restante nunca é negativo', () => {
    expect(restante(1000, 400)).toBe(600)
    expect(restante(1000, 1500)).toBe(0)
  })

  it('o cartão leva o recebido, a situação e a observação', () => {
    const [cartao] = cartoesDe(
      [
        {
          id: 'p1', client_id: 'c1', mes_referencia: '2026-10-01', valor: 2870, data_vencimento: '2026-10-10',
          data_pagamento: null, status: 'pendente', valor_pago: 2000, pago_em: '2026-10-05',
          observacao_pagamento: 'resto dia 20', created_at: '2026-10-01',
        },
      ],
      '2026-10-14',
    )
    expect(cartao).toMatchObject({
      valorPago: 2000, situacao: 'parcial', pagoEm: '2026-10-05', observacao: 'resto dia 20', status: 'atrasado',
    })
  })
})
