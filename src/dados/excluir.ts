import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { QuadroId } from '@/types/database'
import type { Tabela } from './base'

interface ConfigExcluir {
  tabela: Tabela
  /** Quadro do card: as subtarefas e os anexos dele saem junto */
  quadro?: QuadroId
  /** Outras listas que mudam com a exclusão, como as tarefas de um anúncio excluído */
  recarregar?: Tabela[]
}

/**
 * Exclusão definitiva pelo id. O item some da tela na hora e volta se o banco recusar.
 * Se nenhuma linha for apagada (sem permissão, por exemplo), conta como falha.
 */
export function useExcluir<T extends { id: string }>({ tabela, quadro, recarregar = [] }: ConfigExcluir) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.from(tabela).delete().eq('id', id).select('id')
      if (error) throw error
      if (!data || data.length === 0) throw new Error('Nada foi excluído.')
      if (quadro) {
        // O que pertence ao card não tem chave estrangeira para ele: sai à parte. Se falhar, o
        // card já foi excluído e as linhas que sobrarem não aparecem em lugar nenhum.
        await supabase.from('card_subtarefas').delete().eq('quadro', quadro).eq('card_id', id)
        await supabase.from('card_attachments').delete().eq('quadro', quadro).eq('card_id', id)
      }
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: [tabela] })
      const antes = queryClient.getQueryData<T[]>([tabela])
      queryClient.setQueryData<T[]>([tabela], (atual) => atual?.filter((item) => item.id !== id))
      return { antes }
    },
    onError: (_erro, _id, contexto) => {
      if (contexto?.antes) queryClient.setQueryData([tabela], contexto.antes)
    },
    onSettled: async () => {
      const chaves: string[] = [tabela, ...recarregar, ...(quadro ? ['card_subtarefas', 'card_attachments'] : [])]
      await Promise.all(chaves.map((chave) => queryClient.invalidateQueries({ queryKey: [chave] })))
    },
  })
}
