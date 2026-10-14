import { SITUACOES } from '@/lib/rotulos'
import type { ContentCard, Task } from '@/types/database'
import { arcosDaRosca, contarStatus } from './statusDosCards'

const AGORA = new Date('2026-10-14T12:00:00Z')
const tarefa = (campos: Partial<Task>) => ({ status: 'a_fazer', ...campos }) as Task
const card = (campos: Partial<ContentCard>) => ({ etapa: 'editar', ...campos }) as ContentCard

describe('contarStatus', () => {
  it('soma demandas e conteúdos por status, com uma fatia para os sem status', () => {
    const fatias = contarStatus(
      [tarefa({ situacao: 'travado' }), tarefa({ situacao: 'feito' }), tarefa({})],
      [card({ situacao: 'travado' }), card({ situacao: null })],
      SITUACOES,
      AGORA,
    )
    expect(fatias.map((f) => [f.rotulo, f.total])).toEqual([
      ['Travado', 2],
      ['Em andamento', 0],
      ['Feito', 1],
      ['Sem status', 2],
    ])
  })

  it('deixa de fora o que saiu dos quadros: arquivados e concluídos há mais de 7 dias', () => {
    const fatias = contarStatus(
      [
        tarefa({ status: 'arquivado', situacao: 'feito' }),
        tarefa({ status: 'concluido', situacao: 'feito', concluded_at: '2026-10-01T00:00:00Z' }),
        tarefa({ status: 'concluido', situacao: 'feito', concluded_at: '2026-10-13T00:00:00Z' }),
      ],
      [card({ etapa: 'publicado', situacao: 'feito', archived_at: '2026-10-10T00:00:00Z' })],
      SITUACOES,
      AGORA,
    )
    expect(fatias.find((f) => f.valor === 'feito')?.total).toBe(1)
  })

  it('status criado pela equipe ganha cor própria, e status removido da lista continua contado', () => {
    const opcoes = [...SITUACOES, { valor: 'personalizada_a', rotulo: 'Em revisão', tom: 'cinza' as const, personalizada: true }]
    const fatias = contarStatus(
      [tarefa({ situacao: 'personalizada_a' }), tarefa({ situacao: 'personalizada_velha' })],
      [],
      opcoes,
      AGORA,
    )
    const revisao = fatias.find((f) => f.valor === 'personalizada_a')
    expect(revisao).toMatchObject({ rotulo: 'Em revisão', total: 1 })
    expect(revisao?.cor).not.toBe(fatias.find((f) => f.valor === 'sem_status')?.cor)
    expect(fatias.find((f) => f.valor === 'personalizada_velha')?.total).toBe(1)
    expect(fatias[fatias.length - 1].valor).toBe('sem_status')
  })
})

describe('arcosDaRosca', () => {
  it('encadeia as fatias com card e ignora as vazias', () => {
    const arcos = arcosDaRosca([
      { valor: 'a', rotulo: 'A', cor: '#000', total: 1 },
      { valor: 'b', rotulo: 'B', cor: '#000', total: 0 },
      { valor: 'c', rotulo: 'C', cor: '#000', total: 3 },
    ])
    expect(arcos.map((a) => [a.valor, a.inicio, a.fracao])).toEqual([
      ['a', 0, 0.25],
      ['c', 0.25, 0.75],
    ])
  })

  it('sem nenhum card, não há arco', () => {
    expect(arcosDaRosca([{ valor: 'a', rotulo: 'A', cor: '#000', total: 0 }])).toEqual([])
  })
})
