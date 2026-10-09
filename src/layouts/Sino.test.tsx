vi.mock('@/lib/supabase', async () => {
  const { criarSupabaseFalso } = await import('@/test/supabaseFalso')
  return { supabase: criarSupabaseFalso() }
})

import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { useLocation } from 'react-router-dom'
import { bancoFalso, renderizar } from '@/test/renderizar'
import { Sino } from './Sino'

function Onde() {
  const { pathname, search } = useLocation()
  return <p data-testid="onde">{pathname + search}</p>
}

function montar() {
  return renderizar(
    <>
      <Sino />
      <Onde />
    </>,
  )
}

function notificacao(parcial: Record<string, unknown>) {
  return {
    user_id: 'u1',
    tipo: 'tarefa',
    titulo: 'Nova demanda para você',
    mensagem: 'Bia atribuiu a demanda "Roteiro" a você.',
    link: '/app/demandas?abrir=t1',
    lida: false,
    created_at: new Date().toISOString(),
    ...parcial,
  }
}

describe('Sino', () => {
  it('sem notificações não mostra contagem e a lista explica que está vazia', async () => {
    bancoFalso().reiniciar()
    montar()
    const sino = screen.getByRole('button', { name: 'Notificações' })
    fireEvent.click(sino)
    expect(await screen.findByText('Nenhuma notificação.')).toBeInTheDocument()
  })

  it('mostra quantas estão por ler', async () => {
    bancoFalso().reiniciar({
      notifications: [
        notificacao({ id: 'n1' }),
        notificacao({ id: 'n2' }),
        notificacao({ id: 'n3', lida: true }),
      ],
    })
    montar()
    expect(
      await screen.findByRole('button', { name: 'Notificações, 2 não lidas' }),
    ).toHaveTextContent('2')
  })

  it('lista com título, mensagem e tempo relativo', async () => {
    bancoFalso().reiniciar({ notifications: [notificacao({ id: 'n1' })] })
    montar()
    fireEvent.click(await screen.findByRole('button', { name: /Notificações, 1/ }))
    const lista = within(screen.getByRole('region', { name: 'Notificações' }))
    expect(lista.getByText('Nova demanda para você')).toBeInTheDocument()
    expect(lista.getByText('Bia atribuiu a demanda "Roteiro" a você.')).toBeInTheDocument()
    expect(lista.getByText('agora')).toBeInTheDocument()
  })

  it('clicar marca como lida, vai para o item e fecha a lista', async () => {
    bancoFalso().reiniciar({ notifications: [notificacao({ id: 'n1' })] })
    montar()
    fireEvent.click(await screen.findByRole('button', { name: /Notificações, 1/ }))
    fireEvent.click(screen.getByRole('button', { name: /Nova demanda para você/ }))

    expect(screen.getByTestId('onde')).toHaveTextContent('/app/demandas?abrir=t1')
    await waitFor(() => expect(bancoFalso().tabelas.notifications[0].lida).toBe(true))
    expect(screen.queryByRole('region', { name: 'Notificações' })).not.toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Notificações' })).toBeInTheDocument()
  })

  it('não navega para link que não é do próprio app', async () => {
    bancoFalso().reiniciar({
      notifications: [notificacao({ id: 'n1', link: 'https://exemplo.com/golpe' })],
    })
    montar()
    fireEvent.click(await screen.findByRole('button', { name: /Notificações, 1/ }))
    fireEvent.click(screen.getByRole('button', { name: /Nova demanda para você/ }))
    expect(screen.getByTestId('onde')).toHaveTextContent('/')
    expect(screen.getByTestId('onde')).not.toHaveTextContent('exemplo')
  })

  it('fecha com Escape', async () => {
    bancoFalso().reiniciar()
    montar()
    fireEvent.click(screen.getByRole('button', { name: 'Notificações' }))
    expect(await screen.findByRole('region', { name: 'Notificações' })).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('region', { name: 'Notificações' })).not.toBeInTheDocument()
  })

  it('falha de leitura não quebra o cabeçalho', async () => {
    bancoFalso().reiniciar()
    bancoFalso().erroLeitura = { message: 'sem rede' }
    montar()
    fireEvent.click(screen.getByRole('button', { name: 'Notificações' }))
    expect(await screen.findByText('Não foi possível carregar as notificações.')).toBeInTheDocument()
  })
})
