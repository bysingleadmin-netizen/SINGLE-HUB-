import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ToastProvider, useToast } from './Toast'

function Gatilho() {
  const toast = useToast()
  return (
    <>
      <button onClick={() => toast.sucesso('Cliente salvo.')}>sucesso</button>
      <button onClick={() => toast.erro('Acesso não autorizado.')}>erro</button>
    </>
  )
}

function montar() {
  render(
    <ToastProvider>
      <Gatilho />
    </ToastProvider>,
  )
}

describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('mostra a mensagem e some sozinho depois de 3 segundos', async () => {
    montar()
    fireEvent.click(screen.getByText('sucesso'))
    expect(screen.getByRole('status')).toHaveTextContent('Cliente salvo.')

    act(() => {
      vi.advanceTimersByTime(2999)
    })
    expect(screen.getByRole('status')).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(1)
    })
    // Depois dos 3 segundos ele esmaece e sai (a animação usa o relógio de verdade)
    vi.useRealTimers()
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
  })

  it('não duplica uma mensagem idêntica que ainda está visível', () => {
    montar()
    fireEvent.click(screen.getByText('erro'))
    fireEvent.click(screen.getByText('erro'))
    expect(screen.getAllByRole('status')).toHaveLength(1)
  })

  it('empilha mensagens diferentes', () => {
    montar()
    fireEvent.click(screen.getByText('erro'))
    fireEvent.click(screen.getByText('sucesso'))
    expect(screen.getAllByRole('status')).toHaveLength(2)
  })

  it('fecha ao clicar em fechar', async () => {
    vi.useRealTimers()
    montar()
    fireEvent.click(screen.getByText('sucesso'))
    fireEvent.click(screen.getByRole('button', { name: 'Fechar aviso' }))
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
  })
})
