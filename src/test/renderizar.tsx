import type { ReactElement, ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ToastProvider } from '@/components/ui/Toast'
import { AuthContext } from '@/features/auth/AuthContext'
import type { AuthValor } from '@/features/auth/AuthContext'
import type { Cargo } from '@/lib/permissoes'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/types/database'
import type { BancoFalso, SupabaseFalso } from './supabaseFalso'

/** Só funciona em testes que trocam '@/lib/supabase' pelo Supabase falso. */
export function bancoFalso(): BancoFalso {
  return (supabase as unknown as SupabaseFalso).banco
}

export function perfilDeTeste(cargo: Cargo = 'CEO'): Profile {
  return {
    id: 'u1',
    nome: 'Luan Uliana',
    email: 'luan@single.com',
    cargo,
    avatar_url: null,
    created_at: '2026-10-01T00:00:00Z',
  }
}

interface Opcoes {
  cargo?: Cargo
  rota?: string
}

export function criarEnvolucro({ cargo = 'CEO', rota = '/' }: Opcoes = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const auth: AuthValor = {
    sessao: { user: { id: 'u1' } } as Session,
    perfil: perfilDeTeste(cargo),
    carregando: false,
    erroPerfil: false,
    sair: async () => {},
  }
  function Envolucro({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <AuthContext.Provider value={auth}>
            <MemoryRouter initialEntries={[rota]}>{children}</MemoryRouter>
          </AuthContext.Provider>
        </ToastProvider>
      </QueryClientProvider>
    )
  }
  return { Envolucro, queryClient }
}

/** Renderiza com React Query, toasts, sessão e rotas, como dentro do app. */
export function renderizar(ui: ReactElement, opcoes?: Opcoes) {
  const { Envolucro, queryClient } = criarEnvolucro(opcoes)
  return { ...render(ui, { wrapper: Envolucro }), queryClient }
}
