import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { lerFalha } from './funcoes'
import type { Recusa } from './funcoes'

export const FUNCAO_NAO_PUBLICADA =
  'A função de convite ainda não foi publicada no Supabase. Veja docs/INTEGRACOES.md.'

export const FUNCAO_INALCANCAVEL =
  'Não foi possível chegar à função de convite. Confira no Supabase se existe uma Edge Function chamada convidar-colaborador neste projeto. Veja docs/INTEGRACOES.md.'

interface ConviteParams {
  email: string
  nome?: string
  cargo: string
}

export function useConvidar() {
  return useMutation({
    mutationFn: async ({ email, nome, cargo }: ConviteParams) => {
      const { data, error } = await supabase.functions.invoke('convidar-colaborador', {
        body: { email, nome, cargo },
      })
      if (error) {
        const { status, corpo } = await lerFalha(error)
        if (status === 404) throw new Error(FUNCAO_NAO_PUBLICADA)
        if (corpo?.erro) throw new Error(corpo.erro)
        if (status == null) throw new Error(FUNCAO_INALCANCAVEL)
        throw new Error(`Não foi possível enviar o convite (a função respondeu com erro ${status}).`)
      }
      const recusa = (data as Recusa | null)?.erro
      if (recusa) throw new Error(recusa)
    },
  })
}

export const REMOCAO_NAO_PUBLICADA =
  'A função de remoção ainda não foi publicada no Supabase. Veja docs/INTEGRACOES.md.'

/**
 * Tira a pessoa da equipe: a conta é apagada no Supabase (com ela, o perfil), as demandas dela
 * ficam sem responsável e ela recebe um e-mail avisando que o acesso foi revogado.
 */
export function useRemoverColaborador() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.functions.invoke('remover-colaborador', { body: { id } })
      if (error) {
        const { status, corpo } = await lerFalha(error)
        if (status === 404) throw new Error(REMOCAO_NAO_PUBLICADA)
        if (corpo?.erro) throw new Error(corpo.erro)
        throw new Error(`Não foi possível remover o colaborador${status ? ` (a função respondeu com erro ${status})` : ''}.`)
      }
      const resposta = data as (Recusa & { emailEnviado?: boolean }) | null
      if (resposta?.erro) throw new Error(resposta.erro)
      return { emailEnviado: resposta?.emailEnviado !== false }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['profiles'] }),
  })
}
