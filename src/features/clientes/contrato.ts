import { diffDias, somarDias } from '@/lib/datas'
import { formatarData } from '@/lib/formato'
import type { Tom } from '@/lib/rotulos'
import type { Client } from '@/types/database'

// Contrato de fidelidade: começa na data de início do cliente (quando ele passa a pagar) e dura
// 3, 6, 12 ou 15 meses. O último dia é a véspera do mesmo dia N meses depois:
// 01/08/2024 + 3 meses termina em 31/10/2024.
// O selo avisa quando faltam 30 dias ou menos (amarelo) e quando já venceu (vermelho).

export const DURACOES = [3, 6, 12, 15] as const
export const DIAS_DE_AVISO = 30

const doisDigitos = (n: number) => String(n).padStart(2, '0')

/** Último dia do contrato: início + meses - 1 dia. */
export function fimDoContrato(inicio: string, meses: number): string {
  const [ano, mes, dia] = inicio.split('-').map(Number)
  const indice = mes - 1 + meses
  const anoFim = ano + Math.floor(indice / 12)
  const mesFim = (indice % 12) + 1
  const ultimoDia = new Date(anoFim, mesFim, 0).getDate()
  // Começou num dia que o mês final não tem (30/11 + 3 meses): o contrato vai até o último dia dele
  if (dia > ultimoDia) return `${anoFim}-${doisDigitos(mesFim)}-${doisDigitos(ultimoDia)}`
  return somarDias(`${anoFim}-${doisDigitos(mesFim)}-${doisDigitos(dia)}`, -1)
}

export type SituacaoDoContrato = 'vigente' | 'perto' | 'vencido'

export function situacaoDoContrato(fim: string, hoje: string): SituacaoDoContrato {
  const faltam = diffDias(hoje, fim)
  if (faltam < 0) return 'vencido'
  return faltam <= DIAS_DE_AVISO ? 'perto' : 'vigente'
}

const TOM: Record<SituacaoDoContrato, Tom> = { vigente: 'cinza', perto: 'amarelo', vencido: 'vermelho' }

export function seloDoContrato(
  cliente: Pick<Client, 'data_inicio_contrato' | 'contrato_meses'>,
  hoje: string,
): { texto: string; tom: Tom } | null {
  if (!cliente.data_inicio_contrato || !cliente.contrato_meses) return null
  const fim = fimDoContrato(cliente.data_inicio_contrato, cliente.contrato_meses)
  const situacao = situacaoDoContrato(fim, hoje)
  const data = formatarData(fim)
  return {
    texto: situacao === 'vencido' ? `Encerrou em ${data}` : `Encerra em ${data}`,
    tom: TOM[situacao],
  }
}
