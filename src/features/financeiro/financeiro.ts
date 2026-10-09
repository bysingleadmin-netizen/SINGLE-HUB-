import { diffDias } from '@/lib/datas'
import { textoOuNull } from '@/lib/formulario'
import type { Erros, Validacao } from '@/lib/formulario'
import { parseMoeda, ultimosMeses } from '@/lib/regras'
import type { PontoDeMRR } from '@/lib/regras'
import type { Client, ClientPayment, Expense, TrafficMetric } from '@/types/database'

// Regras do Financeiro. Meses trafegam como 'AAAA-MM'; no banco, `mes` é o primeiro dia ('AAAA-MM-01').

export const CATEGORIAS = ['Ferramentas', 'Equipe', 'Tráfego', 'Impostos', 'Estrutura', 'Outros'] as const

export const FORMAS_DE_PAGAMENTO = ['Pix', 'Cartão', 'Boleto', 'Dinheiro', 'Transferência'] as const

const VALOR_INVALIDO = 'Informe um valor como 1.500,00.'

const somar = (valores: number[]) => valores.reduce((soma, valor) => soma + Number(valor), 0)

/** Receita do mês: pagamentos confirmados cuja data de pagamento cai nele. */
export function receitaDoMes(
  pagamentos: Pick<ClientPayment, 'status' | 'valor' | 'data_pagamento'>[],
  mes: string,
): number {
  return somar(
    pagamentos
      .filter((p) => p.status === 'pago' && p.data_pagamento?.slice(0, 7) === mes)
      .map((p) => p.valor),
  )
}

export function despesaDoMes(despesas: Pick<Expense, 'valor' | 'data'>[], mes: string): number {
  return somar(despesas.filter((d) => d.data.slice(0, 7) === mes).map((d) => d.valor))
}

export interface LinhaDoDRE {
  /** 'AAAA-MM' */
  mes: string
  receita: number
  despesas: number
  resultado: number
}

export function dreDoMes(
  pagamentos: Pick<ClientPayment, 'status' | 'valor' | 'data_pagamento'>[],
  despesas: Pick<Expense, 'valor' | 'data'>[],
  mes: string,
): LinhaDoDRE {
  const receita = receitaDoMes(pagamentos, mes)
  const gasto = despesaDoMes(despesas, mes)
  return { mes, receita, despesas: gasto, resultado: receita - gasto }
}

/** Faturamento recebido mês a mês, do mais antigo ao atual, pronto para o gráfico. */
export function faturamentoPorMes(
  pagamentos: Pick<ClientPayment, 'status' | 'valor' | 'data_pagamento'>[],
  hoje: string,
  meses = 6,
): PontoDeMRR[] {
  return ultimosMeses(hoje, meses).map((ponto) => ({
    ...ponto,
    valor: receitaDoMes(pagamentos, ponto.mes),
  }))
}

type Cobranca = Pick<
  ClientPayment,
  'client_id' | 'mes_referencia' | 'valor' | 'data_vencimento' | 'status'
>

const emAberto = (pagamento: Pick<ClientPayment, 'status'>) =>
  pagamento.status === 'pendente' || pagamento.status === 'atrasado'

/** Quanto ainda se espera receber das cobranças do mês ('AAAA-MM'). */
export function pendenteNoMes(pagamentos: Cobranca[], mes: string): number {
  return somar(
    pagamentos.filter((p) => emAberto(p) && p.mes_referencia.slice(0, 7) === mes).map((p) => p.valor),
  )
}

export interface Vencimento {
  cliente: Pick<Client, 'id' | 'nome'>
  /** Primeiro dia do mês de referência */
  mes: string
  valor: number
  vencimento: string
  /** Dias até vencer; negativo quando já venceu */
  dias: number
}

function vencimentos(
  clientes: Pick<Client, 'id' | 'nome'>[],
  pagamentos: Cobranca[],
  hoje: string,
): Vencimento[] {
  const nomes = new Map(clientes.map((c) => [c.id, c.nome]))
  return pagamentos.filter(emAberto).map((p) => ({
    cliente: { id: p.client_id, nome: nomes.get(p.client_id) ?? 'Cliente removido' },
    mes: p.mes_referencia,
    valor: Number(p.valor),
    vencimento: p.data_vencimento,
    dias: diffDias(hoje, p.data_vencimento),
  }))
}

/**
 * Cobranças vencidas e não pagas, da mais atrasada para a menos. Lê as mesmas cobranças da
 * aba Pagamentos, então os dois lugares sempre concordam.
 */
export function pagamentosEmAtraso(
  clientes: Pick<Client, 'id' | 'nome'>[],
  pagamentos: Cobranca[],
  hoje: string,
): Vencimento[] {
  return vencimentos(clientes, pagamentos, hoje)
    .filter((v) => v.dias < 0)
    .sort((a, b) => a.dias - b.dias)
}

/** Cobranças que vencem de hoje até daqui a `dias` dias, da mais próxima para a mais distante. */
export function proximosVencimentos(
  clientes: Pick<Client, 'id' | 'nome'>[],
  pagamentos: Cobranca[],
  hoje: string,
  dias = 7,
): Vencimento[] {
  return vencimentos(clientes, pagamentos, hoje)
    .filter((v) => v.dias >= 0 && v.dias <= dias)
    .sort((a, b) => a.dias - b.dias)
}

/** O atraso em um número: quanto, de quantas cobranças e de quantos clientes. */
export function inadimplencia(atrasos: Vencimento[]) {
  return {
    total: atrasos.reduce((soma, atraso) => soma + atraso.valor, 0),
    cobrancas: atrasos.length,
    clientes: new Set(atrasos.map((atraso) => atraso.cliente.id)).size,
  }
}
type Leads = Pick<TrafficMetric, 'leads_instagram' | 'leads_whatsapp'>

export function totalDeLeads(metrica: Leads): number {
  return Number(metrica.leads_instagram) + Number(metrica.leads_whatsapp)
}

/** Investimento dividido pelos leads. Null sem leads. */
export function custoPorLead(metrica: Leads & Pick<TrafficMetric, 'investimento'>): number | null {
  const leads = totalDeLeads(metrica)
  return leads === 0 ? null : Number(metrica.investimento) / leads
}

/** Convertidos sobre os leads, em %. Null sem leads. */
export function taxaDeConversao(metrica: Leads & Pick<TrafficMetric, 'convertidos'>): number | null {
  const leads = totalDeLeads(metrica)
  return leads === 0 ? null : (Number(metrica.convertidos) / leads) * 100
}

/** Quanto da meta já entrou. Sem meta definida, o percentual é zero. */
export function progressoDaMeta(recebido: number, meta: number) {
  return {
    percentual: meta > 0 ? (recebido / meta) * 100 : 0,
    falta: Math.max(0, meta - recebido),
  }
}

export interface FiltroDeDespesas {
  de: string
  ate: string
  /** Vazio para todas */
  categoria: string
}

/** Despesas do período e da categoria, da mais recente para a mais antiga. */
export function filtrarDespesas(despesas: Expense[], { de, ate, categoria }: FiltroDeDespesas): Expense[] {
  return despesas
    .filter(
      (d) =>
        (de === '' || d.data >= de) &&
        (ate === '' || d.data <= ate) &&
        (categoria === '' || d.categoria === categoria),
    )
    .sort((a, b) => b.data.localeCompare(a.data))
}

export function totalDasDespesas(despesas: Pick<Expense, 'valor'>[]): number {
  return somar(despesas.map((d) => d.valor))
}

export interface FormDespesa {
  descricao: string
  categoria: string
  valor: string
  data: string
  forma_pagamento: string
}

export type ValoresDespesa = Pick<
  Expense,
  'descricao' | 'categoria' | 'valor' | 'data' | 'forma_pagamento'
>

export function validarDespesa(form: FormDespesa): Validacao<ValoresDespesa, FormDespesa> {
  const erros: Erros<FormDespesa> = {}
  const descricao = textoOuNull(form.descricao)
  const valor = parseMoeda(form.valor)

  if (!descricao) erros.descricao = 'Informe a descrição.'
  if (valor == null || valor === 0) erros.valor = VALOR_INVALIDO
  if (form.data === '') erros.data = 'Informe a data.'
  if (!descricao || valor == null || Object.keys(erros).length > 0) return { erros }

  return {
    valores: {
      descricao,
      categoria: form.categoria,
      valor,
      data: form.data,
      forma_pagamento: form.forma_pagamento,
    },
  }
}

export interface FormMetricas {
  /** 'AAAA-MM' */
  mes: string
  investimento: string
  leads_instagram: string
  leads_whatsapp: string
  convertidos: string
}

export type ValoresMetricas = Omit<TrafficMetric, 'id' | 'created_at'>

/** Aceita vazio como zero; recusa negativos e números quebrados. */
function inteiro(texto: string): number | null {
  const limpo = texto.trim()
  if (limpo === '') return 0
  return /^\d+$/.test(limpo) ? Number(limpo) : null
}

export function validarMetricas(form: FormMetricas): Validacao<ValoresMetricas, FormMetricas> {
  const erros: Erros<FormMetricas> = {}
  const investimento = form.investimento.trim() === '' ? 0 : parseMoeda(form.investimento)
  const instagram = inteiro(form.leads_instagram)
  const whatsapp = inteiro(form.leads_whatsapp)
  const convertidos = inteiro(form.convertidos)
  const NUMERO_INVALIDO = 'Informe um número inteiro.'

  if (investimento == null) erros.investimento = VALOR_INVALIDO
  if (instagram == null) erros.leads_instagram = NUMERO_INVALIDO
  if (whatsapp == null) erros.leads_whatsapp = NUMERO_INVALIDO
  if (convertidos == null) erros.convertidos = NUMERO_INVALIDO
  if (
    convertidos != null &&
    instagram != null &&
    whatsapp != null &&
    convertidos > instagram + whatsapp
  ) {
    erros.convertidos = 'Os convertidos não podem passar do total de leads.'
  }
  if (
    investimento == null ||
    instagram == null ||
    whatsapp == null ||
    convertidos == null ||
    Object.keys(erros).length > 0
  ) {
    return { erros }
  }

  return {
    valores: {
      mes: `${form.mes}-01`,
      investimento,
      leads_instagram: instagram,
      leads_whatsapp: whatsapp,
      convertidos,
    },
  }
}

export function formatarPercentual(valor: number): string {
  return `${valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
}
