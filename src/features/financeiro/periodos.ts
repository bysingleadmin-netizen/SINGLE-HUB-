import { somarDias } from '@/lib/datas'
import { formatarData } from '@/lib/formato'

// Períodos do filtro do Financeiro. Datas trafegam como 'AAAA-MM-DD'; meses, como 'AAAA-MM'.

export type PeriodoId = 'mes' | 'semana' | 'quinzena' | 'mes_anterior' | 'trimestre' | 'semestre' | 'ano'

export const PERIODOS: readonly { valor: PeriodoId; rotulo: string }[] = [
  { valor: 'mes', rotulo: 'Este mês' },
  { valor: 'semana', rotulo: 'Semana atual' },
  { valor: 'quinzena', rotulo: 'Quinzena atual' },
  { valor: 'mes_anterior', rotulo: 'Mês anterior' },
  { valor: 'trimestre', rotulo: 'Trimestre atual' },
  { valor: 'semestre', rotulo: 'Semestre atual' },
  { valor: 'ano', rotulo: 'Ano atual' },
]

export interface Intervalo {
  inicio: string
  fim: string
}

const doisDigitos = (n: number) => String(n).padStart(2, '0')
const ultimoDiaDoMes = (ano: number, mes: number) => new Date(ano, mes, 0).getDate()
const data = (ano: number, mes: number, dia: number) => `${ano}-${doisDigitos(mes)}-${doisDigitos(dia)}`

/** Do primeiro dia do mês `mesInicio` ao último do mês `mesInicio + meses - 1` */
function meses(ano: number, mesInicio: number, quantos: number): Intervalo {
  const mesFim = mesInicio + quantos - 1
  return { inicio: data(ano, mesInicio, 1), fim: data(ano, mesFim, ultimoDiaDoMes(ano, mesFim)) }
}

/** O intervalo de datas de um período, contado a partir de hoje. A semana vai de segunda a domingo. */
export function intervaloDoPeriodo(id: PeriodoId, hoje: string): Intervalo {
  const [ano, mes, dia] = hoje.split('-').map(Number)
  switch (id) {
    case 'mes':
      return meses(ano, mes, 1)
    case 'mes_anterior':
      return mes === 1 ? meses(ano - 1, 12, 1) : meses(ano, mes - 1, 1)
    case 'semana': {
      const diaDaSemana = new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay()
      const inicio = somarDias(hoje, -((diaDaSemana + 6) % 7))
      return { inicio, fim: somarDias(inicio, 6) }
    }
    case 'quinzena':
      return dia <= 15
        ? { inicio: data(ano, mes, 1), fim: data(ano, mes, 15) }
        : { inicio: data(ano, mes, 16), fim: data(ano, mes, ultimoDiaDoMes(ano, mes)) }
    case 'trimestre':
      return meses(ano, Math.floor((mes - 1) / 3) * 3 + 1, 3)
    case 'semestre':
      return meses(ano, mes <= 6 ? 1 : 7, 6)
    case 'ano':
      return meses(ano, 1, 12)
  }
}

/** O período do mesmo tipo logo antes deste: o mês passado, a semana passada, o ano passado... */
export function periodoAnterior(id: PeriodoId, hoje: string): Intervalo {
  const atual = intervaloDoPeriodo(id, hoje)
  // "Mês anterior" compara com o mês antes dele
  return intervaloDoPeriodo(id === 'mes_anterior' ? 'mes' : id, somarDias(atual.inicio, -1))
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
  const [ano, numero] = mes.split('-').map(Number)
  return meses(ano, numero, 1)
}

/** "01/10/2026 a 31/10/2026" */
export function descreverIntervalo({ inicio, fim }: Intervalo): string {
  return `${formatarData(inicio)} a ${formatarData(fim)}`
}
