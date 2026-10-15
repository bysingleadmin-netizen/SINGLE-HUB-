import type { Expense } from '@/types/database'
import {
  custoPorLead,
  datasDaRecorrencia,
  despesaDoMes,
  dreDoMes,
  filtrarDespesas,
  formatarPercentual,
  progressoDaMeta,
  taxaDeConversao,
  totalDasDespesas,
  validarDespesa,
  validarMeses,
  validarMetricas,
} from './financeiro'

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

describe('despesa e DRE do mês', () => {
  const despesas = [
    despesa({ valor: 200, data: '2026-10-01' }),
    despesa({ valor: 50.25, data: '2026-10-31' }),
    despesa({ valor: 999, data: '2026-09-30' }),
  ]

  it('soma as despesas pela data', () => {
    expect(despesaDoMes(despesas, '2026-10')).toBe(250.25)
  })

  it('o resultado é a receita menos as despesas, e pode ser negativo', () => {
    expect(dreDoMes(1500.5, despesas, '2026-10')).toEqual({
      mes: '2026-10',
      receita: 1500.5,
      despesas: 250.25,
      resultado: 1250.25,
    })
    expect(dreDoMes(0, despesas, '2026-09').resultado).toBe(-999)
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

describe('despesa recorrente', () => {
  it('repete a data mês a mês a partir da informada', () => {
    expect(datasDaRecorrencia('2026-10-14', 5)).toEqual([
      '2026-10-14',
      '2026-11-14',
      '2026-12-14',
      '2027-01-14',
      '2027-02-14',
    ])
  })

  it('dia que não existe no mês cai no último dia dele', () => {
    expect(datasDaRecorrencia('2026-01-31', 3)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31'])
  })

  it('aceita de 1 a 36 meses, inteiros', () => {
    expect(validarMeses('5')).toBe(5)
    expect(validarMeses('36')).toBe(36)
    expect(validarMeses('1')).toBe(1)
    for (const invalido of ['', '0', '37', '2,5', 'abc']) expect(validarMeses(invalido)).toBeNull()
  })
})
