import type { ClientPayment, FormaDePagamento, PaymentStatus } from '@/types/database'

// Cobranças lançadas no sistema antes do Asaas (`client_payments`). Elas não são mais geradas
// nem confirmadas aqui: as receitas dos clientes vêm do Asaas (receitas_asaas). O que sobrou
// serve para mostrar o histórico antigo e para as datas das despesas recorrentes.

const doisDigitos = (n: number) => String(n).padStart(2, '0')

export function proximoMes(mes: string): string {
  const [ano, numero] = mes.split('-').map(Number)
  return numero === 12 ? `${ano + 1}-01-01` : `${ano}-${doisDigitos(numero + 1)}-01`
}

/** Data de vencimento dentro do mês; em mês mais curto, cai no último dia. */
export function vencimentoNoMes(mes: string, dia: number): string {
  const [ano, numero] = mes.split('-').map(Number)
  const ultimoDia = new Date(ano, numero, 0).getDate()
  return `${ano}-${doisDigitos(numero)}-${doisDigitos(Math.min(dia, ultimoDia))}`
}

const emAberto = (pagamento: Pick<ClientPayment, 'status'>) =>
  pagamento.status === 'pendente' || pagamento.status === 'atrasado'

export type SituacaoDoPagamento = 'pago' | 'parcial' | 'pendente'

/** Quanto da cobrança já entrou. Antes da migration 0004 não há valor_pago: vale o status. */
export function valorRecebido(p: Pick<ClientPayment, 'status' | 'valor' | 'valor_pago'>): number {
  if (p.valor_pago != null && Number(p.valor_pago) > 0) return Number(p.valor_pago)
  return p.status === 'pago' ? Number(p.valor) : 0
}

export function restante(valor: number, pago: number): number {
  return Math.max(0, Number(valor) - Number(pago))
}

export function situacaoDoPagamento(valor: number, pago: number): SituacaoDoPagamento {
  if (pago >= valor) return 'pago'
  return pago > 0 ? 'parcial' : 'pendente'
}

/** Uma cobrança mensal como a tela mostra. */
export interface CartaoDePagamento {
  id: string
  clienteId: string
  /** Primeiro dia do mês de referência, 'AAAA-MM-01' */
  mes: string
  valor: number
  vencimento: string
  /** 'pendente' com vencimento passado aparece como 'atrasado' */
  status: PaymentStatus
  dataPagamento: string | null
  forma: FormaDePagamento | null
  valorPago: number
  /** Data do último recebimento */
  pagoEm: string | null
  observacao: string | null
  situacao: SituacaoDoPagamento
  valorManual: boolean
}

/** As cobranças em ordem de mês, com o atraso calculado pela data de hoje. */
export function cartoesDe(pagamentos: ClientPayment[], hoje: string): CartaoDePagamento[] {
  return [...pagamentos]
    .sort(
      (a, b) =>
        a.mes_referencia.localeCompare(b.mes_referencia) || a.client_id.localeCompare(b.client_id),
    )
    .map((p) => ({
      id: p.id,
      clienteId: p.client_id,
      mes: p.mes_referencia,
      valor: Number(p.valor),
      vencimento: p.data_vencimento,
      status: emAberto(p) && p.data_vencimento < hoje ? 'atrasado' : p.status,
      dataPagamento: p.data_pagamento,
      forma: p.forma_pagamento ?? null,
      valorPago: valorRecebido(p),
      pagoEm: p.pago_em ?? p.data_pagamento,
      observacao: p.observacao_pagamento ?? null,
      situacao: situacaoDoPagamento(Number(p.valor), valorRecebido(p)),
      valorManual: p.valor_manual ?? false,
    }))
}

/** Separa o que ainda se espera receber do que já foi pago (o histórico, do mais recente ao mais antigo). */
export function separarCartoes(cartoes: CartaoDePagamento[]) {
  return {
    abertos: cartoes.filter((c) => c.status === 'pendente' || c.status === 'atrasado'),
    historico: cartoes.filter((c) => c.status === 'pago').reverse(),
  }
}
