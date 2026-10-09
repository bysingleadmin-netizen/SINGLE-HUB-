import { useCallback, useEffect, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/features/auth/AuthContext'
import { hojeISO, somarDias } from '@/lib/datas'
import { tarefaAberta } from '@/lib/regras'
import { supabase } from '@/lib/supabase'
import type { Notificacao, TipoNotificacao, Task } from '@/types/database'
import { useTarefas } from './tabelas'

const LIMITE = 20

export interface Aviso {
  tipo: TipoNotificacao
  titulo: string
  mensagem: string
  /** Rota do app para onde a notificação leva */
  link: string
}

/** As 20 notificações mais recentes de quem está logado. */
export function useNotificacoes() {
  const { perfil } = useAuth()
  const userId = perfil?.id
  return useQuery({
    queryKey: ['notifications', userId],
    enabled: Boolean(userId),
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId as string)
        .order('created_at', { ascending: false })
        .limit(LIMITE)
      if (error) throw error
      return (data ?? []) as Notificacao[]
    },
  })
}

export function useMarcarComoLida() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('notifications').update({ lida: true }).eq('id', id)
      if (error) throw error
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })
}

/**
 * Devolve uma função que avisa outras pessoas. Quem dispara a ação não recebe o próprio aviso.
 * Falhar aqui nunca interrompe a ação principal.
 */
export function useNotificar() {
  const { perfil } = useAuth()
  const queryClient = useQueryClient()
  const toast = useToast()
  const userId = perfil?.id

  return useCallback(
    async (destinatarios: (string | null | undefined)[], aviso: Aviso) => {
      const ids = [...new Set(destinatarios)].filter((id): id is string => !!id && id !== userId)
      if (ids.length === 0) return
      try {
        // O Supabase devolve o erro em vez de lançar; sem conferir, o aviso perdido passava em silêncio
        const { error } = await supabase
          .from('notifications')
          .insert(ids.map((user_id) => ({ user_id, lida: false, ...aviso })))
        if (error) throw error
        await queryClient.invalidateQueries({ queryKey: ['notifications'] })
      } catch {
        toast.erro('A ação foi salva, mas o aviso não chegou a quem foi atribuído.')
      }
    },
    [userId, queryClient, toast],
  )
}

export function tarefasComPrazoAmanha(tarefas: Task[], userId: string, hoje: string): Task[] {
  const amanha = somarDias(hoje, 1)
  return tarefas.filter(
    (t) => tarefaAberta(t) && t.responsavel_id === userId && t.data_entrega === amanha,
  )
}

/** A data faz parte do link: é ela que impede avisar duas vezes sobre o mesmo prazo. */
export function linkDoPrazo(tarefa: Pick<Task, 'id' | 'data_entrega'>): string {
  return `/app/demandas?abrir=${tarefa.id}&prazo=${tarefa.data_entrega}`
}

/**
 * Ao abrir o app, avisa a pessoa logada das próprias demandas que vencem amanhã.
 * Roda uma vez por abertura e pula os prazos que já foram avisados.
 */
export function useAvisarPrazosDeAmanha() {
  const { perfil } = useAuth()
  const tarefas = useTarefas()
  const queryClient = useQueryClient()
  const conferido = useRef(false)
  const userId = perfil?.id
  const lista = tarefas.data

  useEffect(() => {
    if (!userId || !lista || conferido.current) return
    conferido.current = true

    const vencendo = tarefasComPrazoAmanha(lista, userId, hojeISO())
    if (vencendo.length === 0) return

    void (async () => {
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('link')
          .eq('user_id', userId)
          .eq('tipo', 'prazo')
        if (error) return
        const avisados = new Set((data as { link: string | null }[]).map((n) => n.link))
        const novos = vencendo
          .filter((tarefa) => !avisados.has(linkDoPrazo(tarefa)))
          .map((tarefa) => ({
            user_id: userId,
            tipo: 'prazo',
            titulo: 'Entrega amanhã',
            mensagem: `A demanda "${tarefa.titulo}" vence amanhã.`,
            link: linkDoPrazo(tarefa),
            lida: false,
          }))
        if (novos.length === 0) return
        await supabase.from('notifications').insert(novos)
        await queryClient.invalidateQueries({ queryKey: ['notifications'] })
      } catch {
        // Roda sozinho ao abrir o app, sem ninguém ter pedido nada: um aviso de erro aqui só
        // confundiria. Se falhar, a conferência se repete na próxima abertura.
      }
    })()
  }, [userId, lista, queryClient])
}
