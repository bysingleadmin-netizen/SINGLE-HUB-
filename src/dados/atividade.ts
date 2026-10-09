import { useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/features/auth/AuthContext'
import { supabase } from '@/lib/supabase'
import type { ActivityLog } from '@/types/database'

export type AcaoAtividade =
  | 'cliente_criado'
  | 'demanda_criada'
  | 'demanda_editada'
  | 'demanda_movida'
  | 'demanda_concluida'
  | 'conteudo_criado'
  | 'conteudo_editado'
  | 'conteudo_movido'
  | 'conteudo_publicado'
  | 'campanha_criada'
  | 'tarefa_de_anuncio_criada'
  | 'tarefa_de_anuncio_editada'
  | 'tarefa_de_anuncio_concluida'
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

export const FALHA_NO_REGISTRO = 'A ação foi salva, mas não entrou no registro de atividade.'

/**
 * Devolve uma função que grava no activity_log. Falhar aqui nunca interrompe a ação principal,
 * mas a pessoa é avisada: o Supabase devolve o erro em vez de lançar, e antes ele passava em
 * silêncio, o que escondia qualquer registro perdido (em qualquer aparelho).
 */
export function useRegistrarAtividade() {
  const { perfil } = useAuth()
  const queryClient = useQueryClient()
  const toast = useToast()
  const userId = perfil?.id

  return useCallback(
    async ({ acao, descricao, entidade, entidadeId }: Registro) => {
      if (!userId) return
      try {
        const { error } = await supabase.from('activity_log').insert({
          user_id: userId,
          acao,
          descricao,
          entidade,
          entidade_id: entidadeId,
        })
        if (error) throw error
        await queryClient.invalidateQueries({ queryKey: ['activity_log'] })
      } catch {
        toast.erro(FALHA_NO_REGISTRO)
      }
    },
    [userId, queryClient, toast],
  )
}
