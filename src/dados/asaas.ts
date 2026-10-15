import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/AuthContext'
import { isLideranca } from '@/lib/permissoes'
import { supabase } from '@/lib/supabase'
import type { ReceitaAsaas } from '@/types/database'
import { lerFalha } from './funcoes'
import type { Recusa } from './funcoes'

// Cobranças do Asaas, gravadas pelas Edge Functions asaas-webhook (cada evento) e asaas-sync
// (todas as que já existem). Só a liderança lê (RLS).
// Sem a tabela (migration 0006 não rodada), a consulta devolve null e a tela avisa.

const TABELA_AUSENTE = new Set(['PGRST205', '42P01'])

export function useReceitasAsaas() {
  const { perfil } = useAuth()
  return useQuery({
    queryKey: ['receitas_asaas'],
    enabled: isLideranca(perfil?.cargo),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('receitas_asaas')
        .select('*')
        .order('data_vencimento', { ascending: false })
      if (error) {
        if (TABELA_AUSENTE.has(error.code ?? '')) return null
        throw error
      }
      return (data ?? []) as ReceitaAsaas[]
    },
  })
}

/** O id do Asaas já está ligado a outro cliente (índice único em clients.asaas_customer_id) */
export class AsaasJaVinculado extends Error {}

/**
 * Liga a cobrança a um cliente daqui. Com o id do cliente do Asaas, ele fica gravado no cliente
 * e todas as cobranças desse cliente do Asaas são vinculadas, inclusive as que ainda vierem.
 */
export function useVincularAsaas() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ receita, clienteId }: { receita: ReceitaAsaas; clienteId: string }) => {
      const vinculo = { cliente_id: clienteId, vinculado: true }
      if (!receita.asaas_customer_id) {
        const { error } = await supabase.from('receitas_asaas').update(vinculo).eq('id', receita.id)
        if (error) throw error
        return
      }
      const { error: erroCliente } = await supabase
        .from('clients')
        .update({ asaas_customer_id: receita.asaas_customer_id })
        .eq('id', clienteId)
      if (erroCliente) {
        if (erroCliente.code === '23505') throw new AsaasJaVinculado()
        throw erroCliente
      }
      const { error } = await supabase
        .from('receitas_asaas')
        .update(vinculo)
        .eq('asaas_customer_id', receita.asaas_customer_id)
      if (error) throw error
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ['receitas_asaas'] })
      await queryClient.invalidateQueries({ queryKey: ['clients'] })
    },
  })
}

export interface ResultadoDaSincronizacao {
  cobrancas: number
  vinculadas: number
  semVinculo: number
}

/** Traz do Asaas todas as cobranças que já existem (Edge Function asaas-sync). */
export function useSincronizarAsaas() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (): Promise<ResultadoDaSincronizacao> => {
      const { data, error } = await supabase.functions.invoke('asaas-sync', { body: {} })
      if (error) {
        const { status, corpo } = await lerFalha(error)
        if (status === 404) {
          throw new Error('A função asaas-sync ainda não foi publicada no Supabase. Veja docs/INTEGRACOES.md.')
        }
        if (corpo?.erro) throw new Error(corpo.erro)
        throw new Error(
          status == null
            ? 'Não foi possível chegar à função asaas-sync. Veja docs/INTEGRACOES.md.'
            : `A sincronização falhou (a função respondeu com erro ${status}).`,
        )
      }
      const resposta = data as (Recusa & Partial<ResultadoDaSincronizacao>) | null
      if (resposta?.erro) throw new Error(resposta.erro)
      return {
        cobrancas: resposta?.cobrancas ?? 0,
        vinculadas: resposta?.vinculadas ?? 0,
        semVinculo: resposta?.semVinculo ?? 0,
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ['receitas_asaas'] })
      await queryClient.invalidateQueries({ queryKey: ['clients'] })
    },
  })
}
