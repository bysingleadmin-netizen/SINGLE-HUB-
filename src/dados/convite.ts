import { useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export const FUNCAO_NAO_PUBLICADA =
  'A função de convite ainda não foi publicada no Supabase. Veja docs/INTEGRACOES.md.'

export const FUNCAO_INALCANCAVEL =
  'Não foi possível chegar à função de convite. Confira no Supabase se existe uma Edge Function chamada convidar-colaborador neste projeto. Veja docs/INTEGRACOES.md.'

interface Recusa {
  erro?: string
  detalhe?: string
}

async function lerFalha(error: unknown): Promise<{ status?: number; corpo: Recusa | null }> {
  const contexto = (error as { context?: { status?: number; json?: () => Promise<unknown> } }).context
  let corpo: Recusa | null = null
  if (typeof contexto?.json === 'function') {
    try {
      corpo = (await contexto.json()) as Recusa
    } catch {
      // resposta sem JSON
    }
  }
  return { status: contexto?.status, corpo }
}

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