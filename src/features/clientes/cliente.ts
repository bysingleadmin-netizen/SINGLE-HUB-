import { hojeISO, mesesCompletos } from '@/lib/datas'
import { emailValido, normalizarLink, textoOuNull } from '@/lib/formulario'
import type { Erros, Validacao } from '@/lib/formulario'
import { formatarFidelidade, pagamentoAtrasado, parseMoeda } from '@/lib/regras'
import type { Client, ClientPayment, ClientStatus, PaymentStatus } from '@/types/database'

const VALOR_INVALIDO = 'Informe um valor como 1.500,00.'

export interface FormCliente {
  nome: string
  status: ClientStatus
  mrr: string
  data_inicio_contrato: string
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
    instagram: cliente.instagram ?? '',
    link_conta_anuncios: cliente.link_conta_anuncios ?? '',
    contato_nome: cliente.contato_nome ?? '',
    contato_email: cliente.contato_email ?? '',
    contato_telefone: cliente.contato_telefone ?? '',
    observacoes: cliente.observacoes ?? '',
  }
}

export function validarCliente(form: FormCliente): Validacao<ValoresCliente, FormCliente> {
  const erros: Erros<FormCliente> = {}
  const nome = form.nome.trim()
  const mrr = form.mrr.trim() === '' ? 0 : parseMoeda(form.mrr)
  const link = normalizarLink(form.link_conta_anuncios)
  const email = textoOuNull(form.contato_email)

  if (nome === '') erros.nome = 'Informe o nome do cliente.'
  if (mrr == null) erros.mrr = VALOR_INVALIDO
  if (link === undefined) erros.link_conta_anuncios = 'Informe um link válido.'
  if (email && !emailValido(email)) erros.contato_email = 'Informe um e-mail válido.'
  if (Object.keys(erros).length > 0 || mrr == null || link === undefined) return { erros }

  return {
    valores: {
      nome,
      status: form.status,
      mrr,
      data_inicio_contrato: textoOuNull(form.data_inicio_contrato),
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

export interface FormPagamento {
  /** 'AAAA-MM', como entrega o campo de mês */
  mes: string
  valor: string
  vencimento: string
}

export type ValoresPagamento = Pick<
  ClientPayment,
  'mes_referencia' | 'valor' | 'data_vencimento' | 'status'
>

export function validarPagamento(form: FormPagamento): Validacao<ValoresPagamento, FormPagamento> {
  const erros: Erros<FormPagamento> = {}
  const valor = parseMoeda(form.valor)

  if (!/^\d{4}-\d{2}$/.test(form.mes)) erros.mes = 'Escolha o mês.'
  if (valor == null) erros.valor = VALOR_INVALIDO
  if (form.vencimento === '') erros.vencimento = 'Informe o vencimento.'
  if (Object.keys(erros).length > 0 || valor == null) return { erros }

  return {
    valores: {
      mes_referencia: `${form.mes}-01`,
      valor,
      data_vencimento: form.vencimento,
      status: 'pendente',
    },
  }
}

/** '2026-10-01' vira '10/2026'. */
export function formatarMes(iso: string): string {
  const [ano, mes] = iso.split('-')
  return `${mes}/${ano}`
}

/** Status a mostrar: um pendente vencido conta como atrasado. */
export function statusDoPagamento(
  pagamento: Pick<ClientPayment, 'status' | 'data_vencimento'>,
  hoje: string,
): PaymentStatus {
  return pagamentoAtrasado(pagamento, hoje) ? 'atrasado' : pagamento.status
}
