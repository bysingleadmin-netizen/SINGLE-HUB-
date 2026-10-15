import { fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { Modal } from './Modal'
import { StatusSelect } from './StatusSelect'
import { escolher } from '@/test/escolher'

const OPCOES = [
  { valor: 'travado', rotulo: 'Travado', tom: 'vermelho' as const },
  { valor: 'em_andamento', rotulo: 'Em andamento', tom: 'azul' as const },
  { valor: 'feito', rotulo: 'Feito', tom: 'verde' as const, cor: '#123456' },
]

function Exemplo({ inicial = '', onChange = vi.fn() }: { inicial?: string; onChange?: (valor: string) => void }) {
  const [valor, setValor] = useState(inicial)
  return (
    <StatusSelect
      rotulo="Status do card"
      vazio="Sem status"
      opcoes={OPCOES}
      value={valor}
      onChange={(novo) => {
        setValor(novo)
        onChange(novo)
      }}
    />
  )
}

describe('StatusSelect', () => {
  it('mostra a opção atual com a cor dela, ou o texto de vazio', () => {
    render(<Exemplo inicial="feito" />)
    const campo = screen.getByLabelText('Status do card')
    expect(campo).toHaveTextContent('Feito')
    expect(campo).toHaveAttribute('data-valor', 'feito')
    expect(campo.querySelector('[data-cor]')).toHaveStyle({ background: '#123456' })
  })

  it('abre a lista, marca a escolhida e troca ao clicar', () => {
    const onChange = vi.fn()
    render(<Exemplo inicial="travado" onChange={onChange} />)
    fireEvent.click(screen.getByLabelText('Status do card'))
    const lista = within(screen.getByRole('listbox', { name: 'Status do card' }))
    expect(lista.getAllByRole('option').map((o) => o.textContent)).toEqual(['Sem status', 'Travado', 'Em andamento', 'Feito'])
    expect(lista.getByRole('option', { name: 'Travado' })).toHaveAttribute('aria-selected', 'true')

    fireEvent.click(lista.getByRole('option', { name: 'Em andamento' }))
    expect(onChange).toHaveBeenCalledWith('em_andamento')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Status do card')).toHaveTextContent('Em andamento')
  })

  it('escolhe pelo teclado', () => {
    const onChange = vi.fn()
    render(<Exemplo inicial="travado" onChange={onChange} />)
    fireEvent.keyDown(screen.getByLabelText('Status do card'), { key: 'ArrowDown' })
    const lista = screen.getByRole('listbox')
    fireEvent.keyDown(lista, { key: 'ArrowDown' })
    fireEvent.keyDown(lista, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith('em_andamento')
  })

  it('fecha ao clicar fora sem trocar', () => {
    const onChange = vi.fn()
    render(<Exemplo onChange={onChange} />)
    fireEvent.click(screen.getByLabelText('Status do card'))
    fireEvent.mouseDown(document.body)
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('dentro de um modal, Escape fecha só a lista', () => {
    const onFechar = vi.fn()
    render(
      <Modal aberto titulo="Editar" onFechar={onFechar}>
        <Exemplo />
      </Modal>,
    )
    fireEvent.click(screen.getByLabelText('Status do card'))
    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' })
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(onFechar).not.toHaveBeenCalled()
  })

  it('o helper dos testes escolhe pelo valor', () => {
    const onChange = vi.fn()
    render(<Exemplo onChange={onChange} />)
    escolher(screen.getByLabelText('Status do card'), 'feito')
    expect(onChange).toHaveBeenCalledWith('feito')
  })
})
