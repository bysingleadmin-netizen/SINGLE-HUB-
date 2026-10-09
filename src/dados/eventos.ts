import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/AuthContext'
import { supabase } from '@/lib/supabase'
import type { CalendarEvent, EventParticipant } from '@/types/database'
import { useLista } from './base'
import type { Valores } from './base'

export const useEventos = () => useLista<CalendarEvent>('calendar_events')

// event_participants não tem created_at, então não há por onde ordenar
export const useParticipantes = () =>
  useLista<EventParticipant>('event_participants', { ordenarPor: null })

interface NovoEvento {
  valores: Valores<CalendarEvent>
  /** ids de perfis */
  participantes: string[]
}

/**
 * Cria o evento e, em seguida, os participantes.
 * Se só os participantes falharem, o evento fica salvo e `participantesSalvos` vem false.
 */
export function useCriarEvento() {
  const { perfil } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ valores, participantes }: NovoEvento) => {
      const { data, error } = await supabase
        .from('calendar_events')
        .insert({ ...valores, created_by: perfil?.id ?? null })
        .select()
        .single()
      if (error) throw error
      const evento = data as CalendarEvent

      let participantesSalvos = true
      if (participantes.length > 0) {
        const resposta = await supabase
          .from('event_participants')
          .insert(participantes.map((profile_id) => ({ event_id: evento.id, profile_id })))
        participantesSalvos = !resposta.error
      }
      return { evento, participantesSalvos }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['calendar_events'] })
      void queryClient.invalidateQueries({ queryKey: ['event_participants'] })
    },
  })
}
