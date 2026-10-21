import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/AuthContext'
import { itemParaSalvar } from '@/features/aprovacao/aprovacao'
import type { ItemDoForm } from '@/features/aprovacao/aprovacao'
import { supabase } from '@/lib/supabase'
import type { Aprovacao, ContentCard } from '@/types/database'
import { enviarImagem } from './arquivos'
import { useLista } from './base'
import { useColunasOpcionais } from './esquema'

// Pedidos de aprovação dos cards de Conteúdo (migration 0013). Sem a tabela, o card não
// mostra a seção de aprovação.

export function useAprovacoes() {
  const esquema = useColunasOpcionais()
  const consulta = useLista<Aprovacao>('aprovacoes', { ativo: esquema.aprovacoes })
  return { ...consulta, disponivel: esquema.aprovacoes }
}

/** Envia os arquivos escolhidos e devolve os itens como vão para o banco. */
function conteudoParaSalvar(cardId: string, itens: ItemDoForm[]) {
  return Promise.all(
    itens.map(async (item) =>
      item.arquivo && item.tipo !== 'copy' && item.tipo !== 'link'
        ? itemParaSalvar(item, await enviarImagem('anexos', `aprovacoes/${cardId}`, item.arquivo))
        : itemParaSalvar(item),
    ),
  )
}

/** Envia os arquivos escolhidos, grava o pedido e devolve a linha, com o token. */
export function useCriarAprovacao(card: Pick<ContentCard, 'id' | 'titulo' | 'client_id'>) {
  const { perfil } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (itens: ItemDoForm[]) => {
      const conteudo = await conteudoParaSalvar(card.id, itens)
      const { data, error } = await supabase
        .from('aprovacoes')
        .insert({
          // O banco também sorteia um, mas assim o link já sai pronto do insert
          token: crypto.randomUUID(),
          card_id: card.id,
          client_id: card.client_id,
          titulo: card.titulo,
          conteudo,
          created_by: perfil?.id ?? null,
        })
        .select()
        .single()
      if (error) throw error
      return data as Aprovacao
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['aprovacoes'] }),
  })
}

/** Troca o material de um pedido ainda sem resposta. O token não muda: o link enviado continua valendo. */
export function useEditarAprovacao(aprovacao: Pick<Aprovacao, 'id' | 'card_id'>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (itens: ItemDoForm[]) => {
      const conteudo = await conteudoParaSalvar(aprovacao.card_id, itens)
      const { error } = await supabase.from('aprovacoes').update({ conteudo }).eq('id', aprovacao.id)
      if (error) throw error
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['aprovacoes'] }),
  })
}

/** Apaga o pedido: o link enviado passa a dizer que não existe. Os arquivos ficam no Storage. */
export function useExcluirAprovacao() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('aprovacoes').delete().eq('id', id)
      if (error) throw error
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['aprovacoes'] }),
  })
}
