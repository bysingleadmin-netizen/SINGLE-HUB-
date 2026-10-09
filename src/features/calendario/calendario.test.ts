import type { CalendarEvent, ContentCard, Task } from '@/types/database'
import {
  agendaPorDia,
  diasDoEvento,
  formNovoEvento,
  gradeDoMes,
  horarioDoEvento,
  mesVizinho,
  montarAgenda,
  nomeDoDia,
  nomeDoMes,
  validarEvento,
} from './calendario'

/** Timestamp ISO a partir de um horário local, como o navegador gera. */
function local(ano: number, mes: number, dia: number, hora = 0, minuto = 0): string {
  return new Date(ano, mes - 1, dia, hora, minuto).toISOString()
}

function evento(parcial: Partial<CalendarEvent>): CalendarEvent {
  return {
    id: 'e',
    titulo: 'Evento',
    descricao: null,
    tipo: 'reuniao',
    data_inicio: local(2026, 10, 8, 14),
    data_fim: null,
    dia_inteiro: false,
    client_id: null,
    created_by: null,
    created_at: '2026-10-01T00:00:00Z',
    ...parcial,
  }
}

describe('gradeDoMes', () => {
  it('monta semanas completas de domingo a sábado cobrindo o mês', () => {
    const grade = gradeDoMes(2026, 10)
    expect(grade.length % 7).toBe(0)
    expect(grade[0]).toEqual({ iso: '2026-09-27', doMes: false })
    expect(grade[4]).toEqual({ iso: '2026-10-01', doMes: true })
    expect(grade[grade.length - 1]).toEqual({ iso: '2026-10-31', doMes: true })
    expect(grade.filter((d) => d.doMes)).toHaveLength(31)
  })

  it('funciona em fevereiro que começa no domingo', () => {
    const grade = gradeDoMes(2026, 2)
    expect(grade).toHaveLength(28)
    expect(grade[0].iso).toBe('2026-02-01')
  })
})

describe('mesVizinho', () => {
  it('anda para frente e para trás virando o ano', () => {
    expect(mesVizinho({ ano: 2026, mes: 12 }, 1)).toEqual({ ano: 2027, mes: 1 })
    expect(mesVizinho({ ano: 2026, mes: 1 }, -1)).toEqual({ ano: 2025, mes: 12 })
    expect(mesVizinho({ ano: 2026, mes: 10 }, 1)).toEqual({ ano: 2026, mes: 11 })
  })
})

describe('nomes', () => {
  it('escreve o mês e o dia por extenso', () => {
    expect(nomeDoMes(2026, 10)).toBe('outubro de 2026')
    expect(nomeDoDia('2026-10-08')).toBe('8 de outubro de 2026')
  })
})

describe('diasDoEvento', () => {
  it('evento sem fim ocupa só o dia em que começa', () => {
    expect(diasDoEvento(evento({}))).toEqual(['2026-10-08'])
  })

  it('evento às 23h fica no dia local em que foi marcado', () => {
    expect(diasDoEvento(evento({ data_inicio: local(2026, 10, 8, 23) }))).toEqual(['2026-10-08'])
  })

  it('evento que atravessa a meia-noite aparece nos dois dias', () => {
    expect(
      diasDoEvento(
        evento({ data_inicio: local(2026, 10, 8, 22), data_fim: local(2026, 10, 9, 2) }),
      ),
    ).toEqual(['2026-10-08', '2026-10-09'])
  })

  it('evento de vários dias aparece em todos, inclusive virando o mês', () => {
    expect(
      diasDoEvento(
        evento({
          dia_inteiro: true,
          data_inicio: local(2026, 10, 30),
          data_fim: local(2026, 11, 1, 23, 59),
        }),
      ),
    ).toEqual(['2026-10-30', '2026-10-31', '2026-11-01'])
  })

  it('ignora fim anterior ao início', () => {
    expect(
      diasDoEvento(evento({ data_inicio: local(2026, 10, 8, 14), data_fim: local(2026, 10, 7, 9) })),
    ).toEqual(['2026-10-08'])
  })
})

describe('agenda: eventos e entregas na mesma lista', () => {
  const tarefa = (parcial: Partial<Task>) =>
    ({ id: 't', titulo: 'Tarefa', status: 'a_fazer', client_id: null, data_entrega: '2026-10-08', ...parcial }) as Task
  const card = (parcial: Partial<ContentCard>) =>
    ({ id: 'k', titulo: 'Card', etapa: 'editar', client_id: null, data_entrega: '2026-10-08', ...parcial }) as ContentCard

  it('toda demanda e todo conteúdo com data de entrega entram, levando ao item de origem', () => {
    const agenda = montarAgenda(
      [],
      [tarefa({ id: 't1', titulo: 'Roteiro', client_id: 'c1' })],
      [card({ id: 'k1', titulo: 'Carrossel' })],
    )
    expect(agenda).toEqual([
      expect.objectContaining({
        chave: 'demanda-t1',
        origem: 'demanda',
        titulo: 'Roteiro',
        rotulo: 'Demanda',
        tom: 'vermelho',
        dias: ['2026-10-08'],
        horario: 'Entrega',
        rota: '/app/demandas?abrir=t1',
        clientId: 'c1',
        concluido: false,
      }),
      expect.objectContaining({
        chave: 'conteudo-k1',
        origem: 'conteudo',
        rotulo: 'Conteúdo',
        rota: '/app/conteudo?abrir=k1',
      }),
    ])
  })

  it('fica de fora o que não tem data ou está arquivado; o que foi entregue entra marcado', () => {
    const agenda = montarAgenda(
      [],
      [
        tarefa({ id: 'sem-data', data_entrega: null }),
        tarefa({ id: 'arquivada', status: 'arquivado' }),
        tarefa({ id: 'feita', status: 'concluido' }),
      ],
      [card({ id: 'arquivado', etapa: 'arquivado' }), card({ id: 'publicado', etapa: 'publicado' })],
    )
    expect(agenda.map((item) => [item.chave, item.concluido])).toEqual([
      ['demanda-feita', true],
      ['conteudo-publicado', true],
    ])
  })

  it('evento vira item com a cor do tipo e sem rota própria', () => {
    const [item] = montarAgenda([evento({ id: 'e1', tipo: 'gravacao', client_id: 'c2' })], [], [])
    expect(item).toMatchObject({
      chave: 'evento-e1',
      origem: 'evento',
      rotulo: 'Gravação',
      tom: 'roxo',
      horario: '14:00',
      rota: null,
      clientId: 'c2',
    })
    expect(item.evento?.id).toBe('e1')
  })

  it('nada se duplica: cada evento e cada entrega aparece uma vez por dia', () => {
    const agenda = montarAgenda(
      [evento({ id: 'e1', titulo: 'Entrega do roteiro', tipo: 'entrega' })],
      [tarefa({ id: 't1', titulo: 'Entrega do roteiro' })],
      [],
    )
    const doDia = agendaPorDia(agenda).get('2026-10-08') ?? []
    expect(doDia.map((item) => item.chave).sort()).toEqual(['demanda-t1', 'evento-e1'])
  })

  it('no dia, vêm primeiro os de dia inteiro, depois as entregas, depois os com horário', () => {
    const mapa = agendaPorDia(
      montarAgenda(
        [
          evento({ id: 'tarde', data_inicio: local(2026, 10, 8, 16) }),
          evento({ id: 'manha', data_inicio: local(2026, 10, 8, 9) }),
          evento({ id: 'dia', dia_inteiro: true, data_inicio: local(2026, 10, 8) }),
          evento({ id: 'outro-dia', data_inicio: local(2026, 10, 9, 9) }),
        ],
        [tarefa({ id: 't1' })],
        [],
      ),
    )
    expect(mapa.get('2026-10-08')?.map((item) => item.chave)).toEqual([
      'evento-dia',
      'demanda-t1',
      'evento-manha',
      'evento-tarde',
    ])
    expect(mapa.get('2026-10-09')?.map((item) => item.chave)).toEqual(['evento-outro-dia'])
    expect(mapa.get('2026-10-10')).toBeUndefined()
  })
})

describe('horarioDoEvento', () => {
  it('mostra dia inteiro, só o início ou o intervalo', () => {
    expect(horarioDoEvento(evento({ dia_inteiro: true }))).toBe('Dia inteiro')
    expect(horarioDoEvento(evento({ data_inicio: local(2026, 10, 8, 14, 30) }))).toBe('14:30')
    expect(
      horarioDoEvento(
        evento({ data_inicio: local(2026, 10, 8, 14), data_fim: local(2026, 10, 8, 15, 30) }),
      ),
    ).toBe('14:00 às 15:30')
  })
})

describe('validarEvento', () => {
  const base = { ...formNovoEvento('2026-10-08'), titulo: 'Reunião de pauta' }

  it('exige título, data e, fora do dia inteiro, a hora de início', () => {
    expect(validarEvento({ ...formNovoEvento(''), hora_inicio: '' })).toEqual({
      erros: {
        titulo: 'Informe o título do evento.',
        data_inicio: 'Informe a data.',
        hora_inicio: 'Informe a hora de início.',
      },
    })
  })

  it('monta o evento com horário local convertido para timestamp', () => {
    expect(
      validarEvento({
        ...base,
        tipo: 'gravacao',
        hora_inicio: '14:00',
        hora_fim: '15:30',
        client_id: 'c1',
        participantes: ['u2'],
      }),
    ).toEqual({
      valores: {
        titulo: 'Reunião de pauta',
        descricao: null,
        tipo: 'gravacao',
        data_inicio: local(2026, 10, 8, 14),
        data_fim: local(2026, 10, 8, 15, 30),
        dia_inteiro: false,
        client_id: 'c1',
      },
    })
  })

  it('sem hora de fim, o evento fica sem fim', () => {
    expect(validarEvento({ ...base, hora_inicio: '09:00', hora_fim: '' })).toMatchObject({
      valores: { data_fim: null },
    })
  })

  it('dia inteiro vai da primeira hora do início à última do fim', () => {
    expect(validarEvento({ ...base, dia_inteiro: true, data_fim: '2026-10-10' })).toMatchObject({
      valores: {
        dia_inteiro: true,
        data_inicio: local(2026, 10, 8),
        data_fim: local(2026, 10, 10, 23, 59),
      },
    })
  })

  it('recusa fim antes do início', () => {
    expect(
      validarEvento({ ...base, hora_inicio: '14:00', hora_fim: '13:00' }),
    ).toEqual({ erros: { hora_fim: 'O fim não pode vir antes do início.' } })
    expect(
      validarEvento({ ...base, dia_inteiro: true, data_fim: '2026-10-07' }),
    ).toEqual({ erros: { data_fim: 'O fim não pode vir antes do início.' } })
  })
})
