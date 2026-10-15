import { fireEvent, render, screen } from '@testing-library/react'
import { MenuAcoes } from './MenuDeAcoes'

describe('MenuAcoes', () => {
  it('Editar chama a edição; Excluir só depois de confirmar', () => {
    const onEditar = vi.fn()
    const onExcluir = vi.fn()
    render(<MenuAcoes nome="Adobe" onEditar={onEditar} onExcluir={onExcluir} aviso="Ela sai do DRE." />)

    fireEvent.click(screen.getByRole('button', { name: 'Ações de Adobe' }))
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['Editar', 'Excluir'])
    fireEvent.click(screen.getByRole('menuitem', { name: 'Editar' }))
    expect(onEditar).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Ações de Adobe' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Excluir' }))
    expect(screen.getByText('Excluir Adobe? Ela sai do DRE. Esta ação não pode ser desfeita.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onExcluir).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Ações de Adobe' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Excluir' }))
    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }))
    expect(onExcluir).toHaveBeenCalledTimes(1)
    expect(screen.queryByText(/não pode ser desfeita/)).not.toBeInTheDocument()
  })

  it('sem onEditar, só oferece Excluir; sem nenhuma ação, não aparece', () => {
    const { rerender } = render(<MenuAcoes nome="Adobe" onExcluir={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Ações de Adobe' }))
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['Excluir'])
    rerender(<MenuAcoes nome="Adobe" />)
    expect(screen.queryByRole('button', { name: 'Ações de Adobe' })).not.toBeInTheDocument()
  })

  it('dentro de uma linha clicável, usar o menu não abre a linha', () => {
    const abrirLinha = vi.fn()
    render(
      <div onClick={abrirLinha}>
        <MenuAcoes nome="Adobe" onEditar={vi.fn()} onExcluir={vi.fn()} />
      </div>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Ações de Adobe' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Excluir' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(abrirLinha).not.toHaveBeenCalled()
  })

  it('Escape fecha a confirmação', () => {
    render(<MenuAcoes nome="Adobe" onExcluir={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Ações de Adobe' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Excluir' }))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByText(/não pode ser desfeita/)).not.toBeInTheDocument()
  })
})
