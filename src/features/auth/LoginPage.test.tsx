const signInWithPassword = vi.fn()

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { signInWithPassword: (...args: unknown[]) => signInWithPassword(...args) } },
}))

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { lembrarConta } from '@/lib/sessao'
import { AuthContext } from './AuthContext'
import type { AuthValor } from './AuthContext'
import { LoginPage } from './LoginPage'

function montar() {
  const valor: AuthValor = {
    sessao: null,
    perfil: null,
    carregando: false,
    erroPerfil: false,
    sair: vi.fn(),
  }
  render(
    <AuthContext.Provider value={valor}>
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

function entrar() {
  fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'luan@single.com' } })
  fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'segredo1' } })
  fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  signInWithPassword.mockReset().mockResolvedValue({ error: null })
})

describe('Lembrar minha conta', () => {
  it('vem desmarcado e, assim, a sessão não sobrevive ao fechar o navegador', async () => {
    montar()
    expect(screen.getByLabelText('Lembrar minha conta')).not.toBeChecked()
    entrar()
    await waitFor(() => expect(signInWithPassword).toHaveBeenCalled())
    expect(lembrarConta()).toBe(false)
  })

  it('marcado, grava a preferência antes de entrar', async () => {
    montar()
    fireEvent.click(screen.getByLabelText('Lembrar minha conta'))
    signInWithPassword.mockImplementation(async () => {
      // No momento de entrar, a sessão nova já vai para o lugar certo
      expect(lembrarConta()).toBe(true)
      return { error: null }
    })
    entrar()
    await waitFor(() => expect(signInWithPassword).toHaveBeenCalled())
  })

  it('a próxima abertura da tela lembra a escolha', () => {
    localStorage.setItem('single:lembrar-conta', '1')
    montar()
    expect(screen.getByLabelText('Lembrar minha conta')).toBeChecked()
  })
})
