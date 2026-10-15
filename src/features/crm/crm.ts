import { textoOuNull } from '@/lib/formulario'
import type { Erros, Validacao } from '@/lib/formulario'
import { parseMoeda } from '@/lib/regras'
import type { EtapaDoLead, Lead } from '@/types/database'
import { DURACOES } from '@/features/clientes/contrato'

// CRM de leads. Quatro colunas fixas; "Cliente" nunca guarda card: soltar um lead nela abre a
// conversão, que cria o cliente e tira o lead do quadro.

export const ETAPAS_DO_LEAD: readonly { id: EtapaDoLead | 'cliente'; titulo: string }[] = [
  { id: 'leads', titulo: 'Leads' },
  { id: 'reuniao', titulo: 'Reunião' },
  { id: 'fechamento', titulo: 'Fechamento de contrato' },
  { id: 'cliente', titulo: 'Cliente' },
]

/** Link do WhatsApp com DDI do Brasil. Null se não houver um número que dê para discar. */
export function linkDoWhatsapp(telefone: string | null | undefined): string | null {
  const digitos = (telefone ?? '').replace(/\D/g, '')
  if (digitos.length < 10) return null
  const comPais = digitos.startsWith('55') && digitos.length >= 12 ? digitos : `55${digitos}`
  return `https://wa.me/${comPais}`
}

const MS_POR_DIA = 86_400_000

export function tempoNaEtapa(desde: string, agora: Date = new Date()): string {
  const dias = Math.floor((agora.getTime() - new Date(desde).getTime()) / MS_POR_DIA)
  if (dias < 1) return 'Na etapa desde hoje'
  return dias === 1 ? 'Na etapa há 1 dia' : `Na etapa há ${dias} dias`
}

/** Leads convertidos nos últimos 30 dias sobre leads criados nos últimos 30 dias. */
export function conversaoEm30Dias(
  leads: Pick<Lead, 'created_at' | 'convertido_em'>[],
  agora: Date = new Date(),
): { criados: number; convertidos: number; taxa: number | null } {
  const limite = agora.getTime() - 30 * MS_POR_DIA
  const noPeriodo = (iso: string | null) => iso != null && new Date(iso).getTime() >= limite
  const criados = leads.filter((l) => noPeriodo(l.created_at)).length
  const convertidos = leads.filter((l) => noPeriodo(l.convertido_em)).length
  return { criados, convertidos, taxa: criados > 0 ? convertidos / criados : null }
}

export interface FormConversao {
  nome: string
  mrr: string
  meses: string
  inicio: string
}

export interface ValoresConversao {
  nome: string
  mrr: number
  meses: number
  inicio: string
}

export function validarConversao(form: FormConversao): Validacao<ValoresConversao, FormConversao> {
  const erros: Erros<FormConversao> = {}
  const nome = form.nome.trim()
  const mrr = parseMoeda(form.mrr)
  const meses = Number(form.meses)
  if (nome === '') erros.nome = 'Informe o nome do cliente.'
  if (mrr == null || mrr < 0) erros.mrr = 'Informe um valor como 1.500,00.'
  if (!(DURACOES as readonly number[]).includes(meses)) erros.meses = 'Escolha a duração do contrato.'
  if (form.inicio.trim() === '') erros.inicio = 'Informe a data de início.'
  if (Object.keys(erros).length > 0 || mrr == null) return { erros }
  return { valores: { nome, mrr, meses, inicio: form.inicio } }
}

export interface FormLead {
  nome: string
  empresa: string
  telefone: string
  origem: string
}

export type ValoresLead = Pick<Lead, 'nome' | 'empresa' | 'telefone' | 'origem'>

export function validarLead(form: FormLead): Validacao<ValoresLead, FormLead> {
  const nome = form.nome.trim()
  if (nome === '') return { erros: { nome: 'Informe o nome do lead.' } }
  return {
    valores: {
      nome,
      empresa: textoOuNull(form.empresa),
      telefone: textoOuNull(form.telefone),
      origem: textoOuNull(form.origem),
    },
  }
}
