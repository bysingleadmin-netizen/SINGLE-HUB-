import { proximoMes, vencimentoNoMes } from '@/features/clientes/cartoes'
import { diffDias, somarDias } from '@/lib/datas'
import { textoOuNull } from '@/lib/formulario'
import type { Erros, Validacao } from '@/lib/formulario'
import { parseMoeda } from '@/lib/regras'
import type { Expense, MonthlyGoal, TrafficMetric } from '@/types/database'
import { intervaloDoMes, mesesDoIntervalo } from './periodos'
import type { Intervalo } from './periodos'

// Regras do Financeiro. Meses trafegam como 'AAAA-MM'; no banco, `mes` é o primeiro dia ('AAAA-MM-01').

export const CATEGORIAS = ['Ferramentas', 'Equipe', 'Tráfego', 'Impostos', 'Estrutura', 'Outros'] as const

export const FORMAS_DE_PAGAMENTO = ['Pix', 'Cartão', 'Boleto', 'Dinheiro', 'Transferência'] as const

const VALOR_INVALIDO = 'Informe um valor como 1.500,00.'

const somar = (valores: number[]) => valores.reduce((soma, valor) => soma + Number(valor), 0)

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

/** Resultado do mês: a receita (o recebido no Asaas) menos as despesas lançadas. */
export function dreDoMes(receita: number, despesas: Pick<Expense, 'valor' | 'data'>[], mes: string): LinhaDoDRE {
  const gasto = despesaDoMes(despesas, mes)
  return { mes, receita, despesas: gasto, resultado: receita - gasto }
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

type Meta = Pick<MonthlyGoal, 'mes' | 'meta' | 'tipo'>

export const metaMensalDe = <T extends Meta>(metas: T[], mes: string) =>
  metas.find((m) => (m.tipo ?? 'mensal') === 'mensal' && m.mes.slice(0, 7) === mes)

export const metaAnualDe = <T extends Meta>(metas: T[], ano: string) =>
  metas.find((m) => m.tipo === 'anual' && m.mes.slice(0, 4) === ano)

/**
 * A meta do período: para cada mês que ele toca, a meta mensal daquele mês (ou, sem ela, a
 * anual dividida por 12), proporcional aos dias do mês que caem no período. Zero sem meta.
 */
export function metaDoPeriodo(metas: Meta[], intervalo: Intervalo): number {
  let total = 0
  for (const mes of mesesDoIntervalo(intervalo)) {
    const doMes = intervaloDoMes(mes)
    const mensal = metaMensalDe(metas, mes)
    const anual = metaAnualDe(metas, mes.slice(0, 4))
    const alvo = mensal ? Number(mensal.meta) : anual ? Number(anual.meta) / 12 : 0
    const inicio = intervalo.inicio > doMes.inicio ? intervalo.inicio : doMes.inicio
    const fim = intervalo.fim < doMes.fim ? intervalo.fim : doMes.fim
    const diasDoMes = diffDias(doMes.inicio, doMes.fim) + 1
    total += (alvo * (diffDias(inicio, fim) + 1)) / diasDoMes
  }
  return Math.round(total * 100) / 100
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

/** De quanto em quanto tempo a despesa recorrente se repete */
export type Frequencia = 'semanal' | 'quinzenal' | 'mensal' | 'trimestral' | 'anual'

export const FREQUENCIAS: readonly { valor: Frequencia; rotulo: string }[] = [
  { valor: 'semanal', rotulo: 'Semanal' },
  { valor: 'quinzenal', rotulo: 'Quinzenal' },
  { valor: 'mensal', rotulo: 'Mensal' },
  { valor: 'trimestral', rotulo: 'Trimestral' },
  { valor: 'anual', rotulo: 'Anual' },
]

/** Máximo de parcelas de uma despesa recorrente com fim */
export const MAXIMO_DE_PARCELAS = 60

/** Sem fim, os lançamentos ficam criados até um ano à frente */
export const HORIZONTE_DIAS = 365

/** Quantas parcelas: inteiro de 1 a 60, ou null se não for. */
export function validarParcelas(texto: string): number | null {
  if (!/^\d+$/.test(texto.trim())) return null
  const parcelas = Number(texto)
  return parcelas >= 1 && parcelas <= MAXIMO_DE_PARCELAS ? parcelas : null
}

const MESES_DA_FREQUENCIA: Partial<Record<Frequencia, number>> = { mensal: 1, trimestral: 3, anual: 12 }
const DIAS_DA_FREQUENCIA: Partial<Record<Frequencia, number>> = { semanal: 7, quinzenal: 14 }

/** A n-ésima data da recorrência (0 é a própria data). Por mês, mantém o dia (ou o último do mês). */
function enesimaData(data: string, frequencia: Frequencia, n: number): string {
  const dias = DIAS_DA_FREQUENCIA[frequencia]
  if (dias) return somarDias(data, dias * n)
  const passo = MESES_DA_FREQUENCIA[frequencia] ?? 1
  let mes = `${data.slice(0, 7)}-01`
  for (let i = 0; i < passo * n; i++) mes = proximoMes(mes)
  return vencimentoNoMes(mes, Number(data.slice(8, 10)))
}

/** A data informada e as `parcelas - 1` seguintes. */
export function datasDaRecorrencia(data: string, parcelas: number, frequencia: Frequencia = 'mensal'): string[] {
  return Array.from({ length: parcelas }, (_, i) => enesimaData(data, frequencia, i))
}

/** As datas da recorrência sem fim, da data informada até `limite` (sempre ao menos a primeira). */
export function datasAte(data: string, frequencia: Frequencia, limite: string): string[] {
  const datas = [data]
  for (let n = 1; ; n++) {
    const proxima = enesimaData(data, frequencia, n)
    if (proxima > limite) return datas
    datas.push(proxima)
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
