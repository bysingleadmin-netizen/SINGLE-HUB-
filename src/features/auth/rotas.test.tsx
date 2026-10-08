import { StrictMode } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import type { Session } from '@supabase/supabase-js'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ToastProvider } from '@/components/ui/Toast'
import type { Cargo } from '@/lib/permissoes'
import type { Profile } from '@/types/database'
import { AuthContext } from './AuthContext'
import type { AuthValor } from './AuthContext'
import { RotaLideranca } from './RotaLideranca'
import { RotaProtegida } from './RotaProtegida'

const sessao = { user: { id: 'u1' } } as Session

function perfil(cargo: Cargo): Profile {
  return {
    id: 'u1',
    nome: 'Luan Uliana',
    email: 'luan@single.com',
    cargo,
    avatar_url: null,
    created_at: '2026-10-08T00:00:00Z',
  }
}

function montar(rota: string, parcial: Partial<AuthValor>) {
  const valor: AuthValor = {
    sessao: null,
    perfil: null,
    carregando: false,
    erroPerfil: false,
    sair: vi.fn().mockResolvedValue(undefined),
    ...parcial,
  }
  render(
    <StrictMode>
      <AuthContext.Provider value={valor}>
        <ToastProvider>
          <MemoryRouter initialEntries={[rota]}>
            <Routes>
              <Route path="/login" element={<p>tela de login</p>} />
              <Route element={<RotaProtegida />}>
                <Route path="/app/dashboard" element={<p>tela dashboard</p>} />
                <Route element={<RotaLideranca />}>
                  <Route path="/app/financeiro" element={<p>tela financeiro</p>} />
                </Route>
              </Route>
            </Routes>
          </MemoryRouter>
        </ToastProvider>
      </AuthContext.Provider>
    </StrictMode>,
  )
  return valor
}

describe('RotaProtegida', () => {
  it('manda para o login quem não tem sessão', () => {
    montar('/app/dashboard', {})
    expect(screen.getByText('tela de login')).toBeInTheDocument()
  })

  it('não mostra login nem conteúdo enquanto carrega', () => {
    montar('/app/dashboard', { carregando: true })
    expect(screen.queryByText('tela de login')).not.toBeInTheDocument()
    expect(screen.queryByText('tela dashboard')).not.toBeInTheDocument()
  })

  it('mostra o conteúdo para quem tem sessão e perfil', () => {
    montar('/app/dashboard', { sessao, perfil: perfil('Designer') })
    expect(screen.getByText('tela dashboard')).toBeInTheDocument()
  })

  it('avisa e deixa sair quando a sessão não tem perfil', () => {
    const valor = montar('/app/dashboard', { sessao, perfil: null })
    expect(screen.getByText('Não encontramos seu perfil')).toBeInTheDocument()
    expect(screen.queryByText('tela dashboard')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Sair' }))
    expect(valor.sair).toHaveBeenCalledTimes(1)
  })

  it('avisa quando a busca do perfil falha', () => {
    montar('/app/dashboard', { sessao, perfil: null, erroPerfil: true })
    expect(screen.getByText('Não encontramos seu perfil')).toBeInTheDocument()
  })
})

describe('RotaLideranca', () => {
  it('redireciona quem não é liderança com um único toast', () => {
    montar('/app/financeiro', { sessao, perfil: perfil('Designer') })
    expect(screen.getByText('tela dashboard')).toBeInTheDocument()
    expect(screen.queryByText('tela financeiro')).not.toBeInTheDocument()

    const avisos = screen.getAllByRole('status')
    expect(avisos).toHaveLength(1)
    expect(avisos[0]).toHaveTextContent('Acesso não autorizado.')
  })

  it.each(['CEO', 'Founder', 'Co-Founder'] as const)('libera o financeiro para %s', (cargo) => {
    montar('/app/financeiro', { sessao, perfil: perfil(cargo) })
    expect(screen.getByText('tela financeiro')).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
