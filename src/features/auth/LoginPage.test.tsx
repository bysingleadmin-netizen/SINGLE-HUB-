const signInWithPassword = vi.fn()
const invoke = vi.fn()
const signUp = vi.fn()

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: (...args: unknown[]) => signInWithPassword(...args),
      signUp: (...args: unknown[]) => signUp(...args),
    },
    functions: { invoke: (...args: unknown[]) => invoke(...args) },
  },
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
  invoke.mockReset().mockResolvedValue({ data: { ok: true }, error: null })
  signUp.mockReset()
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

describe('Criar conta', () => {
  function cadastrar(senhaConfirm = 'segredo1') {
    montar()
    fireEvent.click(screen.getByRole('button', { name: 'Primeiro acesso? Criar conta' }))
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: ' Ana@Single.com ' } })
    fireEvent.change(screen.getByLabelText('Código de convite'), { target: { value: 'abc234' } })
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'segredo1' } })
    fireEvent.change(screen.getByLabelText('Confirmar senha'), { target: { value: senhaConfirm } })
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }))
  }

  it('o servidor confere o código e cria a conta; depois entra com a senha', async () => {
    cadastrar()
    await waitFor(() => expect(signInWithPassword).toHaveBeenCalledWith({ email: 'Ana@Single.com', password: 'segredo1' }))
    expect(invoke).toHaveBeenCalledWith('criar-conta', {
      body: { email: 'ana@single.com', codigo: 'ABC234', senha: 'segredo1' },
    })
    // Nunca pede ao Supabase para criar conta direto do navegador
    expect(signUp).not.toHaveBeenCalled()
  })

  it('mostra a recusa do servidor e não entra', async () => {
    invoke.mockResolvedValue({ data: { erro: 'Código inválido ou expirado. Peça um novo convite à liderança.' }, error: null })
    cadastrar()
    expect(await screen.findByRole('alert')).toHaveTextContent('Código inválido ou expirado')
    expect(signInWithPassword).not.toHaveBeenCalled()
  })

  it('senhas diferentes nem chegam ao servidor', async () => {
    cadastrar('outra123')
    expect(await screen.findByRole('alert')).toHaveTextContent('As senhas não coincidem.')
    expect(invoke).not.toHaveBeenCalled()
  })
})
