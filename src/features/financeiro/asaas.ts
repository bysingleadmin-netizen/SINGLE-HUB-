import { diffDias } from '@/lib/datas'
import type { Tom } from '@/lib/rotulos'
import { ultimosMeses } from '@/lib/regras'
import type { PontoDeMRR } from '@/lib/regras'
import type { ReceitaAsaas } from '@/types/database'
import { dentro, intervaloDoMes, mesesDoIntervalo } from './periodos'
import type { Intervalo } from './periodos'

// Receitas dos clientes, como o Asaas manda (tabela receitas_asaas). O Asaas é a fonte: o que
// está lá aparece aqui, e as contas do Financeiro saem destas linhas.
// Datas trafegam como 'AAAA-MM-DD' e os períodos, como intervalos (periodos.ts).

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
const valida = (receita: Pick<ReceitaAsaas, 'status'>) => !FORA.has(receita.status ?? '')

/**
 * Quem é o cliente da cobrança, para agrupar: o cliente daqui quando vinculada; senão o
 * cliente do Asaas; na falta dos dois, o nome.
 */
export function chaveDoCliente(receita: Receita): string {
  return receita.cliente_id ?? receita.asaas_customer_id ?? receita.nome_cliente_asaas ?? ''
}

/** O que entrou no período, pela data do pagamento. */
export function recebidoNoPeriodo(receitas: Receita[], intervalo: Intervalo): number {
  return somar(receitas.filter((r) => foiPaga(r) && dentro(r.data_pagamento, intervalo)))
}

/** O que entrou no mês 'AAAA-MM' (DRE e meta) */
export function recebidoNoMes(receitas: Receita[], mes: string): number {
  return recebidoNoPeriodo(receitas, intervaloDoMes(mes))
}

/** O que vence no período e ainda não venceu nem foi pago. */
export function aReceberNoPeriodo(receitas: Receita[], intervalo: Intervalo): number {
  return somar(receitas.filter((r) => r.status === 'PENDING' && dentro(r.data_vencimento, intervalo)))
}

/**
 * Faturamento esperado do período: todas as cobranças que vencem nele (pagas, pendentes ou
 * atrasadas), sem as canceladas e as estornadas.
 */
export function mrrDoPeriodo(receitas: Receita[], intervalo: Intervalo): number {
  return somar(receitas.filter((r) => valida(r) && dentro(r.data_vencimento, intervalo)))
}

/**
 * Quanto está vencido, em quantas cobranças e de quantos clientes. Com `ate`, só o que venceu
 * até aquele dia (o fim do período escolhido): dívida antiga continua contando.
 */
export function emAtraso(receitas: Receita[], ate?: string) {
  const atrasadas = receitas.filter(
    (r) => r.status === 'OVERDUE' && (!ate || (r.data_vencimento ?? '') <= ate),
  )
  return {
    total: somar(atrasadas),
    cobrancas: atrasadas.length,
    clientes: new Set(atrasadas.map(chaveDoCliente)).size,
  }
}

export interface TicketMedio {
  /** Null quando não há cliente com cobrança no período */
  valor: number | null
  /** Clientes com cobrança no período */
  clientes: number
}

/**
 * Ticket médio: o faturamento do mês dividido pelos clientes com cobrança naquele mês, somados
 * os meses que o período toca. Cliente que saiu deixa de ter cobrança e sai do denominador no
 * mesmo mês; não há média histórica fixa. Período menor que um mês usa o mês dele.
 */
export function ticketMedio(receitas: Receita[], intervalo: Intervalo): TicketMedio {
  let faturamento = 0
  let clientesPorMes = 0
  const todos = new Set<string>()
  for (const mes of mesesDoIntervalo(intervalo)) {
    const doMes = receitas.filter((r) => valida(r) && dentro(r.data_vencimento, intervaloDoMes(mes)))
    const clientes = new Set(doMes.map(chaveDoCliente))
    faturamento += somar(doMes)
    clientesPorMes += clientes.size
    for (const cliente of clientes) todos.add(cliente)
  }
  return { valor: clientesPorMes > 0 ? faturamento / clientesPorMes : null, clientes: todos.size }
}

/**
 * Recebimentos mês a mês para o gráfico: os meses do período quando ele passa de um mês; senão,
 * os seis últimos até o mês dele.
 */
export function recebimentosDoPeriodo(receitas: Receita[], intervalo: Intervalo): PontoDeMRR[] {
  const doPeriodo = mesesDoIntervalo(intervalo).length
  const meses = doPeriodo > 1 ? doPeriodo : 6
  return ultimosMeses(intervalo.fim, meses).map((ponto) => ({ ...ponto, valor: recebidoNoMes(receitas, ponto.mes) }))
}

export interface VencimentoAsaas<T> {
  receita: T
  /** Dias até vencer; negativo quando já venceu */
  dias: number
}

/** Pendentes que vencem dentro do período, de hoje em diante, da mais próxima para a mais distante. */
export function proximosVencimentos<T extends Receita>(
  receitas: T[],
  hoje: string,
  intervalo: Intervalo,
): VencimentoAsaas<T>[] {
  const desde = hoje > intervalo.inicio ? hoje : intervalo.inicio
  return receitas
    .filter((r) => r.status === 'PENDING' && dentro(r.data_vencimento, { inicio: desde, fim: intervalo.fim }))
    .map((receita) => ({ receita, dias: diffDias(hoje, receita.data_vencimento!) }))
    .sort((a, b) => a.dias - b.dias)
}

/** Vencidas até `ate` (o fim do período), da mais antiga para a mais recente. */
export function atrasadas<T extends Receita>(receitas: T[], hoje: string, ate?: string): VencimentoAsaas<T>[] {
  return receitas
    .filter((r) => r.status === 'OVERDUE' && (!ate || (r.data_vencimento ?? '') <= ate))
    .map((receita) => ({ receita, dias: receita.data_vencimento ? diffDias(hoje, receita.data_vencimento) : 0 }))
    .sort((a, b) => a.dias - b.dias)
}

/**
 * Em aberto pela data de vencimento; o histórico, do pagamento mais recente ao mais antigo.
 * Com um período: pendentes que vencem nele, vencidas até o fim dele e pagas dentro dele.
 */
export function separarReceitas<T extends Receita>(
  receitas: T[],
  intervalo?: Intervalo,
): { abertas: T[]; historico: T[] } {
  const abertaNoPeriodo = (r: T) =>
    !intervalo ||
    (r.status === 'OVERDUE' ? (r.data_vencimento ?? '') <= intervalo.fim : dentro(r.data_vencimento, intervalo))
  return {
    abertas: receitas
      .filter((r) => estaEmAberto(r) && abertaNoPeriodo(r))
      .sort((a, b) => (a.data_vencimento ?? '').localeCompare(b.data_vencimento ?? '')),
    historico: receitas
      .filter((r) => foiPaga(r) && (!intervalo || dentro(r.data_pagamento, intervalo)))
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

/** Quanto cada cliente pagou das cobranças que vencem no período, sem as canceladas. Por nome. */
export function progressoPorCliente<T extends Receita>(
  receitas: T[],
  intervalo: Intervalo,
  nomeDe: (receita: T) => string,
): ProgressoAsaas[] {
  const grupos = new Map<string, T[]>()
  for (const receita of receitas) {
    if (!valida(receita) || !dentro(receita.data_vencimento, intervalo)) continue
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
