import { diffDias } from '@/lib/datas'
import type { Tom } from '@/lib/rotulos'
import type { Client } from '@/types/database'

// Contrato de fidelidade: começa na data de início do cliente e dura 3, 6, 12 ou 15 meses.
// O selo avisa quando faltam 30 dias ou menos (amarelo) e quando já venceu (vermelho).

export const DURACOES = [3, 6, 12, 15] as const
export const DIAS_DE_AVISO = 30

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const doisDigitos = (n: number) => String(n).padStart(2, '0')

export function fimDoContrato(inicio: string, meses: number): string {
  const [ano, mes, dia] = inicio.split('-').map(Number)
  const indice = mes - 1 + meses
  const anoFim = ano + Math.floor(indice / 12)
  const mesFim = (indice % 12) + 1
  const ultimoDia = new Date(anoFim, mesFim, 0).getDate()
  return `${anoFim}-${doisDigitos(mesFim)}-${doisDigitos(Math.min(dia, ultimoDia))}`
}

export type SituacaoDoContrato = 'vigente' | 'perto' | 'vencido'

export function situacaoDoContrato(fim: string, hoje: string): SituacaoDoContrato {
  const faltam = diffDias(hoje, fim)
  if (faltam < 0) return 'vencido'
  return faltam <= DIAS_DE_AVISO ? 'perto' : 'vigente'
}

/** '2027-03-15' vira 'mar/2027'. */
export function formatarMesCurto(iso: string): string {
  const [ano, mes] = iso.split('-').map(Number)
  return `${MESES[mes - 1]}/${ano}`
}

const TOM: Record<SituacaoDoContrato, Tom> = { vigente: 'cinza', perto: 'amarelo', vencido: 'vermelho' }

export function seloDoContrato(
  cliente: Pick<Client, 'data_inicio_contrato' | 'contrato_meses'>,
  hoje: string,
): { texto: string; tom: Tom } | null {
  if (!cliente.data_inicio_contrato || !cliente.contrato_meses) return null
  const fim = fimDoContrato(cliente.data_inicio_contrato, cliente.contrato_meses)
  const situacao = situacaoDoContrato(fim, hoje)
  const mes = formatarMesCurto(fim)
  return {
    texto: situacao === 'vencido' ? `Encerrou em ${mes}` : `Encerra em ${mes}`,
    tom: TOM[situacao],
  }
}
