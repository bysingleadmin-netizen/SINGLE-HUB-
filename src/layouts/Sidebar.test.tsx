import { fireEvent, render, screen } from '@testing-library/react'
import type { Session } from '@supabase/supabase-js'
import { MemoryRouter } from 'react-router-dom'
import { AuthContext } from '@/features/auth/AuthContext'
import type { AuthValor } from '@/features/auth/AuthContext'
import type { Cargo } from '@/lib/permissoes'
import { Sidebar } from './Sidebar'
import type { AvisosDoMenu } from './navegacao'

function montar(cargo: Cargo, colapsada = false, avisos?: AvisosDoMenu) {
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
          avisos={avisos}
        />
      </MemoryRouter>
    </AuthContext.Provider>,
  )
  return { valor, onAlternar }
}

describe('Sidebar', () => {
  it('não mostra Financeiro para Colaborador e mostra nome e cargo no rodapé', () => {
    montar('Colaborador')
    expect(screen.queryByRole('link', { name: 'Financeiro' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Demandas' })).toBeInTheDocument()
    expect(screen.getByText('Luan Uliana')).toBeInTheDocument()
    expect(screen.getByText('Colaborador')).toBeInTheDocument()
  })

  it('mostra Financeiro para a Liderança', () => {
    montar('Liderança')
    expect(screen.getByRole('link', { name: 'Financeiro' })).toHaveAttribute(
      'href',
      '/app/financeiro',
    )
  })

  it('mostra o logotipo vetorial da marca', () => {
    montar('Colaborador')
    expect(screen.getByRole('img', { name: 'SINGLE' }).querySelector('svg')).not.toBeNull()
  })

  it('marca a rota atual', () => {
    montar('Colaborador')
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page')
  })

  it('alterna entre recolher e expandir', () => {
    const { onAlternar } = montar('Colaborador')
    fireEvent.click(screen.getByRole('button', { name: 'Recolher menu' }))
    expect(onAlternar).toHaveBeenCalledTimes(1)
  })

  it('mantém os links acessíveis pelo nome quando colapsada', () => {
    montar('Colaborador', true)
    expect(screen.getByRole('link', { name: 'Calendário' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Expandir menu' })).toBeInTheDocument()
  })

  it('mostra a contagem de pendências só nos itens que têm', () => {
    montar('Colaborador', false, {
      '/app/demandas': { total: 3, descricao: '3 demandas atrasadas' },
    })
    expect(screen.getByRole('link', { name: /^Demandas\s*3 demandas atrasadas$/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Conteúdo' })).toBeInTheDocument()
  })

  it('esconde do colaborador o que não é dele', () => {
    montar('Colaborador')
    for (const nome of ['Clientes', 'CRM', 'Anúncios', 'Financeiro', 'Configurações']) {
      expect(screen.queryByRole('link', { name: nome })).not.toBeInTheDocument()
    }
  })

  it('o nome da seção Produção é texto, não link nem botão', () => {
    montar('Liderança')
    const grupo = screen.getByText('Produção')
    expect(grupo.closest('a, button')).toBeNull()
  })

  it('a foto e o nome levam ao próprio perfil, com o cargo atual', () => {
    montar('Colaborador')
    expect(screen.getByRole('link', { name: 'Meu perfil: Luan Uliana' })).toHaveAttribute('href', '/app/configuracoes')
  })

  it('sai ao clicar em Sair', () => {
    const { valor } = montar('Colaborador')
    fireEvent.click(screen.getByRole('button', { name: 'Sair' }))
    expect(valor.sair).toHaveBeenCalledTimes(1)
  })
})
