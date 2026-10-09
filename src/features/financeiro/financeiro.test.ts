import type { Client, ClientPayment, Expense } from '@/types/database'
import {
  custoPorLead,
  despesaDoMes,
  dreDoMes,
  faturamentoPorMes,
  filtrarDespesas,
  formatarPercentual,
  inadimplencia,
  pagamentosEmAtraso,
  pendenteNoMes,
  progressoDaMeta,
  proximosVencimentos,
  receitaDoMes,
  taxaDeConversao,
  totalDasDespesas,
  validarDespesa,
  validarMetricas,
} from './financeiro'

const HOJE = '2026-10-09'

function pagamento(parcial: Partial<ClientPayment>): ClientPayment {
  return {
    id: 'p',
    client_id: 'c1',
    mes_referencia: '2026-10-01',
    valor: 1000,
    data_vencimento: '2026-10-05',
    data_pagamento: '2026-10-05',
    status: 'pago',
    created_at: '2026-10-01T00:00:00Z',
    ...parcial,
  }
}

function despesa(parcial: Partial<Expense>): Expense {
  return {
    id: 'd',
    descricao: 'Ferramenta',
    categoria: 'Ferramentas',
    valor: 100,
    data: '2026-10-02',
    forma_pagamento: 'Pix',
    created_by: null,
    created_at: '2026-10-02T00:00:00Z',
    ...parcial,
  }
}

function cliente(parcial: Partial<Client>): Client {
  return {
    id: 'c1',
    nome: 'Clínica Aurora',
    logo_url: null,
    status: 'ativo',
    mrr: 1500,
    data_inicio_contrato: '2026-08-05',
    instagram: null,
    link_conta_anuncios: null,
    contato_nome: null,
    contato_email: null,
    contato_telefone: null,
    observacoes: null,
    created_at: '2026-08-05T00:00:00Z',
    ...parcial,
  }
}

describe('receita, despesa e DRE do mês', () => {
  const pagamentos = [
    pagamento({ valor: 1000, data_pagamento: '2026-10-01' }),
    pagamento({ valor: 500.5, data_pagamento: '2026-10-31' }),
    // Referente a outubro, mas recebido em novembro: conta em novembro
    pagamento({ valor: 300, data_pagamento: '2026-11-02' }),
    pagamento({ valor: 900, status: 'pendente', data_pagamento: null }),
  ]
  const despesas = [
    despesa({ valor: 200, data: '2026-10-01' }),
    despesa({ valor: 50.25, data: '2026-10-31' }),
    despesa({ valor: 999, data: '2026-09-30' }),
  ]

  it('soma só o que foi pago, pela data do pagamento', () => {
    expect(receitaDoMes(pagamentos, '2026-10')).toBe(1500.5)
    expect(receitaDoMes(pagamentos, '2026-11')).toBe(300)
    expect(receitaDoMes(pagamentos, '2026-12')).toBe(0)
  })

  it('soma as despesas pela data', () => {
    expect(despesaDoMes(despesas, '2026-10')).toBe(250.25)
  })

  it('o resultado é a receita menos as despesas, e pode ser negativo', () => {
    expect(dreDoMes(pagamentos, despesas, '2026-10')).toEqual({
      mes: '2026-10',
      receita: 1500.5,
      despesas: 250.25,
      resultado: 1250.25,
    })
    expect(dreDoMes(pagamentos, despesas, '2026-09').resultado).toBe(-999)
  })

  it('aceita valores que o banco devolve como texto', () => {
    const comoTexto = [pagamento({ valor: '1000.50' as unknown as number })]
    expect(receitaDoMes(comoTexto, '2026-10')).toBe(1000.5)
  })

  it('monta a série dos últimos seis meses', () => {
    const serie = faturamentoPorMes(pagamentos, HOJE)
    expect(serie.map((p) => p.mes)).toEqual([
      '2026-05',
      '2026-06',
      '2026-07',
      '2026-08',
      '2026-09',
      '2026-10',
    ])
    expect(serie.map((p) => p.valor)).toEqual([0, 0, 0, 0, 0, 1500.5])
  })
})

describe('cobranças em aberto', () => {
  const clientes = [cliente({}), cliente({ id: 'c2', nome: 'Padaria Sol' })]
  const cobranca = (parcial: Partial<ClientPayment>) =>
    pagamento({ status: 'pendente', data_pagamento: null, ...parcial })
  const pagamentos = [
    cobranca({ id: 'a', mes_referencia: '2026-09-01', data_vencimento: '2026-09-05', valor: 1500 }),
    cobranca({ id: 'b', mes_referencia: '2026-10-01', data_vencimento: '2026-10-08', valor: 1500 }),
    cobranca({ id: 'c', client_id: 'c2', mes_referencia: '2026-10-01', data_vencimento: '2026-10-09', valor: 800 }),
    cobranca({ id: 'd', client_id: 'c2', mes_referencia: '2026-11-01', data_vencimento: '2026-10-16', valor: 800 }),
    cobranca({ id: 'e', client_id: 'c2', mes_referencia: '2026-12-01', data_vencimento: '2026-10-17', valor: 800 }),
    pagamento({ id: 'f', mes_referencia: '2026-08-01', data_vencimento: '2026-08-05' }),
    cobranca({ id: 'g', mes_referencia: '2026-07-01', data_vencimento: '2026-07-05', status: 'cancelado' }),
  ]

  it('lista o que venceu e não foi pago, do mais atrasado para o menos', () => {
    expect(pagamentosEmAtraso(clientes, pagamentos, HOJE)).toEqual([
      { cliente: { id: 'c1', nome: 'Clínica Aurora' }, mes: '2026-09-01', valor: 1500, vencimento: '2026-09-05', dias: -34 },
      { cliente: { id: 'c1', nome: 'Clínica Aurora' }, mes: '2026-10-01', valor: 1500, vencimento: '2026-10-08', dias: -1 },
    ])
  })

  it('resume a inadimplência em valor, cobranças e clientes', () => {
    expect(inadimplencia(pagamentosEmAtraso(clientes, pagamentos, HOJE))).toEqual({
      total: 3000,
      cobrancas: 2,
      clientes: 1,
    })
  })

  it('próximos vencimentos vão de hoje até daqui a sete dias', () => {
    const proximos = proximosVencimentos(clientes, pagamentos, HOJE)
    expect(proximos.map((v) => [v.vencimento, v.dias])).toEqual([
      ['2026-10-09', 0],
      ['2026-10-16', 7],
    ])
    expect(proximos[0].cliente.nome).toBe('Padaria Sol')
  })

  it('pendente no mês soma as cobranças em aberto daquele mês de referência', () => {
    expect(pendenteNoMes(pagamentos, '2026-10')).toBe(2300)
    expect(pendenteNoMes(pagamentos, '2026-08')).toBe(0)
  })

  it('cliente apagado ainda aparece, com nome de reserva', () => {
    expect(pagamentosEmAtraso([], pagamentos, HOJE)[0].cliente.nome).toBe('Cliente removido')
  })
})
describe('métricas de tráfego', () => {
  const metrica = { investimento: 1500, leads_instagram: 20, leads_whatsapp: 10, convertidos: 6 }

  it('calcula o custo por lead e a conversão', () => {
    expect(custoPorLead(metrica)).toBe(50)
    expect(taxaDeConversao(metrica)).toBe(20)
  })

  it('sem leads não há o que calcular', () => {
    const semLeads = { ...metrica, leads_instagram: 0, leads_whatsapp: 0 }
    expect(custoPorLead(semLeads)).toBeNull()
    expect(taxaDeConversao(semLeads)).toBeNull()
  })

  it('formata percentual no padrão brasileiro', () => {
    expect(formatarPercentual(33.333)).toBe('33,3%')
    expect(formatarPercentual(100)).toBe('100%')
  })
})

describe('progressoDaMeta', () => {
  it('mostra o percentual e o que falta', () => {
    expect(progressoDaMeta(2500, 10000)).toEqual({ percentual: 25, falta: 7500 })
  })

  it('meta batida não deixa valor negativo faltando', () => {
    expect(progressoDaMeta(12000, 10000)).toEqual({ percentual: 120, falta: 0 })
  })

  it('sem meta o percentual é zero', () => {
    expect(progressoDaMeta(500, 0)).toEqual({ percentual: 0, falta: 0 })
  })
})

describe('filtrarDespesas', () => {
  const despesas = [
    despesa({ id: '1', data: '2026-10-01', categoria: 'Equipe', valor: 3000 }),
    despesa({ id: '2', data: '2026-10-31', categoria: 'Ferramentas', valor: 200 }),
    despesa({ id: '3', data: '2026-09-30', categoria: 'Ferramentas', valor: 150 }),
  ]

  it('inclui o primeiro e o último dia do período, da mais recente para a mais antiga', () => {
    const lista = filtrarDespesas(despesas, { de: '2026-10-01', ate: '2026-10-31', categoria: '' })
    expect(lista.map((d) => d.id)).toEqual(['2', '1'])
    expect(totalDasDespesas(lista)).toBe(3200)
  })

  it('filtra por categoria e aceita período em aberto', () => {
    const lista = filtrarDespesas(despesas, { de: '', ate: '', categoria: 'Ferramentas' })
    expect(lista.map((d) => d.id)).toEqual(['2', '3'])
  })
})

describe('validarDespesa', () => {
  const form = {
    descricao: '  Adobe  ',
    categoria: 'Ferramentas',
    valor: '1.250,90',
    data: '2026-10-09',
    forma_pagamento: 'Cartão',
  }

  it('devolve os valores prontos para o banco', () => {
    expect(validarDespesa(form)).toEqual({
      valores: {
        descricao: 'Adobe',
        categoria: 'Ferramentas',
        valor: 1250.9,
        data: '2026-10-09',
        forma_pagamento: 'Cartão',
      },
    })
  })

  it('aponta descrição, valor e data que faltam', () => {
    expect(validarDespesa({ ...form, descricao: ' ', valor: 'abc', data: '' })).toEqual({
      erros: {
        descricao: 'Informe a descrição.',
        valor: 'Informe um valor como 1.500,00.',
        data: 'Informe a data.',
      },
    })
  })

  it('recusa despesa de valor zero', () => {
    expect(validarDespesa({ ...form, valor: '0' })).toHaveProperty('erros.valor')
  })
})

describe('validarMetricas', () => {
  const form = {
    mes: '2026-10',
    investimento: '1.500,00',
    leads_instagram: '20',
    leads_whatsapp: '10',
    convertidos: '6',
  }

  it('grava o mês como primeiro dia e os números como números', () => {
    expect(validarMetricas(form)).toEqual({
      valores: {
        mes: '2026-10-01',
        investimento: 1500,
        leads_instagram: 20,
        leads_whatsapp: 10,
        convertidos: 6,
      },
    })
  })

  it('campo vazio vale zero', () => {
    expect(
      validarMetricas({ ...form, investimento: '', leads_whatsapp: '', convertidos: '' }),
    ).toMatchObject({ valores: { investimento: 0, leads_whatsapp: 0, convertidos: 0 } })
  })

  it('recusa número quebrado ou negativo', () => {
    expect(validarMetricas({ ...form, leads_instagram: '2,5', leads_whatsapp: '-1' })).toMatchObject({
      erros: {
        leads_instagram: 'Informe um número inteiro.',
        leads_whatsapp: 'Informe um número inteiro.',
      },
    })
  })

  it('recusa mais convertidos do que leads', () => {
    expect(validarMetricas({ ...form, convertidos: '31' })).toEqual({
      erros: { convertidos: 'Os convertidos não podem passar do total de leads.' },
    })
  })
})
