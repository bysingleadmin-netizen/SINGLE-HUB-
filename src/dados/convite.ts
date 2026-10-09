import { useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export const FUNCAO_NAO_PUBLICADA =
  'A função de convite ainda não foi publicada no Supabase. Veja docs/INTEGRACOES.md.'

/**
 * Convida alguém por e-mail. O convite em si é feito pela Edge Function
 * `convidar-colaborador`: ele exige a chave de serviço do Supabase, que não pode
 * ficar no navegador. A função confere se quem pede é da liderança.
 * Rejeita com uma mensagem pronta para mostrar à pessoa.
 */
export function useConvidar() {
  return useMutation({
    mutationFn: async (email: string) => {
      const { data, error } = await supabase.functions.invoke('convidar-colaborador', {
        body: { email },
      })
      if (error) {
        const status = (error as { context?: { status?: number } }).context?.status
        throw new Error(status === 404 ? FUNCAO_NAO_PUBLICADA : 'Não foi possível enviar o convite.')
      }
      const recusa = (data as { erro?: string } | null)?.erro
      if (recusa) throw new Error(recusa)
    },
  })
}
