import type { Client, ClientPayment } from '@/types/database'
import { diaDeVencimento, gerarCartoes, proximoMes, vencimentoNoMes } from './cartoes'

const HOJE = '2026-10-09'

function cliente(parcial: Partial<Client> = {}): Client {
  return {
    id: 'c1',
    status: 'ativo',
    mrr: 1500,
    data_inicio_contrato: '2026-08-10',
    ...parcial,
  } as Client
}

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

describe('vencimento', () => {
  it('usa o dia do cadastro; sem ele, o dia em que o contrato começou', () => {
    expect(diaDeVencimento(cliente({ dia_vencimento: 5 }))).toBe(5)
    expect(diaDeVencimento(cliente())).toBe(10)
    expect(diaDeVencimento(cliente({ data_inicio_contrato: null }))).toBeNull()
  })

  it('cai no último dia quando o mês é mais curto', () => {
    expect(vencimentoNoMes('2026-10-01', 31)).toBe('2026-10-31')
    expect(vencimentoNoMes('2026-11-01', 31)).toBe('2026-11-30')
    expect(vencimentoNoMes('2026-02-01', 31)).toBe('2026-02-28')
    expect(vencimentoNoMes('2028-02-01', 30)).toBe('2028-02-29')
  })

  it('proximoMes vira o ano', () => {
    expect(proximoMes('2026-12-01')).toBe('2027-01-01')
    expect(proximoMes('2026-01-01')).toBe('2026-02-01')
  })
})

describe('gerarCartoes', () => {
  it('cria um cartão por mês, do início do contrato até o mês atual, sem nada no banco', () => {
    expect(gerarCartoes(cliente(), [], HOJE)).toEqual([
      { mes: '2026-08-01', valor: 1500, vencimento: '2026-08-10', status: 'atrasado', dataPagamento: null, forma: null, id: null },
      { mes: '2026-09-01', valor: 1500, vencimento: '2026-09-10', status: 'atrasado', dataPagamento: null, forma: null, id: null },
      { mes: '2026-10-01', valor: 1500, vencimento: '2026-10-10', status: 'pendente', dataPagamento: null, forma: null, id: null },
    ])
  })

  it('mês pago vira histórico com o que foi pago de fato', () => {
    const cartoes = gerarCartoes(
      cliente(),
      [pago('2026-08-01', { valor: 1200, forma_pagamento: 'pix' })],
      HOJE,
    )
    expect(cartoes[0]).toEqual({
      mes: '2026-08-01',
      valor: 1200,
      vencimento: '2026-08-10',
      status: 'pago',
      dataPagamento: '2026-08-09',
      forma: 'pix',
      id: 'p-2026-08-01',
    })
  })

  it('quando tudo está pago até o mês atual, já aparece o cartão do mês seguinte', () => {
    const cartoes = gerarCartoes(
      cliente(),
      [pago('2026-08-01'), pago('2026-09-01'), pago('2026-10-01')],
      HOJE,
    )
    expect(cartoes.map((c) => [c.mes, c.status])).toEqual([
      ['2026-08-01', 'pago'],
      ['2026-09-01', 'pago'],
      ['2026-10-01', 'pago'],
      ['2026-11-01', 'pendente'],
    ])
    expect(cartoes[3].vencimento).toBe('2026-11-10')
  })

  it('mudar valor ou dia no cadastro vale para os meses em aberto, não para os pagos', () => {
    const cartoes = gerarCartoes(
      cliente({ mrr: 2000, dia_vencimento: 20 }),
      [pago('2026-08-01'), pagamento('2026-09-01')],
      HOJE,
    )
    expect(cartoes[0]).toMatchObject({ valor: 1500, vencimento: '2026-08-10', status: 'pago' })
    expect(cartoes[1]).toMatchObject({
      valor: 2000,
      vencimento: '2026-09-20',
      status: 'atrasado',
      id: 'p-2026-09-01',
    })
    expect(cartoes[2]).toMatchObject({ valor: 2000, vencimento: '2026-10-20', status: 'pendente' })
  })

  it('só olha os pagamentos do próprio cliente', () => {
    const cartoes = gerarCartoes(cliente(), [pago('2026-08-01', { client_id: 'outro' })], HOJE)
    expect(cartoes[0].status).toBe('atrasado')
  })

  it('cliente pausado ou em churn não ganha cartões novos, só mantém o que já existe', () => {
    const cartoes = gerarCartoes(cliente({ status: 'churn' }), [pago('2026-08-01')], HOJE)
    expect(cartoes.map((c) => c.mes)).toEqual(['2026-08-01'])
  })

  it('sem data de início não há o que gerar, mas o que está no banco aparece', () => {
    const semInicio = cliente({ data_inicio_contrato: null })
    expect(gerarCartoes(semInicio, [], HOJE)).toEqual([])
    expect(gerarCartoes(semInicio, [pagamento('2026-09-01')], HOJE)).toEqual([
      expect.objectContaining({ mes: '2026-09-01', vencimento: '2026-09-10', status: 'atrasado' }),
    ])
  })

  it('contrato que começa no futuro ainda não tem cartões', () => {
    expect(gerarCartoes(cliente({ data_inicio_contrato: '2026-12-01' }), [], HOJE)).toEqual([])
  })

  it('contrato muito antigo não gera uma lista sem fim', () => {
    const cartoes = gerarCartoes(cliente({ data_inicio_contrato: '1990-01-01' }), [], HOJE)
    expect(cartoes.length).toBeLessThanOrEqual(120)
    expect(cartoes[cartoes.length - 1].mes).toBe('2026-10-01')
  })
})
