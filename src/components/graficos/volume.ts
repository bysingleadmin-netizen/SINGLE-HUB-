import { dentro, ultimosMesesAteHoje } from '@/lib/periodos'
import type { Intervalo } from '@/lib/periodos'
import type { BarraDoGrafico } from './BarrasHorizontais'

// Gráfico de volume dos quadros (Demandas, Conteúdo e Anúncios): quantos cards há em cada
// coluna, de um cliente ou de todos, num período.

export type PeriodoDoVolume = '' | 'mes' | '3' | '6' | '12'

export const PERIODOS_DO_VOLUME: readonly { valor: Exclude<PeriodoDoVolume, ''>; rotulo: string }[] = [
  { valor: 'mes', rotulo: 'Mês atual' },
  { valor: '3', rotulo: 'Últimos 3 meses' },
  { valor: '6', rotulo: 'Últimos 6 meses' },
  { valor: '12', rotulo: 'Últimos 12 meses' },
]

/** Sem período (''), vale tudo */
export function intervaloDoVolume(periodo: PeriodoDoVolume, hoje: string): Intervalo | null {
  if (periodo === '') return null
  return ultimosMesesAteHoje(hoje, periodo === 'mes' ? 1 : Number(periodo))
}

export interface ItemDoVolume {
  coluna: string
  cliente: string | null
  /** A data que põe o card no período; sem ela, o card só conta quando não há período */
  data: string | null
}

export function volumePorColuna(
  itens: ItemDoVolume[],
  colunas: readonly { id: string; titulo: string }[],
  { clienteId, intervalo }: { clienteId: string; intervalo: Intervalo | null },
): BarraDoGrafico[] {
  const filtrados = itens.filter(
    (item) => (clienteId === '' || item.cliente === clienteId) && (!intervalo || dentro(item.data, intervalo)),
  )
  return colunas.map((coluna) => ({
    chave: coluna.id,
    rotulo: coluna.titulo,
    valor: filtrados.filter((item) => item.coluna === coluna.id).length,
  }))
}
