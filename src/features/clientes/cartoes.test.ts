import type { Client, ClientPayment } from '@/types/database'
import {
  cartoesDe,
  diaDeVencimento,
  planoDeCobrancas,
  planoVazio,
  proximoMes,
  separarCartoes,
  vencimentoNoMes,
} from './cartoes'

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
    expect(vencimentoNoMes('2026-02-01', 31)).toBe('2026-02-28')
    expect(vencimentoNoMes('2028-02-01', 31)).toBe('2028-02-29')
    expect(vencimentoNoMes('2026-10-01', 5)).toBe('2026-10-05')
  })

  it('vira o ano ao passar de dezembro', () => {
    expect(proximoMes('2026-12-01')).toBe('2027-01-01')
    expect(proximoMes('2026-09-01')).toBe('2026-10-01')
  })
})

describe('planoDeCobrancas', () => {
  it('cria a cobrança do mês atual e dos três seguintes, sem voltar no tempo', () => {
    const plano = planoDeCobrancas([cliente()], [], HOJE)
    // O contrato começou em agosto, mas agosto e setembro não são criados depois do fato
    expect(plano.inserir).toEqual([
      { client_id: 'c1', mes_referencia: '2026-10-01', valor: 1500, data_vencimento: '2026-10-10', status: 'pendente' },
      { client_id: 'c1', mes_referencia: '2026-11-01', valor: 1500, data_vencimento: '2026-11-10', status: 'pendente' },
      { client_id: 'c1', mes_referencia: '2026-12-01', valor: 1500, data_vencimento: '2026-12-10', status: 'pendente' },
      { client_id: 'c1', mes_referencia: '2027-01-01', valor: 1500, data_vencimento: '2027-01-10', status: 'pendente' },
    ])
    expect(plano.atualizar).toEqual([])
    expect(plano.cancelar).toEqual([])
  })

  it('com tudo em dia não há nada a fazer, por mais que rode', () => {
    const existentes = ['2026-10-01', '2026-11-01', '2026-12-01', '2027-01-01'].map((mes) => pagamento(mes))
    expect(planoVazio(planoDeCobrancas([cliente()], existentes, HOJE))).toBe(true)
  })

  it('não repete o mês que já tem cobrança, paga ou não', () => {
    const plano = planoDeCobrancas([cliente()], [pago('2026-10-01'), pagamento('2026-11-01')], HOJE)
    expect(plano.inserir.map((c) => c.mes_referencia)).toEqual(['2026-12-01', '2027-01-01'])
  })

  it('contrato que começa no futuro só gera cobrança a partir do mês de início', () => {
    const plano = planoDeCobrancas([cliente({ data_inicio_contrato: '2026-12-15' })], [], HOJE)
    expect(plano.inserir.map((c) => c.data_vencimento)).toEqual(['2026-12-15', '2027-01-15'])
  })

  it('mudar o valor ou o dia reescreve só as cobranças em aberto do mês atual em diante', () => {
    const plano = planoDeCobrancas(
      [cliente({ mrr: 2000, dia_vencimento: 20 })],
      [
        // Em aberto de mês passado: fica como era devido naquele mês
        pagamento('2026-09-01'),
        // Paga: é histórico
        pago('2026-10-01'),
        pagamento('2026-11-01'),
        pagamento('2026-12-01'),
        pagamento('2027-01-01'),
      ],
      HOJE,
    )
    expect(plano.inserir).toEqual([])
    expect(plano.atualizar).toEqual([
      { id: 'p-2026-11-01', valor: 2000, data_vencimento: '2026-11-20' },
      { id: 'p-2026-12-01', valor: 2000, data_vencimento: '2026-12-20' },
      { id: 'p-2027-01-01', valor: 2000, data_vencimento: '2027-01-20' },
    ])
  })

  it('cliente pausado ou em churn para de gerar e tem as cobranças futuras canceladas', () => {
    const plano = planoDeCobrancas(
      [cliente({ status: 'churn' })],
      [pagamento('2026-09-01'), pago('2026-10-01'), pagamento('2026-11-01'), pagamento('2026-12-01')],
      HOJE,
    )
    expect(plano.inserir).toEqual([])
    expect(plano.cancelar).toEqual(['p-2026-11-01', 'p-2026-12-01'])
  })

  it('sem dia de vencimento ou sem valor mensal não cobra nada', () => {
    expect(planoVazio(planoDeCobrancas([cliente({ data_inicio_contrato: null })], [], HOJE))).toBe(true)
    expect(planoVazio(planoDeCobrancas([cliente({ mrr: 0 })], [], HOJE))).toBe(true)
  })

  it('cada cliente só enxerga as próprias cobranças', () => {
    const plano = planoDeCobrancas(
      [cliente(), cliente({ id: 'c2', mrr: 800, dia_vencimento: 5 })],
      ['2026-10-01', '2026-11-01', '2026-12-01', '2027-01-01'].map((mes) => pagamento(mes)),
      HOJE,
    )
    expect(plano.inserir).toHaveLength(4)
    expect(plano.inserir.every((c) => c.client_id === 'c2' && c.valor === 800)).toBe(true)
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
