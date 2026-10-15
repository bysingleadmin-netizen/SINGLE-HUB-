import type { Tom } from '@/lib/rotulos'

// Status e formas de pagamento como o Asaas manda, traduzidos para a tela

const RECEBIDO = new Set(['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'])
const CANCELADO = new Set(['DELETED', 'CANCELLED'])

/** Selo da cobrança: Recebido, Pendente, Atrasado, Estornado ou Cancelado. */
export function situacaoDoAsaas(status: string | null): { rotulo: string; tom: Tom } {
  if (!status) return { rotulo: 'Sem status', tom: 'cinza' }
  if (RECEBIDO.has(status)) return { rotulo: 'Recebido', tom: 'verde' }
  if (status === 'PENDING') return { rotulo: 'Pendente', tom: 'amarelo' }
  if (status === 'OVERDUE') return { rotulo: 'Atrasado', tom: 'vermelho' }
  if (status === 'REFUNDED') return { rotulo: 'Estornado', tom: 'cinza' }
  if (CANCELADO.has(status)) return { rotulo: 'Cancelado', tom: 'cinza' }
  return { rotulo: status, tom: 'cinza' }
}

const FORMAS: Record<string, string> = {
  PIX: 'Pix',
  BOLETO: 'Boleto',
  CREDIT_CARD: 'Cartão de crédito',
  UNDEFINED: 'A definir',
}

export function formaDoAsaas(forma: string | null): string | null {
  if (!forma) return null
  return FORMAS[forma] ?? forma
}
