import type { Task } from '@/types/database'
import { filtrarTarefas, formNovaTarefa, validarTarefa } from './tarefa'

describe('validarTarefa', () => {
  it('exige o título', () => {
    expect(validarTarefa({ ...formNovaTarefa('a_fazer'), titulo: ' ' })).toEqual({
      erros: { titulo: 'Informe o título da demanda.' },
    })
  })

  it('troca os campos em branco por null', () => {
    expect(
      validarTarefa({
        ...formNovaTarefa('em_andamento'),
        titulo: ' Roteiro ',
        tipo: 'audiovisual',
        client_id: 'c1',
      }),
    ).toEqual({
      valores: {
        titulo: 'Roteiro',
        descricao: null,
        client_id: 'c1',
        responsavel_id: null,
        tipo: 'audiovisual',
        status: 'em_andamento',
        data_entrega: null,
      },
    })
  })
})

describe('filtrarTarefas', () => {
  const tarefas = [
    { id: 'a', tipo: 'conteudo', responsavel_id: 'u1' },
    { id: 'b', tipo: 'trafego', responsavel_id: 'u2' },
    { id: 'c', tipo: 'trafego', responsavel_id: null },
  ] as Task[]

  it('sem filtros devolve tudo', () => {
    expect(filtrarTarefas(tarefas, { tipo: '', responsaveis: [] })).toHaveLength(3)
  })

  it('filtra por tipo, por responsável e pelos dois juntos', () => {
    const ids = (filtros: Parameters<typeof filtrarTarefas>[1]) =>
      filtrarTarefas(tarefas, filtros).map((t) => t.id)
    expect(ids({ tipo: 'trafego', responsaveis: [] })).toEqual(['b', 'c'])
    expect(ids({ tipo: '', responsaveis: ['u1'] })).toEqual(['a'])
    expect(ids({ tipo: 'trafego', responsaveis: ['u2'] })).toEqual(['b'])
  })

  it('com vários responsáveis marcados mostra as demandas de qualquer um deles', () => {
    expect(
      filtrarTarefas(tarefas, { tipo: '', responsaveis: ['u1', 'u2'] }).map((t) => t.id),
    ).toEqual(['a', 'b'])
  })
})
