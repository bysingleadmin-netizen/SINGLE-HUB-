import { hojeISO, mesesCompletos } from '@/lib/datas'
import { emailValido, normalizarLink, textoOuNull } from '@/lib/formulario'
import type { Erros, Validacao } from '@/lib/formulario'
import { formatarFidelidade, parseMoeda } from '@/lib/regras'
import type { Client, ClientStatus } from '@/types/database'

const VALOR_INVALIDO = 'Informe um valor como 1.500,00.'

export interface FormCliente {
  nome: string
  status: ClientStatus
  mrr: string
  data_inicio_contrato: string
  /** '1' a '31', ou vazio para seguir o dia do início do contrato */
  dia_vencimento: string
  /** '3', '6', '12', '15' ou vazio */
  contrato_meses: string
  /** CNPJ ou CPF, como digitado */
  cnpj: string
  instagram: string
  link_conta_anuncios: string
  contato_nome: string
  contato_email: string
  contato_telefone: string
  observacoes: string
}

export type ValoresCliente = Omit<Client, 'id' | 'created_at' | 'logo_url'>

export function formVazio(): FormCliente {
  return {
    nome: '',
    status: 'ativo',
    mrr: '',
    data_inicio_contrato: '',
    dia_vencimento: '',
    contrato_meses: '',
    cnpj: '',
    instagram: '',
    link_conta_anuncios: '',
    contato_nome: '',
    contato_email: '',
    contato_telefone: '',
    observacoes: '',
  }
}

export function moedaParaCampo(valor: number): string {
  return Number(valor).toFixed(2).replace('.', ',')
}

export function formDoCliente(cliente: Client): FormCliente {
  return {
    nome: cliente.nome,
    status: cliente.status,
    mrr: moedaParaCampo(cliente.mrr),
    data_inicio_contrato: cliente.data_inicio_contrato ?? '',
    dia_vencimento: cliente.dia_vencimento ? String(cliente.dia_vencimento) : '',
    contrato_meses: cliente.contrato_meses ? String(cliente.contrato_meses) : '',
    cnpj: cliente.cnpj ?? '',
    instagram: cliente.instagram ?? '',
    link_conta_anuncios: cliente.link_conta_anuncios ?? '',
    contato_nome: cliente.contato_nome ?? '',
    contato_email: cliente.contato_email ?? '',
    contato_telefone: cliente.contato_telefone ?? '',
    observacoes: cliente.observacoes ?? '',
  }
}

/**
 * `comVencimento` diz se o banco já tem a coluna `dia_vencimento` (migration 0002);
 * `comContrato`, a `contrato_meses` (migration 0004); e `comCnpj`, a `cnpj` (migration 0007).
 * Sem ela, o campo nem entra nos valores, para o cadastro continuar salvando.
 */
export function validarCliente(
  form: FormCliente,
  {
    comVencimento = false,
    comContrato = false,
    comCnpj = false,
  }: { comVencimento?: boolean; comContrato?: boolean; comCnpj?: boolean } = {},
): Validacao<ValoresCliente, FormCliente> {
  const erros: Erros<FormCliente> = {}
  const nome = form.nome.trim()
  const mrr = form.mrr.trim() === '' ? 0 : parseMoeda(form.mrr)
  const link = normalizarLink(form.link_conta_anuncios)
  const email = textoOuNull(form.contato_email)

  if (nome === '') erros.nome = 'Informe o nome do cliente.'
  if (mrr == null) erros.mrr = VALOR_INVALIDO
  if (link === undefined) erros.link_conta_anuncios = 'Informe um link válido.'
  if (email && !emailValido(email)) erros.contato_email = 'Informe um e-mail válido.'
  const diaTexto = form.dia_vencimento.trim()
  const dia = diaTexto === '' ? null : Number(diaTexto)
  if (comVencimento && dia != null && !(Number.isInteger(dia) && dia >= 1 && dia <= 31)) {
    erros.dia_vencimento = 'Informe um dia entre 1 e 31.'
  }
  const cnpj = textoOuNull(form.cnpj)
  const digitos = (cnpj ?? '').replace(/\D/g, '')
  if (comCnpj && cnpj && digitos.length !== 14 && digitos.length !== 11) {
    erros.cnpj = 'Informe um CNPJ com 14 dígitos ou um CPF com 11.'
  }
  if (Object.keys(erros).length > 0 || mrr == null || link === undefined) return { erros }

  return {
    valores: {
      nome,
      status: form.status,
      mrr,
      data_inicio_contrato: textoOuNull(form.data_inicio_contrato),
      ...(comVencimento ? { dia_vencimento: dia } : {}),
      ...(comContrato
        ? { contrato_meses: form.contrato_meses === '' ? null : Number(form.contrato_meses) }
        : {}),
      ...(comCnpj ? { cnpj } : {}),
      instagram: textoOuNull(form.instagram),
      link_conta_anuncios: link,
      contato_nome: textoOuNull(form.contato_nome),
      contato_email: email,
      contato_telefone: textoOuNull(form.contato_telefone),
      observacoes: textoOuNull(form.observacoes),
    },
  }
}

/** Endereço do perfil a partir de "@nome", "nome" ou do link completo. Null se não for um perfil. */
export function linkInstagram(valor: string | null | undefined): string | null {
  const usuario = (valor ?? '')
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^(www\.)?instagram\.com\//i, '')
    .replace(/^@/, '')
    .replace(/\/+$/, '')
  return /^[A-Za-z0-9._]+$/.test(usuario) ? `https://instagram.com/${usuario}` : null
}

export function fidelidadeDoCliente(cliente: Pick<Client, 'data_inicio_contrato'>): string {
  return cliente.data_inicio_contrato
    ? formatarFidelidade(mesesCompletos(cliente.data_inicio_contrato, hojeISO()))
    : 'Sem data de início'
}

/** '2026-10-01' vira '10/2026'. */
export function formatarMes(iso: string): string {
  const [ano, mes] = iso.split('-')
  return `${mes}/${ano}`
}

/** Nome da plataforma de um link de conta de anúncios, para o link não aparecer cru. */
export function plataformaDoLink(link: string): string {
  const host = link.replace(/^https?:\/\//i, '').split('/')[0].toLowerCase()
  if (/facebook\.com|meta\.com|fb\.com/.test(host)) return 'Meta Ads (Gerenciador de Anúncios)'
  if (/google\./.test(host)) return 'Google Ads'
  if (/tiktok\./.test(host)) return 'TikTok Ads'
  if (/linkedin\./.test(host)) return 'LinkedIn Ads'
  return host || 'Abrir conta de anúncios'
}
