import { COLUNAS_CONTEUDO, COLUNAS_TAREFA } from '@/lib/rotulos'
import type { ContentCard, Task } from '@/types/database'
import { arcosDaRosca, contarPorColuna } from './statusDosCards'

const AGORA = new Date('2026-10-14T12:00:00Z')
const tarefa = (campos: Partial<Task>) => ({ status: 'a_fazer', ...campos }) as Task
const card = (campos: Partial<ContentCard>) => ({ etapa: 'editar', ...campos }) as ContentCard
const pelaColuna = (t: Task) => t.status

describe('contarPorColuna', () => {
  it('conta os cards pela coluna em que estão, na ordem do quadro', () => {
    const fatias = contarPorColuna(
      [tarefa({}), tarefa({}), tarefa({ status: 'concluido' }), tarefa({ status: 'em_andamento' })],
      COLUNAS_TAREFA,
      pelaColuna,
      AGORA,
    )
    expect(fatias.map((f) => [f.rotulo, f.total])).toEqual([
      ['A Fazer', 2],
      ['Em Andamento', 1],
      ['Aguardando Aprovação', 0],
      ['Concluído', 1],
    ])
  })

  it('ignora o status antigo (Travado, Em andamento, Feito) gravado no card', () => {
    const fatias = contarPorColuna(
      [tarefa({ situacao: 'travado' }), tarefa({ status: 'em_andamento', situacao: 'feito' })],
      COLUNAS_TAREFA,
      pelaColuna,
      AGORA,
    )
    expect(fatias.map((f) => f.total)).toEqual([1, 1, 0, 0])
  })

  it('usa os nomes que a equipe deu e conta coluna criada por ela', () => {
    const colunas = [{ id: 'editar', titulo: 'Edição' }, { id: 'personalizada_rev', titulo: 'Revisão', personalizada: true }]
    const fatias = contarPorColuna(
      [card({}), card({ etapa: 'personalizada_rev' as ContentCard['etapa'] })],
      colunas,
      (c) => c.etapa,
      AGORA,
    )
    expect(fatias.map((f) => [f.rotulo, f.total])).toEqual([
      ['Edição', 1],
      ['Revisão', 1],
    ])
  })

  it('deixa de fora o que saiu dos quadros: arquivados e concluídos há mais de 7 dias', () => {
    const fatias = contarPorColuna(
      [
        tarefa({ status: 'arquivado' }),
        tarefa({ status: 'concluido', concluded_at: '2026-10-01T00:00:00Z' }),
        tarefa({ status: 'concluido', concluded_at: '2026-10-13T00:00:00Z' }),
        tarefa({ archived_at: '2026-10-10T00:00:00Z' }),
      ],
      COLUNAS_TAREFA,
      pelaColuna,
      AGORA,
    )
    expect(fatias.find((f) => f.valor === 'concluido')?.total).toBe(1)
    expect(fatias.find((f) => f.valor === 'a_fazer')?.total).toBe(0)
    expect(fatias.some((f) => f.valor === 'arquivado')).toBe(false)
  })

  it('card numa coluna que saiu do quadro continua contado; a de entregue fica verde', () => {
    const fatias = contarPorColuna([card({ etapa: 'coluna_removida' as ContentCard['etapa'] })], COLUNAS_CONTEUDO, (c) => c.etapa, AGORA)
    expect(fatias[fatias.length - 1]).toMatchObject({ valor: 'coluna_removida', total: 1 })
    const cores = fatias.slice(0, 4).map((f) => f.cor)
    expect(new Set(cores.slice(0, 3)).size).toBe(3)
    expect(fatias.find((f) => f.valor === 'publicado')?.cor).not.toBe(cores[0])
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
