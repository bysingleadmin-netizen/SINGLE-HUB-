import { avisosDoMenu, itensVisiveis, tituloDaRota } from './navegacao'

describe('itensVisiveis', () => {
  it('esconde Financeiro de quem não é liderança', () => {
    expect(itensVisiveis('Designer').map((i) => i.rotulo)).toEqual([
      'Dashboard',
      'Clientes',
      'Tarefas',
      'Demandas',
      'Conteúdo',
      'Anúncios',
      'Calendário',
      'Configurações',
    ])
  })

  it('mostra Financeiro para a liderança, antes de Configurações', () => {
    expect(itensVisiveis('CEO').map((i) => i.rotulo)).toEqual([
      'Dashboard',
      'Clientes',
      'Tarefas',
      'Demandas',
      'Conteúdo',
      'Anúncios',
      'Calendário',
      'Financeiro',
      'Configurações',
    ])
  })

  it('esconde Financeiro sem cargo', () => {
    expect(itensVisiveis(null).some((i) => i.rotulo === 'Financeiro')).toBe(false)
  })
})

describe('avisosDoMenu', () => {
  const HOJE = '2026-10-09'

  it('conta demandas atrasadas e otimizações pendentes', () => {
    const avisos = avisosDoMenu(
      [
        { status: 'a_fazer', data_entrega: '2026-10-08' },
        { status: 'em_andamento', data_entrega: '2026-10-01' },
        { status: 'concluido', data_entrega: '2026-10-01' },
        { status: 'a_fazer', data_entrega: HOJE },
      ],
      [
        { status: 'em_execucao', proxima_otimizacao: HOJE },
        { status: 'pausada', proxima_otimizacao: '2026-10-01' },
      ],
      HOJE,
    )
    expect(avisos).toEqual({
      '/app/demandas': { total: 2, descricao: '2 demandas atrasadas' },
      '/app/anuncios': { total: 1, descricao: '1 otimização pendente' },
    })
  })

  it('tarefa interna atrasada avisa em Tarefas, não em Demandas', () => {
    const avisos = avisosDoMenu(
      [
        { status: 'a_fazer', data_entrega: '2026-10-08', quadro: 'tarefas' },
        { status: 'a_fazer', data_entrega: '2026-10-07', quadro: 'tarefas' },
        { status: 'a_fazer', data_entrega: '2026-10-08', quadro: 'demandas' },
      ],
      [],
      HOJE,
    )
    expect(avisos).toEqual({
      '/app/tarefas': { total: 2, descricao: '2 tarefas atrasadas' },
      '/app/demandas': { total: 1, descricao: '1 demanda atrasada' },
    })
  })

  it('sem pendências não há aviso', () => {
    expect(avisosDoMenu([{ status: 'a_fazer', data_entrega: null }], [], HOJE)).toEqual({})
  })
})

describe('tituloDaRota', () => {
  it('acha o título pela rota, inclusive em subrotas', () => {
    expect(tituloDaRota('/app/dashboard')).toBe('Dashboard')
    expect(tituloDaRota('/app/anuncios/123')).toBe('Anúncios')
    expect(tituloDaRota('/app/financeiro/dre')).toBe('Financeiro')
  })

  it('tem fallback para rota desconhecida', () => {
    expect(tituloDaRota('/app/qualquer')).toBe('SINGLE')
  })
})
