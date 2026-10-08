import { act, fireEvent, render, screen } from '@testing-library/react'
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

  it('mostra a mensagem e some sozinho depois de 4 segundos', () => {
    montar()
    fireEvent.click(screen.getByText('sucesso'))
    expect(screen.getByRole('status')).toHaveTextContent('Cliente salvo.')

    act(() => {
      vi.advanceTimersByTime(4000)
    })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
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

  it('fecha ao clicar em fechar', () => {
    montar()
    fireEvent.click(screen.getByText('sucesso'))
    fireEvent.click(screen.getByRole('button', { name: 'Fechar aviso' }))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
