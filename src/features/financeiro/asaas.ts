import { diffDias } from '@/lib/datas'
import type { Tom } from '@/lib/rotulos'
import { ultimosMeses } from '@/lib/regras'
import type { PontoDeMRR } from '@/lib/regras'
import type { ReceitaAsaas } from '@/types/database'

// Receitas dos clientes, como o Asaas manda (tabela receitas_asaas). O Asaas é a fonte: o que
// está lá aparece aqui, e as contas do Financeiro saem destas linhas.
// Meses trafegam como 'AAAA-MM'.

const RECEBIDO = new Set(['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'])
const CANCELADO = new Set(['DELETED', 'CANCELLED'])
/** Não contam como receita esperada: excluídas, canceladas e estornadas */
const FORA = new Set([...CANCELADO, 'REFUNDED'])

/** Selo da cobrança: Pago, Pendente, Atrasado, Estornado ou Cancelado. */
export function situacaoDoAsaas(status: string | null): { rotulo: string; tom: Tom } {
  if (!status) return { rotulo: 'Sem status', tom: 'cinza' }
  if (RECEBIDO.has(status)) return { rotulo: 'Pago', tom: 'verde' }
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

type Receita = Pick<
  ReceitaAsaas,
  'status' | 'valor' | 'data_vencimento' | 'data_pagamento' | 'cliente_id' | 'asaas_customer_id' | 'nome_cliente_asaas'
>

export const foiPaga = (receita: Pick<ReceitaAsaas, 'status'>) => RECEBIDO.has(receita.status ?? '')

/** Pendente ou vencida: ainda falta receber */
export const estaEmAberto = (receita: Pick<ReceitaAsaas, 'status'>) =>
  receita.status === 'PENDING' || receita.status === 'OVERDUE'

const valorDe = (receita: Pick<ReceitaAsaas, 'valor'>) => Number(receita.valor ?? 0)
const somar = (receitas: Pick<ReceitaAsaas, 'valor'>[]) =>
  receitas.reduce((soma, receita) => soma + valorDe(receita), 0)
const doMes = (data: string | null, mes: string) => data?.slice(0, 7) === mes

/**
 * Quem é o cliente da cobrança, para agrupar: o cliente daqui quando vinculada; senão o
 * cliente do Asaas; na falta dos dois, o nome.
 */
export function chaveDoCliente(receita: Receita): string {
  return receita.cliente_id ?? receita.asaas_customer_id ?? receita.nome_cliente_asaas ?? ''
}

/** O que entrou no mês, pela data do pagamento. */
export function recebidoNoMes(receitas: Receita[], mes: string): number {
  return somar(receitas.filter((r) => foiPaga(r) && doMes(r.data_pagamento, mes)))
}

/** O que vence no mês e ainda não venceu nem foi pago. */
export function aReceberNoMes(receitas: Receita[], mes: string): number {
  return somar(receitas.filter((r) => r.status === 'PENDING' && doMes(r.data_vencimento, mes)))
}

/**
 * Faturamento esperado do mês: todas as cobranças que vencem nele (pagas, pendentes ou
 * atrasadas), sem as canceladas e as estornadas.
 */
export function mrrDoMes(receitas: Receita[], mes: string): number {
  return somar(receitas.filter((r) => !FORA.has(r.status ?? '') && doMes(r.data_vencimento, mes)))
}

/** Quanto está vencido, em quantas cobranças e de quantos clientes. */
export function emAtraso(receitas: Receita[]) {
  const atrasadas = receitas.filter((r) => r.status === 'OVERDUE')
  return {
    total: somar(atrasadas),
    cobrancas: atrasadas.length,
    clientes: new Set(atrasadas.map(chaveDoCliente)).size,
  }
}

/** Recebimentos mês a mês, do mais antigo ao atual, prontos para o gráfico. */
export function recebimentosPorMes(receitas: Receita[], hoje: string, meses = 6): PontoDeMRR[] {
  return ultimosMeses(hoje, meses).map((ponto) => ({ ...ponto, valor: recebidoNoMes(receitas, ponto.mes) }))
}

export interface VencimentoAsaas<T> {
  receita: T
  /** Dias até vencer; negativo quando já venceu */
  dias: number
}

/** Pendentes que vencem de hoje até daqui a `dias` dias, da mais próxima para a mais distante. */
export function proximosVencimentos<T extends Receita>(
  receitas: T[],
  hoje: string,
  dias = 30,
): VencimentoAsaas<T>[] {
  return receitas
    .filter((r) => r.status === 'PENDING' && r.data_vencimento)
    .map((receita) => ({ receita, dias: diffDias(hoje, receita.data_vencimento!) }))
    .filter((v) => v.dias >= 0 && v.dias <= dias)
    .sort((a, b) => a.dias - b.dias)
}

/** Vencidas, da mais antiga para a mais recente. */
export function atrasadas<T extends Receita>(receitas: T[], hoje: string): VencimentoAsaas<T>[] {
  return receitas
    .filter((r) => r.status === 'OVERDUE')
    .map((receita) => ({ receita, dias: receita.data_vencimento ? diffDias(hoje, receita.data_vencimento) : 0 }))
    .sort((a, b) => a.dias - b.dias)
}

/** Em aberto pela data de vencimento; o histórico, do pagamento mais recente ao mais antigo. */
export function separarReceitas<T extends Receita>(receitas: T[]): { abertas: T[]; historico: T[] } {
  return {
    abertas: receitas
      .filter(estaEmAberto)
      .sort((a, b) => (a.data_vencimento ?? '').localeCompare(b.data_vencimento ?? '')),
    historico: receitas
      .filter(foiPaga)
      .sort((a, b) => (b.data_pagamento ?? '').localeCompare(a.data_pagamento ?? '')),
  }
}

export interface ProgressoAsaas {
  chave: string
  nome: string
  pago: number
  total: number
  /** 0 a 100, arredondado */
  percentual: number
}

/** Quanto cada cliente pagou das cobranças que vencem no mês, sem as canceladas. Por nome. */
export function progressoPorCliente<T extends Receita>(
  receitas: T[],
  mes: string,
  nomeDe: (receita: T) => string,
): ProgressoAsaas[] {
  const grupos = new Map<string, T[]>()
  for (const receita of receitas) {
    if (FORA.has(receita.status ?? '') || !doMes(receita.data_vencimento, mes)) continue
    const chave = chaveDoCliente(receita)
    grupos.set(chave, [...(grupos.get(chave) ?? []), receita])
  }
  return [...grupos]
    .map(([chave, doCliente]) => {
      const total = somar(doCliente)
      const pago = somar(doCliente.filter(foiPaga))
      return {
        chave,
        nome: nomeDe(doCliente[0]),
        pago,
        total,
        percentual: total > 0 ? Math.round((pago / total) * 100) : 0,
      }
    })
    .filter((linha) => linha.total > 0)
    .sort((a, b) => a.nome.localeCompare(b.nome))
}
