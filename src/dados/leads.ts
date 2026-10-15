import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/AuthContext'
import type { ValoresConversao, ValoresLead } from '@/features/crm/crm'
import { supabase } from '@/lib/supabase'
import type { EtapaDoLead, Lead } from '@/types/database'

// Leads do CRM. Só a liderança lê (RLS); para os demais a consulta nem é feita.
// Sem a tabela (migration 0004 não rodada), a consulta devolve null e a tela avisa.

const TABELA_AUSENTE = new Set(['PGRST205', '42P01'])

export function useLeads({ ativo = true }: { ativo?: boolean } = {}) {
  return useQuery({
    queryKey: ['leads'],
    enabled: ativo,
    queryFn: async () => {
      const { data, error } = await supabase.from('leads').select('*').order('posicao', { ascending: true })
      if (error) {
        if (TABELA_AUSENTE.has(error.code ?? '')) return null
        throw error
      }
      return (data ?? []) as Lead[]
    },
  })
}

/** Grava a mudança de etapa no histórico. Falhar aqui não desfaz a mudança. */
export async function registrarMudancaDeEtapa(leadId: string, de: EtapaDoLead | null, para: string, userId?: string) {
  await supabase.from('lead_historico').insert({ lead_id: leadId, etapa_de: de, etapa_para: para, user_id: userId ?? null })
}

export function useSalvarLead() {
  const queryClient = useQueryClient()
  const { perfil } = useAuth()
  return useMutation({
    mutationFn: async ({ id, valores, etapa, posicao }: { id?: string; valores: ValoresLead; etapa?: EtapaDoLead; posicao?: number }) => {
      if (id) {
        const { error } = await supabase.from('leads').update(valores).eq('id', id)
        if (error) throw error
        return id
      }
      const { data, error } = await supabase
        .from('leads')
        .insert({ ...valores, etapa: etapa ?? 'leads', posicao: posicao ?? 0, created_by: perfil?.id ?? null })
        .select()
        .single()
      if (error) throw error
      const criado = data as Lead
      await registrarMudancaDeEtapa(criado.id, null, criado.etapa, perfil?.id)
      return criado.id
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['leads'] }),
  })
}

export function useRemoverLead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('leads').delete().eq('id', id)
      if (error) throw error
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['leads'] }),
  })
}

/** Converte pela função do banco, que cria o cliente e marca o lead numa transação só. */
export function useConverterLead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ lead, valores }: { lead: Lead; valores: ValoresConversao }) => {
      const { data, error } = await supabase.rpc('converter_lead', {
        p_lead_id: lead.id,
        p_nome: valores.nome,
        p_mrr: valores.mrr,
        p_meses: valores.meses,
        p_inicio: valores.inicio,
      })
      if (error) throw error
      return data as string
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ['leads'] })
      await queryClient.invalidateQueries({ queryKey: ['clients'] })
    },
  })
}
