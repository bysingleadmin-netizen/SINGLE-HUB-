vi.mock('@/lib/supabase', async () => {
  const { criarSupabaseFalso } = await import('@/test/supabaseFalso')
  return { supabase: criarSupabaseFalso() }
})

import { fireEvent, screen, within } from '@testing-library/react'
import { useLocation } from 'react-router-dom'
import { bancoFalso, renderizar } from '@/test/renderizar'
import type { Campaign, Client, ContentCard, Task } from '@/types/database'
import { BuscaGlobal } from './BuscaGlobal'
import { buscar } from './busca'

const DADOS = {
  clientes: [
    { id: 'c1', nome: 'Clínica Vita' },
    { id: 'c2', nome: 'Padaria Sol' },
  ] as Client[],
  tarefas: [
    { id: 't1', titulo: 'Roteiro da clínica', status: 'a_fazer' },
    { id: 't2', titulo: 'Clínica antiga', status: 'arquivado' },
  ] as Task[],
  cards: [
    { id: 'k1', titulo: 'Reels da Padaria', etapa: 'editar' },
    { id: 'k2', titulo: 'Post arquivado da padaria', etapa: 'arquivado' },
  ] as ContentCard[],
  campanhas: [{ id: 'g1', nome: 'Black Friday Clínica' }] as Campaign[],
}

describe('buscar', () => {
  it('ignora acentos e maiúsculas e procura nos quatro tipos', () => {
    expect(buscar('clinica', DADOS)).toEqual([
      { tipo: 'cliente', id: 'c1', nome: 'Clínica Vita', rota: '/app/clientes/c1' },
      { tipo: 'demanda', id: 't1', nome: 'Roteiro da clínica', rota: '/app/demandas?abrir=t1' },
      { tipo: 'campanha', id: 'g1', nome: 'Black Friday Clínica', rota: '/app/anuncios/g1' },
    ])
  })

  it('acha conteúdo e deixa de fora o que está arquivado', () => {
    expect(buscar('PADARIA', DADOS).map((r) => r.id)).toEqual(['c2', 'k1'])
    expect(buscar('padaria', DADOS)[1]).toMatchObject({
      tipo: 'conteudo',
      rota: '/app/conteudo?abrir=k1',
    })
  })

  it('termo vazio ou só com espaços não devolve nada', () => {
    expect(buscar('', DADOS)).toEqual([])
    expect(buscar('   ', DADOS)).toEqual([])
  })

  it('limita a quantidade de resultados', () => {
    const muitos = {
      ...DADOS,
      clientes: Array.from({ length: 30 }, (_, i) => ({ id: `x${i}`, nome: `Loja ${i}` })) as Client[],
    }
    expect(buscar('loja', muitos)).toHaveLength(12)
  })
})

describe('BuscaGlobal', () => {
  function Onde() {
    const { pathname, search } = useLocation()
    return <p data-testid="onde">{pathname + search}</p>
  }

  function montar() {
    bancoFalso().reiniciar({
      clients: [{ id: 'c1', nome: 'Clínica Vita', status: 'ativo', mrr: 0, created_at: '2026-01-01' }],
      tasks: [{ id: 't1', titulo: 'Roteiro da clínica', status: 'a_fazer', posicao: 1, created_at: '2026-01-01' }],
      content_cards: [],
      campaigns: [{ id: 'g1', nome: 'Black Friday', client_id: 'c1', status: 'planejamento', created_at: '2026-01-01' }],
    })
    return renderizar(
      <>
        <BuscaGlobal />
        <Onde />
      </>,
    )
  }

  async function abrirEDigitar(texto: string) {
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true })
    const paleta = within(screen.getByRole('dialog', { name: 'Buscar' }))
    // Espera os dados chegarem antes de digitar
    await paleta.findByText('Digite para procurar em clientes, demandas, conteúdos e anúncios.')
    fireEvent.change(paleta.getByRole('combobox', { name: 'Buscar' }), { target: { value: texto } })
    return paleta
  }

  it('fica fechada até o atalho ou o botão', () => {
    montar()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }))
    expect(screen.getByRole('dialog', { name: 'Buscar' })).toBeInTheDocument()
  })

  it('Ctrl+K abre, e Cmd+K também', () => {
    montar()
    fireEvent.keyDown(document, { key: 'k', metaKey: true })
    expect(screen.getByRole('dialog', { name: 'Buscar' })).toBeInTheDocument()
  })

  it('mostra os resultados com o tipo e navega ao clicar', async () => {
    montar()
    const paleta = await abrirEDigitar('clinica')
    const cliente = await paleta.findByRole('option', { name: /Clínica Vita/ })
    expect(cliente).toHaveTextContent('Cliente')
    expect(paleta.getByRole('option', { name: /Roteiro da clínica/ })).toHaveTextContent('Demanda')

    fireEvent.click(cliente)
    expect(screen.getByTestId('onde')).toHaveTextContent('/app/clientes/c1')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('as setas escolhem o resultado e Enter navega', async () => {
    montar()
    const paleta = await abrirEDigitar('clinica')
    await paleta.findByRole('option', { name: /Clínica Vita/ })
    const campo = paleta.getByRole('combobox', { name: 'Buscar' })
    expect(paleta.getByRole('option', { name: /Clínica Vita/ })).toHaveAttribute('aria-selected', 'true')

    fireEvent.keyDown(campo, { key: 'ArrowDown' })
    expect(paleta.getByRole('option', { name: /Roteiro da clínica/ })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    fireEvent.keyDown(campo, { key: 'Enter' })
    expect(screen.getByTestId('onde')).toHaveTextContent('/app/demandas?abrir=t1')
  })

  it('avisa quando nada foi encontrado', async () => {
    montar()
    const paleta = await abrirEDigitar('xyz')
    expect(await paleta.findByText('Nada encontrado para "xyz".')).toBeInTheDocument()
  })
})
