import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/types/database'
import { AuthContext } from './AuthContext'
import type { AuthValor } from './AuthContext'

async function buscarPerfil(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
  if (error) throw error
  return data as Profile | null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [sessao, setSessao] = useState<Session | null>(null)
  const [iniciando, setIniciando] = useState(true)

  useEffect(() => {
    let ativo = true
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (ativo) setSessao(data.session)
      })
      .finally(() => {
        if (ativo) setIniciando(false)
      })

    const { data } = supabase.auth.onAuthStateChange((_evento, novaSessao) => {
      setSessao(novaSessao)
    })

    return () => {
      ativo = false
      data.subscription.unsubscribe()
    }
  }, [])

  const userId = sessao?.user.id

  const perfilQuery = useQuery({
    queryKey: ['perfil', userId],
    queryFn: () => buscarPerfil(userId as string),
    enabled: Boolean(userId),
    staleTime: 5 * 60_000,
  })

  const sair = useCallback(async () => {
    await supabase.auth.signOut()
    queryClient.clear()
  }, [queryClient])

  const valor = useMemo<AuthValor>(
    () => ({
      sessao,
      perfil: perfilQuery.data ?? null,
      carregando: iniciando || (Boolean(userId) && perfilQuery.isPending),
      erroPerfil: perfilQuery.isError,
      sair,
    }),
    [sessao, perfilQuery.data, perfilQuery.isPending, perfilQuery.isError, iniciando, userId, sair],
  )

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>
}
