import {
  aReceberNoMes,
  atrasadas,
  emAtraso,
  formaDoAsaas,
  mrrDoMes,
  progressoPorCliente,
  proximosVencimentos,
  recebidoNoMes,
  recebimentosPorMes,
  separarReceitas,
  situacaoDoAsaas,
} from './asaas'

describe('situacaoDoAsaas', () => {
  it('traduz o status do Asaas em selo', () => {
    expect(situacaoDoAsaas('RECEIVED')).toEqual({ rotulo: 'Pago', tom: 'verde' })
    expect(situacaoDoAsaas('CONFIRMED')).toEqual({ rotulo: 'Pago', tom: 'verde' })
    expect(situacaoDoAsaas('RECEIVED_IN_CASH')).toEqual({ rotulo: 'Pago', tom: 'verde' })
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

function receita(parcial: Record<string, unknown>) {
  return {
    status: 'PENDING',
    valor: 1000,
    data_vencimento: '2026-10-20',
    data_pagamento: null,
    cliente_id: null,
    asaas_customer_id: 'cus_1',
    nome_cliente_asaas: 'Cliente Um',
    ...parcial,
  } as Parameters<typeof recebidoNoMes>[0][number]
}

const HOJE = '2026-10-15'
const MES = '2026-10'

const RECEITAS = [
  receita({ status: 'RECEIVED', valor: 2000, data_vencimento: '2026-10-05', data_pagamento: '2026-10-04' }),
  receita({ status: 'CONFIRMED', valor: 500, data_vencimento: '2026-09-28', data_pagamento: '2026-10-01' }),
  receita({ status: 'RECEIVED', valor: 700, data_vencimento: '2026-09-10', data_pagamento: '2026-09-10' }),
  receita({ status: 'PENDING', valor: 1000, data_vencimento: '2026-10-20' }),
  receita({ status: 'PENDING', valor: 300, data_vencimento: '2026-11-02' }),
  receita({ status: 'OVERDUE', valor: 800, data_vencimento: '2026-10-10', asaas_customer_id: 'cus_2' }),
  receita({ status: 'OVERDUE', valor: 200, data_vencimento: '2026-09-10', asaas_customer_id: 'cus_2' }),
  receita({ status: 'REFUNDED', valor: 999, data_vencimento: '2026-10-08', data_pagamento: '2026-10-08' }),
  receita({ status: 'DELETED', valor: 999, data_vencimento: '2026-10-09' }),
]

describe('contas da Visão Geral', () => {
  it('recebido no mês soma o pago pela data do pagamento, sem estorno', () => {
    expect(recebidoNoMes(RECEITAS, MES)).toBe(2500)
    expect(recebidoNoMes(RECEITAS, '2026-09')).toBe(700)
  })

  it('a receber no mês soma só as pendentes que vencem nele', () => {
    expect(aReceberNoMes(RECEITAS, MES)).toBe(1000)
  })

  it('MRR do mês soma as cobranças que vencem nele, sem canceladas nem estornadas', () => {
    expect(mrrDoMes(RECEITAS, MES)).toBe(2000 + 1000 + 800)
  })

  it('em atraso soma as vencidas e conta os clientes', () => {
    expect(emAtraso(RECEITAS)).toEqual({ total: 1000, cobrancas: 2, clientes: 1 })
  })

  it('o gráfico mostra o recebido de cada um dos últimos meses', () => {
    const serie = recebimentosPorMes(RECEITAS, HOJE, 2)
    expect(serie.map((ponto) => [ponto.mes, ponto.valor])).toEqual([
      ['2026-09', 700],
      ['2026-10', 2500],
    ])
  })

  it('próximos vencimentos: pendentes dos próximos 30 dias, do mais próximo', () => {
    expect(proximosVencimentos(RECEITAS, HOJE).map((v) => [v.receita.valor, v.dias])).toEqual([
      [1000, 5],
      [300, 18],
    ])
    expect(proximosVencimentos(RECEITAS, HOJE, 7)).toHaveLength(1)
  })

  it('atrasadas: as vencidas, da mais antiga', () => {
    expect(atrasadas(RECEITAS, HOJE).map((v) => [v.receita.valor, v.dias])).toEqual([
      [200, -35],
      [800, -5],
    ])
  })
})

describe('separarReceitas', () => {
  it('em aberto são pendentes e vencidas; histórico, as pagas', () => {
    const { abertas, historico } = separarReceitas(RECEITAS)
    expect(abertas.map((r) => r.data_vencimento)).toEqual(['2026-09-10', '2026-10-10', '2026-10-20', '2026-11-02'])
    expect(historico.map((r) => r.data_pagamento)).toEqual(['2026-10-04', '2026-10-01', '2026-09-10'])
  })
})

describe('progressoPorCliente', () => {
  it('agrupa pelo cliente vinculado ou pelo cliente do Asaas', () => {
    const linhas = progressoPorCliente(
      [
        receita({ cliente_id: 'c1', status: 'RECEIVED', valor: 600, data_vencimento: '2026-10-05' }),
        receita({ cliente_id: 'c1', status: 'PENDING', valor: 400, data_vencimento: '2026-10-25' }),
        receita({ asaas_customer_id: 'cus_9', nome_cliente_asaas: 'Avulso', status: 'OVERDUE', valor: 100 }),
        receita({ cliente_id: 'c1', status: 'PENDING', valor: 999, data_vencimento: '2026-11-05' }),
      ],
      MES,
      (r) => (r.cliente_id === 'c1' ? 'Clínica Aurora' : (r.nome_cliente_asaas ?? '')),
    )
    expect(linhas).toEqual([
      { chave: 'cus_9', nome: 'Avulso', pago: 0, total: 100, percentual: 0 },
      { chave: 'c1', nome: 'Clínica Aurora', pago: 600, total: 1000, percentual: 60 },
    ])
  })
})
