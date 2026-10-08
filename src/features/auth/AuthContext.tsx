import { createContext, useContext } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { Profile } from '@/types/database'

export interface AuthValor {
  sessao: Session | null
  perfil: Profile | null
  /** Sessão ou perfil ainda sendo lidos */
  carregando: boolean
  erroPerfil: boolean
  sair: () => Promise<void>
}

// Separado do AuthProvider para que guardas e layout não dependam do cliente Supabase.
export const AuthContext = createContext<AuthValor | null>(null)

export function useAuth(): AuthValor {
  const valor = useContext(AuthContext)
  if (!valor) throw new Error('useAuth precisa estar dentro de <AuthProvider>')
  return valor
}
