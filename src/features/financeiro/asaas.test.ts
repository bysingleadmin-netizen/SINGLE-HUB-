import {
  aReceberNoPeriodo,
  atrasadas,
  emAtraso,
  formaDoAsaas,
  mrrDoPeriodo,
  progressoPorCliente,
  proximosVencimentos,
  recebidoNoMes,
  recebidoNoPeriodo,
  receitaPorCliente,
  recebimentosDoPeriodo,
  separarReceitas,
  situacaoDoAsaas,
  desempenhoMensal,
  historicoDoTicket,
  mrrDoMes,
  ticketMedio,
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

const OUTUBRO = { inicio: '2026-10-01', fim: '2026-10-31' }
const SETEMBRO = { inicio: '2026-09-01', fim: '2026-09-30' }

describe('contas da Visão Geral no período', () => {
  it('recebido soma o pago pela data do pagamento, sem estorno', () => {
    expect(recebidoNoPeriodo(RECEITAS, OUTUBRO)).toBe(2500)
    expect(recebidoNoMes(RECEITAS, '2026-09')).toBe(700)
    // Uma semana só: o pagamento de 04/10 entra; o de 01/10, não
    expect(recebidoNoPeriodo(RECEITAS, { inicio: '2026-10-02', fim: '2026-10-08' })).toBe(2000)
  })

  it('a receber soma só as pendentes que vencem no período', () => {
    expect(aReceberNoPeriodo(RECEITAS, OUTUBRO)).toBe(1000)
    expect(aReceberNoPeriodo(RECEITAS, { inicio: '2026-10-01', fim: '2026-12-31' })).toBe(1300)
  })

  it('MRR soma as cobranças que vencem no período, sem canceladas nem estornadas', () => {
    expect(mrrDoPeriodo(RECEITAS, OUTUBRO)).toBe(2000 + 1000 + 800)
  })

  it('em atraso: as vencidas até o fim do período, com os clientes', () => {
    expect(emAtraso(RECEITAS)).toEqual({ total: 1000, cobrancas: 2, clientes: 1 })
    expect(emAtraso(RECEITAS, SETEMBRO.fim)).toEqual({ total: 200, cobrancas: 1, clientes: 1 })
  })

  it('o gráfico mostra seis meses até o período, ou os meses dele quando é maior', () => {
    const doMes = recebimentosDoPeriodo(RECEITAS, OUTUBRO)
    expect(doMes).toHaveLength(6)
    expect(doMes.slice(-2).map((ponto) => [ponto.mes, ponto.valor])).toEqual([
      ['2026-09', 700],
      ['2026-10', 2500],
    ])
    const doAno = recebimentosDoPeriodo(RECEITAS, { inicio: '2026-01-01', fim: '2026-12-31' })
    expect(doAno.map((ponto) => ponto.mes)[0]).toBe('2026-01')
    expect(doAno).toHaveLength(12)
  })

  it('vencimentos: pendentes do período, de hoje em diante, do mais próximo', () => {
    const ateNovembro = { inicio: '2026-10-01', fim: '2026-11-30' }
    expect(proximosVencimentos(RECEITAS, HOJE, ateNovembro).map((v) => [v.receita.valor, v.dias])).toEqual([
      [1000, 5],
      [300, 18],
    ])
    expect(proximosVencimentos(RECEITAS, HOJE, OUTUBRO)).toHaveLength(1)
  })

  it('atrasadas: as vencidas até o fim do período, da mais antiga', () => {
    expect(atrasadas(RECEITAS, HOJE).map((v) => [v.receita.valor, v.dias])).toEqual([
      [200, -35],
      [800, -5],
    ])
    expect(atrasadas(RECEITAS, HOJE, SETEMBRO.fim)).toHaveLength(1)
  })
})

describe('ticketMedio', () => {
  it('faturamento do mês dividido pelos clientes com cobrança no mês', () => {
    const cobrancas = [
      receita({ cliente_id: 'c1', valor: 3000, data_vencimento: '2026-10-05', status: 'RECEIVED' }),
      receita({ cliente_id: 'c2', valor: 1000, data_vencimento: '2026-10-10' }),
      receita({ cliente_id: 'c3', valor: 2000, data_vencimento: '2026-09-10', status: 'RECEIVED' }),
      receita({ cliente_id: 'c1', valor: 3000, data_vencimento: '2026-09-05', status: 'RECEIVED' }),
      receita({ cliente_id: 'c2', valor: 1000, data_vencimento: '2026-09-10', status: 'RECEIVED' }),
      receita({ cliente_id: 'c4', valor: 9999, data_vencimento: '2026-10-12', status: 'DELETED' }),
    ]
    // c3 saiu em outubro: deixa o denominador e o ticket sobe
    expect(ticketMedio(cobrancas, OUTUBRO)).toEqual({ valor: 2000, clientes: 2 })
    expect(ticketMedio(cobrancas, SETEMBRO)).toEqual({ valor: 2000, clientes: 3 })
    // Dois meses: (6000 + 4000) / (3 + 2)
    expect(ticketMedio(cobrancas, { inicio: '2026-09-01', fim: '2026-10-31' })).toEqual({ valor: 2000, clientes: 3 })
    // Uma semana usa o mês dela
    expect(ticketMedio(cobrancas, { inicio: '2026-10-12', fim: '2026-10-18' }).valor).toBe(2000)
  })

  it('sem cobrança no período, não há ticket', () => {
    expect(ticketMedio([], OUTUBRO)).toEqual({ valor: null, clientes: 0 })
  })
})

describe('separarReceitas', () => {
  it('sem período: em aberto são pendentes e vencidas; histórico, as pagas', () => {
    const { abertas, historico } = separarReceitas(RECEITAS)
    expect(abertas.map((r) => r.data_vencimento)).toEqual(['2026-09-10', '2026-10-10', '2026-10-20', '2026-11-02'])
    expect(historico.map((r) => r.data_pagamento)).toEqual(['2026-10-04', '2026-10-01', '2026-09-10'])
  })

  it('com período: pendentes dele, vencidas até o fim dele e pagas nele', () => {
    const { abertas, historico } = separarReceitas(RECEITAS, OUTUBRO)
    expect(abertas.map((r) => r.data_vencimento)).toEqual(['2026-09-10', '2026-10-10', '2026-10-20'])
    expect(historico.map((r) => r.data_pagamento)).toEqual(['2026-10-04', '2026-10-01'])
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
      OUTUBRO,
      (r) => (r.cliente_id === 'c1' ? 'Clínica Aurora' : (r.nome_cliente_asaas ?? '')),
    )
    expect(linhas).toEqual([
      { chave: 'cus_9', nome: 'Avulso', pago: 0, total: 100, percentual: 0 },
      { chave: 'c1', nome: 'Clínica Aurora', pago: 600, total: 1000, percentual: 60 },
    ])
  })
})

describe('MRR, ARR e gráficos da Visão Geral', () => {
  it('MRR é de um mês só: o último do período, ou o atual; ARR é 12 vezes', () => {
    expect(mrrDoMes(RECEITAS, OUTUBRO, HOJE)).toEqual({ mes: '2026-10', mrr: 3800, arr: 45600 })
    // Período de três meses que termina em setembro: vale setembro (sem cancelada nem estornada)
    expect(mrrDoMes(RECEITAS, { inicio: '2026-07-01', fim: '2026-09-30' }, HOJE)).toEqual({ mes: '2026-09', mrr: 1400, arr: 16800 })
    // Período que avança no futuro: vale o mês atual
    expect(mrrDoMes(RECEITAS, { inicio: '2026-05-01', fim: '2026-12-31' }, HOJE).mes).toBe('2026-10')
  })

  it('desempenho: receita, despesas e lucro por mês', () => {
    const despesas = [
      { valor: 1000, data: '2026-10-03' },
      { valor: 900, data: '2026-09-20' },
    ]
    const meses = desempenhoMensal(RECEITAS, despesas, OUTUBRO)
    expect(meses).toHaveLength(6)
    expect(meses.slice(-2)).toEqual([
      { mes: '2026-09', rotulo: 'set', receita: 700, despesas: 900, lucro: -200 },
      { mes: '2026-10', rotulo: 'out', receita: 2500, despesas: 1000, lucro: 1500 },
    ])
  })

  it('histórico do ticket tem pelo menos seis meses, e doze no anual', () => {
    expect(historicoDoTicket(RECEITAS, OUTUBRO)).toHaveLength(6)
    expect(historicoDoTicket(RECEITAS, { inicio: '2025-11-01', fim: '2026-10-31' })).toHaveLength(12)
    expect(historicoDoTicket(RECEITAS, OUTUBRO).at(-1)?.valor).toBe(1900)
  })

  it('receita por cliente: o pago no período, do maior para o menor', () => {
    const cobrancas = [
      receita({ status: 'RECEIVED', valor: 500, data_pagamento: '2026-10-02', asaas_customer_id: 'a', nome_cliente_asaas: 'A' }),
      receita({ status: 'RECEIVED', valor: 2000, data_pagamento: '2026-10-03', asaas_customer_id: 'b', nome_cliente_asaas: 'B' }),
      receita({ status: 'RECEIVED', valor: 700, data_pagamento: '2026-10-09', asaas_customer_id: 'a', nome_cliente_asaas: 'A' }),
      receita({ status: 'RECEIVED', valor: 9000, data_pagamento: '2026-09-09', asaas_customer_id: 'c', nome_cliente_asaas: 'C' }),
      receita({ status: 'PENDING', valor: 9000, asaas_customer_id: 'd', nome_cliente_asaas: 'D' }),
    ]
    expect(receitaPorCliente(cobrancas, OUTUBRO, (r) => r.nome_cliente_asaas ?? '')).toEqual([
      { chave: 'b', rotulo: 'B', valor: 2000 },
      { chave: 'a', rotulo: 'A', valor: 1200 },
    ])
  })
})
