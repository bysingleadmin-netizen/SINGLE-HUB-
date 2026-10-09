import { useEffect, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/features/auth/AuthContext'
import {
  diaDeVencimento,
  planoDeCobrancas,
  planoVazio,
  proximoMes,
  vencimentoNoMes,
} from '@/features/clientes/cartoes'
import type { CartaoDePagamento } from '@/features/clientes/cartoes'
import { hojeISO } from '@/lib/datas'
import { isLideranca } from '@/lib/permissoes'
import { supabase } from '@/lib/supabase'
import type { Client, ClientPayment, FormaDePagamento } from '@/types/database'
import { useColunasOpcionais } from './esquema'
import { useClientes, usePagamentos } from './tabelas'

/**
 * Mantém as cobranças mensais em dia com o cadastro dos clientes: cria as que faltam, ajusta
 * as em aberto quando o valor ou o vencimento mudam e cancela as de quem deixou de ser ativo.
 *
 * Roda no navegador de quem é da liderança, porque só ela pode gravar em `client_payments`
 * (RLS). Fica no layout, então vale para qualquer tela: basta alguém da liderança abrir o
 * sistema para o mês novo ganhar suas cobranças.
 */
export function useSincronizarCobrancas() {
  const { perfil } = useAuth()
  const clientes = useClientes()
  const pagamentos = usePagamentos()
  const esquema = useColunasOpcionais()
  const queryClient = useQueryClient()
  const toast = useToast()
  // Um plano que falhou não é tentado de novo sem que os dados mudem: evita laço de gravações
  const tentado = useRef('')

  const lideranca = isLideranca(perfil?.cargo)
  const pronto =
    lideranca && clientes.isSuccess && pagamentos.isSuccess && esquema.pronto && !pagamentos.isFetching

  useEffect(() => {
    if (!pronto) return
    const plano = planoDeCobrancas(clientes.data ?? [], pagamentos.data ?? [], hojeISO())
    const assinatura = JSON.stringify(plano)
    if (planoVazio(plano) || tentado.current === assinatura) return
    tentado.current = assinatura

    void (async () => {
      try {
        if (plano.inserir.length > 0) {
          const { error } = await supabase.from('client_payments').insert(plano.inserir)
          if (error) throw error
        }
        for (const { id, ...valores } of plano.atualizar) {
          const { error } = await supabase.from('client_payments').update(valores).eq('id', id)
          if (error) throw error
        }
        for (const id of plano.cancelar) {
          // O status "cancelado" chega com a migration 0003; antes dela a cobrança é apagada
          const consulta = esquema.arquivado
            ? supabase.from('client_payments').update({ status: 'cancelado' }).eq('id', id)
            : supabase.from('client_payments').delete().eq('id', id)
          const { error } = await consulta
          if (error) throw error
        }
      } catch {
        toast.erro('Não foi possível atualizar as cobranças mensais dos clientes.')
      } finally {
        await queryClient.invalidateQueries({ queryKey: ['client_payments'] })
      }
    })()
  }, [pronto, clientes.data, pagamentos.data, esquema.arquivado, queryClient, toast])
}

/** Para montar a sincronização em uma árvore de componentes. */
export function SincronizarCobrancas() {
  useSincronizarCobrancas()
  return null
}

interface Confirmacao {
  cliente: Client | undefined
  cartao: CartaoDePagamento
  forma: FormaDePagamento
  /** Pagamentos já carregados, para saber se o mês seguinte já tem cobrança */
  pagamentos: ClientPayment[]
}

/**
 * Confirma o pagamento de uma cobrança: ela vai para o histórico com a forma e a data de hoje,
 * e a do mês seguinte é criada se ainda não existir.
 */
export function useConfirmarPagamento() {
  const queryClient = useQueryClient()
  const esquema = useColunasOpcionais()
  return useMutation({
    mutationFn: async ({ cliente, cartao, forma, pagamentos }: Confirmacao) => {
      const { error } = await supabase
        .from('client_payments')
        .update({
          status: 'pago',
          data_pagamento: hojeISO(),
          ...(esquema.formaPagamento ? { forma_pagamento: forma } : {}),
          ...(esquema.arquivado ? { arquivado: true } : {}),
        })
        .eq('id', cartao.id)
      if (error) throw error

      // Se falhar (a cobrança já existe, por exemplo), o pagamento confirmado continua valendo
      const seguinte = proximoMes(cartao.mes)
      const dia = cliente ? diaDeVencimento(cliente) : null
      const jaExiste = pagamentos.some(
        (p) => p.client_id === cartao.clienteId && p.mes_referencia === seguinte,
      )
      if (cliente && dia && !jaExiste && cliente.status === 'ativo') {
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

/** Mensagem de sucesso da confirmação, que avisa quando a forma de pagamento não pôde ser gravada. */
export function useMensagemDePagamento() {
  const esquema = useColunasOpcionais()
  return esquema.formaPagamento
    ? 'Pagamento confirmado.'
    : 'Pagamento confirmado. A forma de pagamento não foi gravada: falta rodar a migration 0003.'
}
