import { useMutation, useQueryClient } from '@tanstack/react-query'
import { diaDeVencimento, proximoMes, vencimentoNoMes } from '@/features/clientes/cartoes'
import type { CartaoDePagamento } from '@/features/clientes/cartoes'
import { hojeISO } from '@/lib/datas'
import { supabase } from '@/lib/supabase'
import type { Client, ClientPayment, FormaDePagamento } from '@/types/database'

interface Confirmacao {
  cliente: Client
  cartao: CartaoDePagamento
  forma: FormaDePagamento
  /** Se o banco tem a coluna `forma_pagamento` (migration 0002) */
  gravarForma: boolean
  /** Pagamentos já carregados, para saber se o mês seguinte já tem linha */
  pagamentos: ClientPayment[]
}

/**
 * Confirma o pagamento de um mês e deixa pronto o cartão do mês seguinte.
 * O mês pago passa a guardar o valor e o vencimento daquele momento, e por isso
 * não muda quando o cadastro do cliente mudar depois.
 */
export function useConfirmarPagamento() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ cliente, cartao, forma, gravarForma, pagamentos }: Confirmacao) => {
      const pago = {
        status: 'pago',
        data_pagamento: hojeISO(),
        valor: cartao.valor,
        data_vencimento: cartao.vencimento,
        ...(gravarForma ? { forma_pagamento: forma } : {}),
      }
      const { error } = cartao.id
        ? await supabase.from('client_payments').update(pago).eq('id', cartao.id)
        : await supabase
            .from('client_payments')
            .insert({ ...pago, client_id: cliente.id, mes_referencia: cartao.mes })
      if (error) throw error

      // O cartão do mês seguinte nasce com o valor e o dia atuais do cadastro.
      // Se falhar (por exemplo, a linha já existe), o pagamento confirmado continua valendo.
      const seguinte = proximoMes(cartao.mes)
      const dia = diaDeVencimento(cliente)
      const jaExiste = pagamentos.some(
        (p) => p.client_id === cliente.id && p.mes_referencia === seguinte,
      )
      if (dia && !jaExiste && cliente.status === 'ativo') {
        await supabase.from('client_payments').insert({
          client_id: cliente.id,
          mes_referencia: seguinte,
          valor: Number(cliente.mrr),
          data_vencimento: vencimentoNoMes(seguinte, dia),
          status: 'pendente',
        })
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['client_payments'] }),
  })
}
