import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/AuthContext'
import { hojeISO } from '@/lib/datas'
import { dataAposOtimizar } from '@/lib/regras'
import { supabase } from '@/lib/supabase'
import type { Campaign, CampaignHistorico, TipoDeOtimizacao } from '@/types/database'
import { useRegistrarAtividade } from './atividade'

// Histórico de otimizações das campanhas (migration 0008). Sem a tabela, a consulta devolve
// null e o painel avisa; registrar continua marcando a próxima otimização, como antes.

const TABELA_AUSENTE = new Set(['PGRST205', '42P01'])

/** Todas as otimizações, da mais recente para a mais antiga */
export function useHistoricoDeCampanhas() {
  return useQuery({
    queryKey: ['campaign_historico'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('campaign_historico')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) {
        if (TABELA_AUSENTE.has(error.code ?? '')) return null
        throw error
      }
      return (data ?? []) as CampaignHistorico[]
    },
  })
}

export interface NovaOtimizacao {
  tipo: TipoDeOtimizacao
  descricao: string
  valor_anterior: string | null
  valor_novo: string | null
}

/**
 * Registra uma otimização: entra no histórico (quando o banco tem a tabela) e a próxima
 * otimização da campanha fica para dali a dois dias.
 */
export function useRegistrarNoHistorico() {
  const queryClient = useQueryClient()
  const { perfil } = useAuth()
  const registrarAtividade = useRegistrarAtividade()
  return useMutation({
    mutationFn: async ({
      campanha,
      otimizacao,
      comHistorico,
    }: {
      campanha: Pick<Campaign, 'id' | 'nome'>
      otimizacao: NovaOtimizacao
      comHistorico: boolean
    }) => {
      if (comHistorico) {
        const { error } = await supabase
          .from('campaign_historico')
          .insert({ ...otimizacao, campaign_id: campanha.id, user_id: perfil?.id ?? null })
        if (error) throw error
      }
      const { error } = await supabase
        .from('campaigns')
        .update({ proxima_otimizacao: dataAposOtimizar(hojeISO()) })
        .eq('id', campanha.id)
      if (error) throw error
      void registrarAtividade({
        acao: 'otimizacao_registrada',
        descricao: `registrou a otimização da campanha "${campanha.nome}"`,
        entidade: 'campaigns',
        entidadeId: campanha.id,
      })
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ['campaign_historico'] })
      await queryClient.invalidateQueries({ queryKey: ['campaigns'] })
    },
  })
}
