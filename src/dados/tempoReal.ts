import { useEffect, useId } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Tabela } from './base'

// Atualização em tempo real: quando alguém da equipe muda uma linha destas tabelas, a lista
// em cache é recarregada. Depende de as tabelas estarem na publicação `supabase_realtime`
// (migration 0003). Sem isso o canal abre mas nada chega, e a tela segue atualizando como
// antes (ao voltar para a aba e depois de cada edição feita aqui).

export function useTempoReal(tabelas: readonly Tabela[]) {
  const queryClient = useQueryClient()
  const id = useId()
  const chave = tabelas.join(',')

  useEffect(() => {
    let canal = supabase.channel(`tempo-real:${chave}:${id}`)
    for (const tabela of chave.split(',') as Tabela[]) {
      canal = canal.on('postgres_changes', { event: '*', schema: 'public', table: tabela }, () => {
        void queryClient.invalidateQueries({ queryKey: [tabela] })
      })
    }
    canal.subscribe()
    return () => {
      void supabase.removeChannel(canal)
    }
  }, [chave, id, queryClient])
}
