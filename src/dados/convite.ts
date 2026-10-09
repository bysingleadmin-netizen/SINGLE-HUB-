import { useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export const FUNCAO_NAO_PUBLICADA =
  'A função de convite ainda não foi publicada no Supabase. Veja docs/INTEGRACOES.md.'

// Sem resposta nenhuma: o navegador não chegou à função. O caso mais comum é ela não existir
// neste projeto (ou ter sido publicada com outro nome), quando o Supabase responde sem CORS.
export const FUNCAO_INALCANCAVEL =
  'Não foi possível chegar à função de convite. Confira no Supabase se existe uma Edge Function chamada convidar-colaborador neste projeto. Veja docs/INTEGRACOES.md.'

interface Recusa {
  erro?: string
  detalhe?: string
}

/** O erro de uma Edge Function traz a resposta HTTP em `context`; daí saem o status e o motivo. */
async function lerFalha(error: unknown): Promise<{ status?: number; corpo: Recusa | null }> {
  const contexto = (error as { context?: { status?: number; json?: () => Promise<unknown> } }).context
  let corpo: Recusa | null = null
  if (typeof contexto?.json === 'function') {
    try {
      corpo = (await contexto.json()) as Recusa
    } catch {
      // resposta sem JSON: fica só o status
    }
  }
  return { status: contexto?.status, corpo }
}

/**
 * Convida alguém por e-mail. O convite em si é feito pela Edge Function
 * `convidar-colaborador`: ele exige a chave de serviço do Supabase, que não pode
 * ficar no navegador. A função confere se quem pede é da liderança.
 * Rejeita com uma mensagem pronta para mostrar à pessoa, sempre com o motivo que a função deu.
 */
export function useConvidar() {
  return useMutation({
    mutationFn: async (email: string) => {
      const { data, error } = await supabase.functions.invoke('convidar-colaborador', {
        body: { email },
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
