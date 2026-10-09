import type { Campaign, CampaignTask, Client, ContentCard, Task } from '@/types/database'
import {
  agruparPorDia,
  calcularMetricas,
  cargaPorPessoa,
  descreverPrazo,
  quandoAconteceu,
  dataAposOtimizar,
  diasDeAtraso,
  proximasOtimizacoes,
  situacaoDoPrazo,
  formatarFidelidade,
  mrrPorMes,
  otimizacaoPendente,
  pagamentoAtrasado,
  parseMoeda,
  proximasEntregas,
  tarefaAberta,
  tarefaAtrasada,
  tempoRelativo,
} from './regras'

const HOJE = '2026-10-08'

function tarefa(parcial: Partial<Task>): Task {
  return {
    id: 't',
    titulo: 'Tarefa',
    descricao: null,
    client_id: null,
    responsavel_id: null,
    tipo: 'conteudo',
    status: 'a_fazer',
    data_entrega: null,
    posicao: 0,
    created_by: null,
    created_at: '2026-10-01T00:00:00Z',
    ...parcial,
  }
}

describe('tarefas', () => {
  it('aberta é tudo que não está concluído nem arquivado', () => {
    expect(tarefaAberta(tarefa({ status: 'aguardando_aprovacao' }))).toBe(true)
    expect(tarefaAberta(tarefa({ status: 'concluido' }))).toBe(false)
    expect(tarefaAberta(tarefa({ status: 'arquivado' }))).toBe(false)
  })

  it('atrasada exige prazo anterior a hoje e tarefa aberta', () => {
    expect(tarefaAtrasada(tarefa({ data_entrega: '2026-10-07' }), HOJE)).toBe(true)
    expect(tarefaAtrasada(tarefa({ data_entrega: HOJE }), HOJE)).toBe(false)
    expect(tarefaAtrasada(tarefa({ data_entrega: null }), HOJE)).toBe(false)
    expect(tarefaAtrasada(tarefa({ data_entrega: '2026-10-01', status: 'concluido' }), HOJE)).toBe(
      false,
    )
  })

  it('conta dias de atraso', () => {
    expect(diasDeAtraso('2026-10-05', HOJE)).toBe(3)
    expect(diasDeAtraso('2026-10-10', HOJE)).toBe(0)
  })

  it('lista próximas entregas: abertas, com prazo em até 7 dias ou vencido, por data', () => {
    const lista = proximasEntregas(
      [
        tarefa({ id: 'longe', data_entrega: '2026-10-20' }),
        tarefa({ id: 'amanha', data_entrega: '2026-10-09' }),
        tarefa({ id: 'atrasada', data_entrega: '2026-10-01' }),
        tarefa({ id: 'sem-data' }),
        tarefa({ id: 'feita', data_entrega: '2026-10-09', status: 'concluido' }),
        tarefa({ id: 'limite', data_entrega: '2026-10-15' }),
      ],
      HOJE,
    )
    expect(lista.map((t) => t.id)).toEqual(['atrasada', 'amanha', 'limite'])
  })
})

describe('situacaoDoPrazo', () => {
  it('vermelho para vencido, amarelo até dois dias, verde com folga', () => {
    expect(situacaoDoPrazo('2026-10-07', HOJE)).toBe('atrasado')
    expect(situacaoDoPrazo(HOJE, HOJE)).toBe('proximo')
    expect(situacaoDoPrazo('2026-10-10', HOJE)).toBe('proximo')
    expect(situacaoDoPrazo('2026-10-11', HOJE)).toBe('folgado')
  })

  it('não há situação sem data nem para o que já foi entregue', () => {
    expect(situacaoDoPrazo(null, HOJE)).toBeNull()
    expect(situacaoDoPrazo('2026-10-01', HOJE, true)).toBeNull()
  })
})

describe('otimizacaoPendente', () => {
  it('só vale para campanha em execução com data até hoje', () => {
    expect(otimizacaoPendente({ status: 'em_execucao', proxima_otimizacao: HOJE }, HOJE)).toBe(true)
    expect(otimizacaoPendente({ status: 'em_execucao', proxima_otimizacao: '2026-10-09' }, HOJE)).toBe(
      false,
    )
    expect(otimizacaoPendente({ status: 'pausada', proxima_otimizacao: '2026-10-01' }, HOJE)).toBe(
      false,
    )
    expect(otimizacaoPendente({ status: 'em_execucao', proxima_otimizacao: null }, HOJE)).toBe(false)
  })
})

describe('proximasOtimizacoes', () => {
  const campanha = (id: string, proxima: string | null, status: Campaign['status'] = 'em_execucao') =>
    ({ id, status, proxima_otimizacao: proxima }) as Campaign

  it('lista campanhas em execução com otimização vencida ou em até 3 dias, por data', () => {
    const lista = proximasOtimizacoes(
      [
        campanha('em-3-dias', '2026-10-11'),
        campanha('longe', '2026-10-12'),
        campanha('vencida', '2026-10-02'),
        campanha('pausada', '2026-10-08', 'pausada'),
        campanha('sem-data', null),
      ],
      HOJE,
    )
    expect(lista.map((c) => c.id)).toEqual(['vencida', 'em-3-dias'])
  })

  it('a próxima otimização fica para dois dias depois do registro', () => {
    expect(dataAposOtimizar(HOJE)).toBe('2026-10-10')
    expect(dataAposOtimizar('2026-10-31')).toBe('2026-11-02')
  })
})

describe('pagamentoAtrasado', () => {
  it('vale para marcado como atrasado ou pendente vencido', () => {
    expect(pagamentoAtrasado({ status: 'atrasado', data_vencimento: '2026-10-20' }, HOJE)).toBe(true)
    expect(pagamentoAtrasado({ status: 'pendente', data_vencimento: '2026-10-07' }, HOJE)).toBe(true)
    expect(pagamentoAtrasado({ status: 'pendente', data_vencimento: HOJE }, HOJE)).toBe(false)
    expect(pagamentoAtrasado({ status: 'pago', data_vencimento: '2026-01-01' }, HOJE)).toBe(false)
  })
})

describe('formatarFidelidade', () => {
  it('escreve meses e anos por extenso', () => {
    expect(formatarFidelidade(0)).toBe('menos de 1 mês')
    expect(formatarFidelidade(1)).toBe('1 mês')
    expect(formatarFidelidade(5)).toBe('5 meses')
    expect(formatarFidelidade(12)).toBe('1 ano')
    expect(formatarFidelidade(14)).toBe('1 ano e 2 meses')
    expect(formatarFidelidade(25)).toBe('2 anos e 1 mês')
  })
})

describe('tempoRelativo', () => {
  const agora = new Date('2026-10-08T12:00:00Z')
  it('descreve há quanto tempo algo aconteceu', () => {
    expect(tempoRelativo('2026-10-08T11:59:40Z', agora)).toBe('agora')
    expect(tempoRelativo('2026-10-08T11:45:00Z', agora)).toBe('há 15 min')
    expect(tempoRelativo('2026-10-08T09:00:00Z', agora)).toBe('há 3 h')
    expect(tempoRelativo('2026-10-07T10:00:00Z', agora)).toBe('há 1 dia')
    expect(tempoRelativo('2026-10-03T12:00:00Z', agora)).toBe('há 5 dias')
  })

  it('usa a data para o que é antigo', () => {
    expect(tempoRelativo('2026-08-01T12:00:00Z', agora)).toBe('01/08/2026')
  })
})

describe('parseMoeda', () => {
  it('aceita formato brasileiro e simples', () => {
    expect(parseMoeda('1.500,50')).toBe(1500.5)
    expect(parseMoeda('R$ 2.000')).toBe(2000)
    expect(parseMoeda('1500.5')).toBe(1500.5)
    expect(parseMoeda('800')).toBe(800)
  })

  it('devolve null para vazio, texto ou negativo', () => {
    expect(parseMoeda('')).toBeNull()
    expect(parseMoeda('abc')).toBeNull()
    expect(parseMoeda('-10')).toBeNull()
  })
})

describe('mrrPorMes', () => {
  const cliente = (mrr: number, inicio: string | null, status = 'ativo') =>
    ({ mrr, data_inicio_contrato: inicio, status }) as Client

  it('devolve os seis meses até o atual, do mais antigo para o mais novo', () => {
    const serie = mrrPorMes([], HOJE)
    expect(serie.map((p) => p.mes)).toEqual([
      '2026-05',
      '2026-06',
      '2026-07',
      '2026-08',
      '2026-09',
      '2026-10',
    ])
    expect(serie.map((p) => p.rotulo)).toEqual(['mai', 'jun', 'jul', 'ago', 'set', 'out'])
    expect(serie.every((p) => p.valor === 0)).toBe(true)
  })

  it('soma em cada mês o MRR dos clientes ativos cujo contrato já tinha começado', () => {
    const serie = mrrPorMes(
      [
        cliente(1000, '2025-01-10'),
        cliente(500, '2026-08-31'),
        cliente(250.5, '2026-10-01'),
        cliente(900, '2026-11-01'),
        cliente(700, '2026-01-01', 'churn'),
      ],
      HOJE,
    )
    expect(serie.map((p) => p.valor)).toEqual([1000, 1000, 1000, 1500, 1500, 1750.5])
  })

  it('cliente sem data de início conta em todos os meses', () => {
    expect(mrrPorMes([cliente(300, null)], HOJE).map((p) => p.valor)).toEqual([
      300, 300, 300, 300, 300, 300,
    ])
  })

  it('vira o ano corretamente', () => {
    expect(mrrPorMes([], '2026-02-15').map((p) => p.mes)).toEqual([
      '2025-09',
      '2025-10',
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02',
    ])
  })
})

describe('calcularMetricas', () => {
  it('soma MRR só dos ativos e conta o que está em aberto', () => {
    const clientes = [
      { status: 'ativo', mrr: 1500 },
      { status: 'ativo', mrr: 2500.5 },
      { status: 'pausado', mrr: 900 },
      { status: 'churn', mrr: 700 },
    ] as Client[]
    const tarefas = [
      tarefa({ status: 'a_fazer' }),
      tarefa({ status: 'em_andamento' }),
      tarefa({ status: 'concluido' }),
      tarefa({ status: 'arquivado' }),
    ]
    const cards = [
      { etapa: 'aguardando_aprovacao' },
      { etapa: 'aguardando_aprovacao' },
      { etapa: 'publicado' },
    ] as ContentCard[]

    const deAnuncio = [{ status: 'pendente' }, { status: 'concluido' }] as CampaignTask[]

    // Abertas: 2 demandas, 2 conteúdos em produção e 1 tarefa de anúncio
    expect(calcularMetricas(clientes, tarefas, cards, deAnuncio)).toEqual({
      mrrTotal: 4000.5,
      clientesAtivos: 2,
      tarefasAbertas: 5,
      conteudosAguardando: 2,
    })
  })

  it('funciona com tudo vazio', () => {
    expect(calcularMetricas([], [], [])).toEqual({
      mrrTotal: 0,
      clientesAtivos: 0,
      tarefasAbertas: 0,
      conteudosAguardando: 0,
    })
  })
})

describe('quandoAconteceu', () => {
  // 9 de outubro de 2026, 16h20, no fuso de quem roda o teste
  const agora = new Date(2026, 9, 9, 16, 20)
  const em = (...partes: [number, number, number, number, number]) => new Date(...partes).toISOString()

  it('fala do mesmo dia em minutos e horas', () => {
    expect(quandoAconteceu(em(2026, 9, 9, 16, 20), agora)).toBe('agora')
    expect(quandoAconteceu(em(2026, 9, 9, 16, 5), agora)).toBe('há 15 min')
    expect(quandoAconteceu(em(2026, 9, 9, 15, 10), agora)).toBe('há 1 hora')
    expect(quandoAconteceu(em(2026, 9, 9, 9, 0), agora)).toBe('há 7 horas')
  })

  it('ontem e dias anteriores levam a hora', () => {
    expect(quandoAconteceu(em(2026, 9, 8, 14, 0), agora)).toBe('ontem às 14h')
    expect(quandoAconteceu(em(2026, 9, 3, 9, 30), agora)).toBe('03/10 às 9h30')
    expect(quandoAconteceu(em(2025, 11, 31, 23, 5), agora)).toBe('31/12/2025 às 23h05')
  })
})

describe('agruparPorDia', () => {
  it('separa em Hoje, Ontem e datas, mantendo a ordem', () => {
    const agora = new Date(2026, 9, 9, 16, 20)
    const registro = (id: string, dia: number, hora: number) => ({
      id,
      created_at: new Date(2026, 9, dia, hora).toISOString(),
    })
    const grupos = agruparPorDia(
      [registro('a', 9, 15), registro('b', 9, 8), registro('c', 8, 20), registro('d', 2, 10)],
      agora,
    )
    expect(grupos.map((g) => g.rotulo)).toEqual(['Hoje', 'Ontem', '02/10/2026'])
    expect(grupos[0].itens.map((r) => r.id)).toEqual(['a', 'b'])
  })
})

describe('cargaPorPessoa', () => {
  it('soma o que está em aberto nas três categorias, do mais carregado para o menos', () => {
    const carga = cargaPorPessoa(
      [
        { status: 'a_fazer', responsavel_id: 'u1' },
        { status: 'concluido', responsavel_id: 'u1' },
        { status: 'em_andamento', responsavel_id: null },
      ],
      [
        { etapa: 'editar', responsavel_id: 'u1' },
        { etapa: 'publicado', responsavel_id: 'u2' },
      ],
      [
        { status: 'pendente', responsavel_id: 'u2' },
        { status: 'pendente', responsavel_id: 'u1' },
      ],
    )
    expect(carga).toEqual([
      { id: 'u1', total: 3, fatia: 0.75 },
      { id: 'u2', total: 1, fatia: 0.25 },
    ])
  })
})

describe('descreverPrazo', () => {
  it('descreve o prazo em palavras', () => {
    expect(descreverPrazo(null, HOJE)).toBe('Sem data de entrega')
    expect(descreverPrazo('2026-10-05', HOJE)).toBe('3 dias de atraso')
    expect(descreverPrazo(HOJE, HOJE)).toBe('Vence hoje')
    expect(descreverPrazo('2026-10-09', HOJE)).toBe('Vence amanhã')
    expect(descreverPrazo('2026-10-18', HOJE)).toBe('Vence em 10 dias')
    expect(descreverPrazo('2026-10-01', HOJE, true)).toBe('Entregue')
  })
})
