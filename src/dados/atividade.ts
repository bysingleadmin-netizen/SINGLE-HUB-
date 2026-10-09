import { useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/AuthContext'
import { supabase } from '@/lib/supabase'
import type { ActivityLog } from '@/types/database'

export type AcaoAtividade =
  | 'cliente_criado'
  | 'demanda_criada'
  | 'demanda_movida'
  | 'conteudo_criado'
  | 'conteudo_movido'
  | 'conteudo_publicado'
  | 'campanha_criada'
  | 'otimizacao_registrada'

export interface Registro {
  acao: AcaoAtividade
  descricao: string
  entidade: string
  entidadeId: string
}

export function useAtividadeRecente(limite = 10) {
  return useQuery({
    queryKey: ['activity_log', limite],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activity_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limite)
      if (error) throw error
      return (data ?? []) as ActivityLog[]
    },
  })
}

/** Devolve uma função que grava no activity_log. Falhar aqui nunca interrompe a ação principal. */
export function useRegistrarAtividade() {
  const { perfil } = useAuth()
  const queryClient = useQueryClient()
  const userId = perfil?.id

  return useCallback(
    async ({ acao, descricao, entidade, entidadeId }: Registro) => {
      if (!userId) return
      try {
        await supabase.from('activity_log').insert({
          user_id: userId,
          acao,
          descricao,
          entidade,
          entidade_id: entidadeId,
        })
        await queryClient.invalidateQueries({ queryKey: ['activity_log'] })
      } catch {
        // registro de atividade é acessório
      }
    },
    [userId, queryClient],
  )
}
