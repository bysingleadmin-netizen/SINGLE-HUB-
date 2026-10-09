import { agrupar, destinoDoArraste, proximaPosicao } from './colunas'

const COLUNAS = [{ id: 'a_fazer' }, { id: 'em_andamento' }, { id: 'concluido' }]

function item(id: string, status: string, posicao: number, created_at = '2026-10-01') {
  return { id, status, posicao, created_at }
}

describe('agrupar', () => {
  it('separa por coluna, ordena por posição e desempata pela criação', () => {
    const grupos = agrupar(
      [
        item('b', 'a_fazer', 2),
        item('a', 'a_fazer', 1),
        item('d', 'a_fazer', 2, '2026-09-01'),
        item('c', 'concluido', 0),
      ],
      COLUNAS,
      (i) => i.status,
    )
    expect(grupos.get('a_fazer')?.map((i) => i.id)).toEqual(['a', 'd', 'b'])
    expect(grupos.get('em_andamento')).toEqual([])
    expect(grupos.get('concluido')?.map((i) => i.id)).toEqual(['c'])
  })

  it('deixa de fora o que não pertence a nenhuma coluna, como os arquivados', () => {
    const grupos = agrupar([item('x', 'arquivado', 0)], COLUNAS, (i) => i.status)
    expect([...grupos.values()].flat()).toEqual([])
  })
})

describe('proximaPosicao', () => {
  it('fica depois do último da coluna', () => {
    expect(proximaPosicao([{ posicao: 3 }, { posicao: 7.5 }])).toBe(8.5)
  })

  it('começa em 1 na coluna vazia', () => {
    expect(proximaPosicao([])).toBe(1)
  })
})

describe('destinoDoArraste', () => {
  it('devolve a coluna quando o card é solto em outra', () => {
    expect(destinoDoArraste('a_fazer', 'concluido', COLUNAS)).toBe('concluido')
  })

  it('ignora soltar na mesma coluna, fora do quadro ou em algo que não é coluna', () => {
    expect(destinoDoArraste('a_fazer', 'a_fazer', COLUNAS)).toBeNull()
    expect(destinoDoArraste('a_fazer', null, COLUNAS)).toBeNull()
    expect(destinoDoArraste('a_fazer', undefined, COLUNAS)).toBeNull()
    expect(destinoDoArraste('a_fazer', 'arquivado', COLUNAS)).toBeNull()
  })
})
