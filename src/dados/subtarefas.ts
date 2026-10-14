import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { CardSubtarefa, QuadroId } from '@/types/database'

// Subtarefas dos cards (tabela `card_subtarefas`, migration 0003): uma caixa de marcar e um
// texto. Não têm fluxo de aprovação nem mexem no status do card; concluir todas só acende um
// indicador. Criar, marcar e remover usam os hooks genéricos de src/dados/base.ts.

// Códigos da API e do Postgres para "tabela não existe"
const TABELA_AUSENTE = new Set(['PGRST205', '42P01'])

export interface ResumoDeSubtarefas {
  total: number
  feitas: number
  /** Há subtarefas e todas estão marcadas */
  completo: boolean
}

export function resumir(subtarefas: Pick<CardSubtarefa, 'concluida'>[]): ResumoDeSubtarefas {
  const feitas = subtarefas.filter((s) => s.concluida).length
  return { total: subtarefas.length, feitas, completo: subtarefas.length > 0 && feitas === subtarefas.length }
}

export function useSubtarefas(quadro: QuadroId) {
  const consulta = useQuery({
    // Mesma chave dos hooks genéricos, para as gravações atualizarem esta lista
    queryKey: ['card_subtarefas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('card_subtarefas')
        .select('*')
        .order('posicao', { ascending: true })
      if (error) {
        if (TABELA_AUSENTE.has(error.code ?? '')) return null
        throw error
      }
      return (data ?? []) as CardSubtarefa[]
    },
  })
  const porCard = new Map<string, CardSubtarefa[]>()
  for (const subtarefa of consulta.data ?? []) {
    if (subtarefa.quadro !== quadro) continue
    porCard.set(subtarefa.card_id, [...(porCard.get(subtarefa.card_id) ?? []), subtarefa])
  }
  return { porCard, disponivel: consulta.data != null }
}
