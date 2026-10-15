import type { Task } from '@/types/database'
import { atividadeDaSemana, cardsPorCliente, fimDasSemanas, tendenciasDosIndicadores } from './tendencias'

const HOJE = '2026-10-15'
// Meio-dia local, para o dia não mudar com o fuso de quem roda o teste
const as12 = (dia: string) => new Date(`${dia}T12:00:00`).toISOString()

describe('cardsPorCliente', () => {
  it('conta as demandas em aberto por cliente, das mais para as menos, até o limite', () => {
    const tarefas = [
      { status: 'a_fazer', client_id: 'c1', archived_at: null },
      { status: 'em_andamento', client_id: 'c1', archived_at: null },
      { status: 'concluido', client_id: 'c1', archived_at: null },
      { status: 'a_fazer', client_id: 'c2', archived_at: null },
      { status: 'a_fazer', client_id: null, archived_at: null },
      { status: 'a_fazer', client_id: 'c3', archived_at: '2026-10-01T00:00:00Z' },
    ] as Pick<Task, 'status' | 'client_id' | 'archived_at'>[]
    const clientes = [{ id: 'c1', nome: 'Padaria Sol' }, { id: 'c2', nome: 'Clínica Vita' }]
    expect(cardsPorCliente(tarefas, clientes)).toEqual([
      { chave: 'c1', rotulo: 'Padaria Sol', valor: 2 },
      { chave: 'c2', rotulo: 'Clínica Vita', valor: 1 },
    ])
    expect(cardsPorCliente(tarefas, clientes, 1)).toHaveLength(1)
  })
})

describe('atividadeDaSemana', () => {
  it('conta demandas e conteúdos criados em cada um dos últimos sete dias', () => {
    const serie = atividadeDaSemana(
      [{ created_at: as12('2026-10-15') }, { created_at: as12('2026-10-15') }, { created_at: as12('2026-10-01') }],
      [{ created_at: as12('2026-10-09') }],
      HOJE,
    )
    expect(serie).toHaveLength(7)
    expect(serie[0]).toMatchObject({ mes: '2026-10-09', rotulo: 'sex 9', valor: 1 })
    expect(serie[6]).toMatchObject({ mes: '2026-10-15', rotulo: 'qui 15', valor: 2 })
    expect(serie.reduce((soma, p) => soma + p.valor, 0)).toBe(3)
  })
})

describe('tendências dos indicadores', () => {
  it('fim de cada uma das últimas quatro semanas, terminando hoje', () => {
    expect(fimDasSemanas(HOJE)).toEqual(['2026-09-24', '2026-10-01', '2026-10-08', '2026-10-15'])
  })

  it('reconstrói abertos e atrasados pelo que o banco guarda', () => {
    const tendencias = tendenciasDosIndicadores(
      [
        { status: 'ativo', created_at: as12('2026-09-01') },
        { status: 'ativo', created_at: as12('2026-10-05') },
        { status: 'churn', created_at: as12('2026-09-01') },
      ] as Parameters<typeof tendenciasDosIndicadores>[0],
      [
        // Aberta desde setembro, vencida desde 30/09
        { status: 'a_fazer', created_at: as12('2026-09-20'), concluded_at: null, archived_at: null, data_entrega: '2026-09-30' },
        // Concluída em 10/10: aberta até a semana de 08/10
        { status: 'concluido', created_at: as12('2026-09-20'), concluded_at: as12('2026-10-10'), archived_at: null, data_entrega: null },
        // Concluída sem data registrada: não conta em semana nenhuma
        { status: 'concluido', created_at: as12('2026-09-20'), concluded_at: null, archived_at: null, data_entrega: null },
      ] as Parameters<typeof tendenciasDosIndicadores>[1],
      [{ etapa: 'editar', created_at: as12('2026-10-12'), concluded_at: null, archived_at: null, data_entrega: null }] as Parameters<
        typeof tendenciasDosIndicadores
      >[2],
      HOJE,
      [
        { status: 'pendente', created_at: as12('2026-10-02') },
        { status: 'concluido', created_at: as12('2026-09-01') },
      ],
    )
    expect(tendencias.clientesAtivos).toEqual([1, 1, 2, 2])
    expect(tendencias.tarefasAbertas).toEqual([2, 2, 3, 3])
    expect(tendencias.cardsAtrasados).toEqual([0, 1, 1, 1])
  })
})
