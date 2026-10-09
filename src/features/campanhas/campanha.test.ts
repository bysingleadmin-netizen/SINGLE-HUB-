import type { Campaign, CampaignTask } from '@/types/database'
import {
  agruparPorFuncao,
  formDaCampanha,
  formNovaCampanha,
  periodoDaCampanha,
  validarCampanha,
} from './campanha'

describe('validarCampanha', () => {
  it('exige nome e cliente', () => {
    expect(validarCampanha(formNovaCampanha())).toEqual({
      erros: { nome: 'Informe o nome da campanha.', client_id: 'Escolha o cliente.' },
    })
  })

  it('converte o orçamento com vírgula e troca datas em branco por null', () => {
    expect(
      validarCampanha({
        ...formNovaCampanha(),
        nome: ' Black Friday ',
        client_id: 'c1',
        status: 'em_execucao',
        orcamento: '3.000,50',
        data_inicio: '2026-11-01',
        proxima_otimizacao: '2026-11-03',
      }),
    ).toEqual({
      valores: {
        nome: 'Black Friday',
        client_id: 'c1',
        status: 'em_execucao',
        data_inicio: '2026-11-01',
        data_fim: null,
        orcamento: 3000.5,
        proxima_otimizacao: '2026-11-03',
      },
    })
  })

  it('orçamento em branco vira zero e texto é recusado', () => {
    const base = { ...formNovaCampanha(), nome: 'A', client_id: 'c1' }
    expect(validarCampanha(base)).toMatchObject({ valores: { orcamento: 0 } })
    expect(validarCampanha({ ...base, orcamento: 'muito' })).toEqual({
      erros: { orcamento: 'Informe um valor como 1.500,00.' },
    })
  })

  it('não aceita fim antes do início', () => {
    expect(
      validarCampanha({
        ...formNovaCampanha(),
        nome: 'A',
        client_id: 'c1',
        data_inicio: '2026-11-10',
        data_fim: '2026-11-01',
      }),
    ).toEqual({ erros: { data_fim: 'O fim não pode vir antes do início.' } })
  })
})

describe('formDaCampanha', () => {
  it('prepara a campanha para edição', () => {
    const campanha = {
      nome: 'Black Friday',
      client_id: 'c1',
      status: 'pausada',
      data_inicio: '2026-11-01',
      data_fim: null,
      orcamento: 3000.5,
      proxima_otimizacao: null,
    } as Campaign
    expect(formDaCampanha(campanha)).toEqual({
      nome: 'Black Friday',
      client_id: 'c1',
      status: 'pausada',
      data_inicio: '2026-11-01',
      data_fim: '',
      orcamento: '3000,50',
      proxima_otimizacao: '',
    })
  })
})

describe('periodoDaCampanha', () => {
  it('descreve o período conforme as datas que existem', () => {
    expect(periodoDaCampanha({ data_inicio: '2026-11-01', data_fim: '2026-11-30' })).toBe(
      '01/11/2026 a 30/11/2026',
    )
    expect(periodoDaCampanha({ data_inicio: '2026-11-01', data_fim: null })).toBe(
      'A partir de 01/11/2026',
    )
    expect(periodoDaCampanha({ data_inicio: null, data_fim: '2026-11-30' })).toBe('Até 30/11/2026')
    expect(periodoDaCampanha({ data_inicio: null, data_fim: null })).toBe('Sem datas')
  })
})

describe('agruparPorFuncao', () => {
  it('devolve as cinco funções na ordem, cada uma com as tarefas da campanha', () => {
    const tarefas = [
      { id: 'a', campaign_id: 'g1', funcao: 'trafego' },
      { id: 'b', campaign_id: 'g1', funcao: 'copy' },
      { id: 'c', campaign_id: 'outra', funcao: 'copy' },
      { id: 'd', campaign_id: 'g1', funcao: 'copy' },
    ] as CampaignTask[]
    const grupos = agruparPorFuncao(tarefas, 'g1')
    expect(grupos.map((g) => g.rotulo)).toEqual([
      'Copy',
      'Criativos',
      'Captação de Material',
      'Tráfego',
      'Estratégia',
    ])
    expect(grupos[0].tarefas.map((t) => t.id)).toEqual(['b', 'd'])
    expect(grupos[1].tarefas).toEqual([])
    expect(grupos[3].tarefas.map((t) => t.id)).toEqual(['a'])
  })
})
