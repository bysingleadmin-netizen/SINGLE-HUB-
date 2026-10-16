import { formatarData } from '@/lib/formato'

// Períodos dos filtros (Financeiro e gráficos de volume). Datas trafegam como 'AAAA-MM-DD';
// meses, como 'AAAA-MM'.

/** Botões rápidos do Financeiro */
export type PeriodoRapido = 'mes_atual' | 'quarter' | 'semestral' | 'anual'

/** Um botão rápido ou um mês específico, 'AAAA-MM' */
export type PeriodoId = PeriodoRapido | string

export const PERIODOS_RAPIDOS: readonly { valor: PeriodoRapido; rotulo: string }[] = [
  { valor: 'mes_atual', rotulo: 'Mês atual' },
  { valor: 'quarter', rotulo: 'Quarter' },
  { valor: 'semestral', rotulo: 'Semestral' },
  { valor: 'anual', rotulo: 'Anual' },
]

export interface Intervalo {
  inicio: string
  fim: string
}

const doisDigitos = (n: number) => String(n).padStart(2, '0')
const ultimoDiaDoMes = (ano: number, mes: number) => new Date(ano, mes, 0).getDate()
const data = (ano: number, mes: number, dia: number) => `${ano}-${doisDigitos(mes)}-${doisDigitos(dia)}`

/** 'AAAA-MM' somado de `meses` (negativo volta no tempo) */
export function somarMeses(mes: string, meses: number): string {
  const [ano, numero] = mes.split('-').map(Number)
  const total = ano * 12 + (numero - 1) + meses
  return `${Math.floor(total / 12)}-${doisDigitos((total % 12) + 1)}`
}

/** Do primeiro dia do mês `primeiro` ao último dia do mês `ultimo` ('AAAA-MM') */
export function intervaloDosMeses(primeiro: string, ultimo: string): Intervalo {
  const [anoFim, mesFim] = ultimo.split('-').map(Number)
  return { inicio: `${primeiro}-01`, fim: data(anoFim, mesFim, ultimoDiaDoMes(anoFim, mesFim)) }
}

/** Os `quantos` meses que terminam no mês de hoje, inclusive ele */
export function ultimosMesesAteHoje(hoje: string, quantos: number): Intervalo {
  const atual = hoje.slice(0, 7)
  return intervaloDosMeses(somarMeses(atual, -(quantos - 1)), atual)
}

/**
 * O intervalo de um período, contado a partir de hoje. Quarter são os três últimos meses
 * completos (sem o atual); Semestral e Anual, os últimos 6 e 12 meses até o atual.
 */
export function intervaloDoPeriodo(id: PeriodoId, hoje: string): Intervalo {
  const atual = hoje.slice(0, 7)
  switch (id) {
    case 'mes_atual':
      return intervaloDosMeses(atual, atual)
    case 'quarter':
      return intervaloDosMeses(somarMeses(atual, -3), somarMeses(atual, -1))
    case 'semestral':
      return ultimosMesesAteHoje(hoje, 6)
    case 'anual':
      return ultimosMesesAteHoje(hoje, 12)
    default:
      return /^\d{4}-\d{2}$/.test(id) ? intervaloDosMeses(id, id) : intervaloDosMeses(atual, atual)
  }
}

/** O intervalo de mesmo tamanho, em meses, logo antes deste: para comparar com o período anterior */
export function intervaloAnterior(intervalo: Intervalo): Intervalo {
  const meses = mesesDoIntervalo(intervalo)
  const primeiro = meses[0]
  return intervaloDosMeses(somarMeses(primeiro, -meses.length), somarMeses(primeiro, -1))
}

const NOMES_DOS_MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

/** "Setembro 2026" */
export function nomeDoMes(mes: string): string {
  const [ano, numero] = mes.split('-').map(Number)
  return `${NOMES_DOS_MESES[numero - 1]} ${ano}`
}

/** Os meses para escolher um a um, do atual para trás: "Outubro 2026", "Setembro 2026"... */
export function mesesParaEscolher(hoje: string, quantos = 24): { valor: string; rotulo: string }[] {
  const atual = hoje.slice(0, 7)
  return Array.from({ length: quantos }, (_, i) => {
    const mes = somarMeses(atual, -i)
    return { valor: mes, rotulo: nomeDoMes(mes) }
  })
}

/** A data (ou o começo de um carimbo de data e hora) cai dentro do intervalo? */
export function dentro(valor: string | null | undefined, { inicio, fim }: Intervalo): boolean {
  if (!valor) return false
  const dia = valor.slice(0, 10)
  return dia >= inicio && dia <= fim
}

/** Os meses que o intervalo toca, do primeiro ao último */
export function mesesDoIntervalo({ inicio, fim }: Intervalo): string[] {
  const lista: string[] = []
  let [ano, mes] = inicio.split('-').map(Number)
  const ultimo = fim.slice(0, 7)
  for (let mesAtual = data(ano, mes, 1).slice(0, 7); mesAtual <= ultimo; ) {
    lista.push(mesAtual)
    mes++
    if (mes === 13) {
      mes = 1
      ano++
    }
    mesAtual = data(ano, mes, 1).slice(0, 7)
  }
  return lista
}

/** Intervalo de um mês 'AAAA-MM' */
export function intervaloDoMes(mes: string): Intervalo {
  return intervaloDosMeses(mes, mes)
}

/** "01/10/2026 a 31/10/2026" */
export function descreverIntervalo({ inicio, fim }: Intervalo): string {
  return `${formatarData(inicio)} a ${formatarData(fim)}`
}
