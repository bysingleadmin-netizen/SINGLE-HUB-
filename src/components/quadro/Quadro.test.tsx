vi.mock('@/lib/supabase', async () => {
  const { criarSupabaseFalso } = await import('@/test/supabaseFalso')
  return { supabase: criarSupabaseFalso() }
})

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { bancoFalso, renderizar } from '@/test/renderizar'
import { Quadro } from './Quadro'
import { useMover } from './useMover'

interface Item {
  id: string
  titulo: string
  status: string
  posicao: number
  created_at: string
}

const COLUNAS = [
  { id: 'a_fazer', titulo: 'A Fazer' },
  { id: 'concluido', titulo: 'Concluído' },
]

const ITENS: Item[] = [
  { id: 't2', titulo: 'Segundo', status: 'a_fazer', posicao: 2, created_at: '2026-10-01' },
  { id: 't1', titulo: 'Primeiro', status: 'a_fazer', posicao: 1, created_at: '2026-10-01' },
]

function montar(itens = ITENS) {
  const acoes = { onMover: vi.fn(), onCriar: vi.fn(), onAbrir: vi.fn(), onArquivar: vi.fn() }
  render(
    <Quadro
      colunas={COLUNAS}
      itens={itens}
      colunaDe={(item) => item.status}
      tituloDe={(item) => item.titulo}
      atrasado={(item) => item.id === 't1'}
      renderCard={(item) => <span>{item.titulo}</span>}
      {...acoes}
    />,
  )
  return acoes
}

describe('Quadro', () => {
  it('mostra cada coluna com a contagem e os cards em ordem', () => {
    montar()
    const aFazer = within(screen.getByRole('region', { name: 'A Fazer' }))
    expect(aFazer.getByText('2')).toBeInTheDocument()
    expect(aFazer.getAllByRole('button', { name: /^Abrir/ }).map((b) => b.textContent)).toEqual([
      'Primeiro',
      'Segundo',
    ])
    expect(
      within(screen.getByRole('region', { name: 'Concluído' })).getByText('Nada aqui.'),
    ).toBeInTheDocument()
  })

  it('cria na coluna escolhida', () => {
    const { onCriar } = montar()
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar em Concluído' }))
    expect(onCriar).toHaveBeenCalledWith('concluido')
  })

  it('abre o card ao clicar', () => {
    const { onAbrir } = montar()
    fireEvent.click(screen.getByRole('button', { name: 'Abrir Primeiro' }))
    expect(onAbrir).toHaveBeenCalledWith(ITENS[1])
  })

  it('arquiva sem abrir', () => {
    const { onArquivar, onAbrir } = montar()
    fireEvent.click(screen.getByRole('button', { name: 'Arquivar Segundo' }))
    expect(onArquivar).toHaveBeenCalledWith(ITENS[0])
    expect(onAbrir).not.toHaveBeenCalled()
  })

  it('marca o card atrasado', () => {
    montar()
    const card = (titulo: string) =>
      screen.getByRole('button', { name: `Abrir ${titulo}` }).parentElement
    expect(card('Primeiro')).toHaveAttribute('data-atrasado')
    expect(card('Segundo')).not.toHaveAttribute('data-atrasado')
  })
})

describe('useMover', () => {
  const LINHAS = [
    { id: 't1', titulo: 'Primeiro', status: 'a_fazer', posicao: 1, created_at: '2026-10-01' },
    { id: 't3', titulo: 'Pronto', status: 'concluido', posicao: 4, created_at: '2026-10-01' },
  ]

  function Gatilho({ destino }: { destino: string }) {
    const mover = useMover<Item>({
      tabela: 'tasks',
      campo: 'status',
      sucesso: (item, para) => `${item.titulo} foi para ${para}.`,
      erro: 'Não foi possível mover.',
      atividade: (item, para) =>
        para === 'arquivado'
          ? null
          : {
              acao: 'demanda_movida',
              descricao: `moveu "${item.titulo}"`,
              entidade: 'tasks',
              entidadeId: item.id,
            },
    })
    return <button onClick={() => mover(LINHAS[0], destino, LINHAS)}>mover</button>
  }

  beforeEach(() => {
    bancoFalso().reiniciar({ tasks: LINHAS })
  })

  it('grava a coluna nova no fim dela, avisa e registra a atividade', async () => {
    renderizar(<Gatilho destino="concluido" />)
    fireEvent.click(screen.getByText('mover'))

    expect(await screen.findByText('Primeiro foi para concluido.')).toBeInTheDocument()
    expect(bancoFalso().tabelas.tasks[0]).toMatchObject({ status: 'concluido', posicao: 5 })
    await waitFor(() =>
      expect(bancoFalso().tabelas.activity_log).toContainEqual(
        expect.objectContaining({ acao: 'demanda_movida', entidade_id: 't1' }),
      ),
    )
  })

  it('não registra atividade quando a configuração devolve null', async () => {
    renderizar(<Gatilho destino="arquivado" />)
    fireEvent.click(screen.getByText('mover'))
    expect(await screen.findByText('Primeiro foi para arquivado.')).toBeInTheDocument()
    expect(bancoFalso().tabelas.activity_log ?? []).toHaveLength(0)
  })

  it('avisa quando o banco recusa e não muda a linha', async () => {
    bancoFalso().erroEscrita = { message: 'negado' }
    renderizar(<Gatilho destino="concluido" />)
    fireEvent.click(screen.getByText('mover'))
    expect(await screen.findByText('Não foi possível mover.')).toBeInTheDocument()
    expect(bancoFalso().tabelas.tasks[0].status).toBe('a_fazer')
  })
})
