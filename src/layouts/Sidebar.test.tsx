import { fireEvent, render, screen } from '@testing-library/react'
import type { Session } from '@supabase/supabase-js'
import { MemoryRouter } from 'react-router-dom'
import { AuthContext } from '@/features/auth/AuthContext'
import type { AuthValor } from '@/features/auth/AuthContext'
import type { Cargo } from '@/lib/permissoes'
import { Sidebar } from './Sidebar'

function montar(cargo: Cargo, colapsada = false) {
  const valor: AuthValor = {
    sessao: { user: { id: 'u1' } } as Session,
    perfil: {
      id: 'u1',
      nome: 'Luan Uliana',
      email: 'luan@single.com',
      cargo,
      avatar_url: null,
      created_at: '2026-10-08T00:00:00Z',
    },
    carregando: false,
    erroPerfil: false,
    sair: vi.fn().mockResolvedValue(undefined),
  }
  const onAlternar = vi.fn()
  render(
    <AuthContext.Provider value={valor}>
      <MemoryRouter initialEntries={['/app/dashboard']}>
        <Sidebar
          colapsada={colapsada}
          onAlternar={onAlternar}
          abertaMobile={false}
          onFecharMobile={() => {}}
        />
      </MemoryRouter>
    </AuthContext.Provider>,
  )
  return { valor, onAlternar }
}

describe('Sidebar', () => {
  it('não mostra Financeiro para Social Media e mostra nome e cargo no rodapé', () => {
    montar('Social Media')
    expect(screen.queryByRole('link', { name: 'Financeiro' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Demandas' })).toBeInTheDocument()
    expect(screen.getByText('Luan Uliana')).toBeInTheDocument()
    expect(screen.getByText('Social Media')).toBeInTheDocument()
  })

  it('mostra Financeiro para Founder', () => {
    montar('Founder')
    expect(screen.getByRole('link', { name: 'Financeiro' })).toHaveAttribute(
      'href',
      '/app/financeiro',
    )
  })

  it('marca a rota atual', () => {
    montar('Designer')
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page')
  })

  it('alterna entre recolher e expandir', () => {
    const { onAlternar } = montar('Designer')
    fireEvent.click(screen.getByRole('button', { name: 'Recolher menu' }))
    expect(onAlternar).toHaveBeenCalledTimes(1)
  })

  it('mantém os links acessíveis pelo nome quando colapsada', () => {
    montar('Designer', true)
    expect(screen.getByRole('link', { name: 'Clientes' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Expandir menu' })).toBeInTheDocument()
  })

  it('sai ao clicar em Sair', () => {
    const { valor } = montar('Designer')
    fireEvent.click(screen.getByRole('button', { name: 'Sair' }))
    expect(valor.sair).toHaveBeenCalledTimes(1)
  })
})
