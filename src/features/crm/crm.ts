import { textoOuNull } from '@/lib/formulario'
import type { Erros, Validacao } from '@/lib/formulario'
import { parseMoeda } from '@/lib/regras'
import type { Tom } from '@/lib/rotulos'
import type { EtapaDoLead, Lead, TemperaturaDoLead } from '@/types/database'
import { DURACOES } from '@/features/clientes/contrato'

// CRM de leads. Quatro colunas fixas; "Cliente" nunca guarda card: soltar um lead nela abre a
// conversão, que cria o cliente e tira o lead do quadro.

export const ETAPAS_DO_LEAD: readonly { id: EtapaDoLead | 'cliente'; titulo: string }[] = [
  { id: 'leads', titulo: 'Leads' },
  { id: 'reuniao', titulo: 'Reunião' },
  { id: 'fechamento', titulo: 'Fechamento de contrato' },
  { id: 'cliente', titulo: 'Cliente' },
]

/** Temperatura do lead: o quanto ele está perto de fechar */
export const TEMPERATURAS: readonly { valor: TemperaturaDoLead; rotulo: string; tom: Tom }[] = [
  { valor: 'frio', rotulo: 'Frio', tom: 'azul' },
  { valor: 'morno', rotulo: 'Morno', tom: 'amarelo' },
  { valor: 'quente', rotulo: 'Quente', tom: 'vermelho' },
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

type LeadDoGrafico = Pick<Lead, 'etapa' | 'temperatura' | 'segmento' | 'convertido_em'>

/** Leads no pipeline de cada etapa, separados por temperatura: o funil do CRM. */
export function temperaturaPorEtapa(leads: LeadDoGrafico[]) {
  return ETAPAS_DO_LEAD.filter((etapa) => etapa.id !== 'cliente').map((etapa) => {
    const daEtapa = leads.filter((lead) => lead.convertido_em == null && lead.etapa === etapa.id)
    const valores = Object.fromEntries(
      TEMPERATURAS.map((t) => [t.valor, daEtapa.filter((lead) => (lead.temperatura ?? 'frio') === t.valor).length]),
    )
    return { chave: etapa.id, rotulo: etapa.titulo, valores }
  })
}

export interface FatiaDeSegmento {
  valor: string
  rotulo: string
  total: number
}

/**
 * Leads no pipeline por segmento: os `limite` maiores com nome próprio e o resto, junto com
 * quem não tem segmento, em "Outros". Grafias diferentes do mesmo segmento contam juntas.
 */
export function leadsPorSegmento(leads: LeadDoGrafico[], limite = 5): FatiaDeSegmento[] {
  const grupos = new Map<string, FatiaDeSegmento>()
  let outros = 0
  for (const lead of leads) {
    if (lead.convertido_em != null) continue
    const nome = lead.segmento?.trim()
    if (!nome) {
      outros++
      continue
    }
    const chave = nome.toLocaleLowerCase('pt-BR')
    const grupo = grupos.get(chave) ?? { valor: chave, rotulo: nome, total: 0 }
    grupo.total++
    grupos.set(chave, grupo)
  }
  const ordenados = [...grupos.values()].sort((a, b) => b.total - a.total || a.rotulo.localeCompare(b.rotulo))
  outros += ordenados.slice(limite).reduce((soma, grupo) => soma + grupo.total, 0)
  return [
    ...ordenados.slice(0, limite),
    ...(outros > 0 ? [{ valor: 'outros', rotulo: 'Outros', total: outros }] : []),
  ]
}
