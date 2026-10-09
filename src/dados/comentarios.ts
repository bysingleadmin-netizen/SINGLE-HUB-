import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { TaskComment } from '@/types/database'

/**
 * Comentários das demandas (tabela `task_comments`, criada direto no painel do Supabase).
 * Se a leitura falhar (tabela sem permissão, por exemplo), `disponivel` vem false e as telas
 * simplesmente não mostram comentários, sem erro.
 */
export function useComentarios() {
  const consulta = useQuery({
    queryKey: ['task_comments'],
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_comments')
        .select('*')
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as TaskComment[]
    },
  })
  const lista = consulta.data ?? []
  const porTarefa = new Map<string, TaskComment[]>()
  for (const comentario of lista) {
    porTarefa.set(comentario.task_id, [...(porTarefa.get(comentario.task_id) ?? []), comentario])
  }
  return { porTarefa, disponivel: consulta.isSuccess }
}

export function useComentar() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (novo: Pick<TaskComment, 'task_id' | 'author_id' | 'conteudo'>) => {
      const { error } = await supabase.from('task_comments').insert(novo)
      if (error) throw error
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['task_comments'] }),
  })
}
