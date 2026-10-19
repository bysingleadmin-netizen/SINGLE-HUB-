import { hojeISO, mesesCompletos } from '@/lib/datas'
import { emailValido, normalizarLink, textoOuNull } from '@/lib/formulario'
import type { Erros, Validacao } from '@/lib/formulario'
import { formatarFidelidade, parseMoeda } from '@/lib/regras'
import { semAcentos } from '@/lib/texto'
import type { Client, ClientStatus, ContatoDoCliente } from '@/types/database'

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
  /** Segmento do cliente. Migration 0012 */
  area_atuacao: string
  /** ids de quem da SINGLE cuida do cliente. Migration 0012 */
  responsaveis: string[]
  /** Sem a migration 0012, só o primeiro é salvo */
  contatos: FormContato[]
  observacoes: string
}

export interface FormContato {
  nome: string
  funcao: string
  email: string
  telefone: string
}

export function contatoVazio(): FormContato {
  return { nome: '', funcao: '', email: '', telefone: '' }
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
    area_atuacao: '',
    responsaveis: [],
    contatos: [contatoVazio()],
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
    area_atuacao: cliente.area_atuacao ?? '',
    responsaveis: cliente.responsaveis ?? [],
    contatos: formDosContatos(contatosDe(cliente)),
    observacoes: cliente.observacoes ?? '',
  }
}

function formDosContatos(contatos: ContatoDoCliente[]): FormContato[] {
  if (contatos.length === 0) return [contatoVazio()]
  return contatos.map((c) => ({
    nome: c.nome,
    funcao: c.funcao ?? '',
    email: c.email ?? '',
    telefone: c.telefone ?? '',
  }))
}

/**
 * Os contatos do cliente. Antes da migration 0012, ou num cliente que ainda não ganhou a lista
 * (a conversão de lead grava só contato_nome e contato_telefone), vale o contato único.
 */
export function contatosDe(
  cliente: Pick<Client, 'contato_nome' | 'contato_email' | 'contato_telefone' | 'contatos'>,
): ContatoDoCliente[] {
  if (cliente.contatos && cliente.contatos.length > 0) return cliente.contatos
  if (!cliente.contato_nome && !cliente.contato_email && !cliente.contato_telefone) return []
  return [
    {
      nome: cliente.contato_nome ?? '',
      email: cliente.contato_email,
      telefone: cliente.contato_telefone,
    },
  ]
}

/**
 * `comVencimento` diz se o banco já tem a coluna `dia_vencimento` (migration 0002);
 * `comContrato`, a `contrato_meses` (migration 0004); `comCnpj`, a `cnpj` (migration 0007); e
 * `comBase`, as de área, responsáveis e contatos (migration 0012).
 * Sem ela, o campo nem entra nos valores, para o cadastro continuar salvando.
 */
export function validarCliente(
  form: FormCliente,
  {
    comVencimento = false,
    comContrato = false,
    comCnpj = false,
    comBase = false,
  }: { comVencimento?: boolean; comContrato?: boolean; comCnpj?: boolean; comBase?: boolean } = {},
): Validacao<ValoresCliente, FormCliente> {
  const erros: Erros<FormCliente> = {}
  const nome = form.nome.trim()
  const mrr = form.mrr.trim() === '' ? 0 : parseMoeda(form.mrr)
  const link = normalizarLink(form.link_conta_anuncios)
  const contatos = (comBase ? form.contatos : form.contatos.slice(0, 1))
    .map((c) => ({
      nome: c.nome.trim(),
      funcao: textoOuNull(c.funcao),
      email: textoOuNull(c.email),
      telefone: textoOuNull(c.telefone),
    }))
    // Linha toda em branco é contato que a pessoa abriu e não preencheu
    .filter((c) => c.nome !== '' || c.funcao || c.email || c.telefone)

  if (nome === '') erros.nome = 'Informe o nome do cliente.'
  if (mrr == null) erros.mrr = VALOR_INVALIDO
  if (link === undefined) erros.link_conta_anuncios = 'Informe um link válido.'
  // O contato único de antes da 0012 pode não ter nome: só o e-mail ou o telefone
  if (comBase && contatos.some((c) => c.nome === '')) erros.contatos = 'Informe o nome de cada contato.'
  const semEmail = contatos.find((c) => c.email && !emailValido(c.email))
  if (semEmail) {
    erros.contatos = semEmail.nome
      ? `Informe um e-mail válido para ${semEmail.nome}.`
      : 'Informe um e-mail válido.'
  }
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
      // O primeiro contato também fica nas colunas que o resto do app lê
      contato_nome: textoOuNull(contatos[0]?.nome ?? ''),
      contato_email: contatos[0]?.email ?? null,
      contato_telefone: contatos[0]?.telefone ?? null,
      ...(comBase
        ? {
            area_atuacao: textoOuNull(form.area_atuacao),
            responsaveis: form.responsaveis,
            contatos: contatos.map((c) => ({
              nome: c.nome,
              ...(c.funcao ? { funcao: c.funcao } : {}),
              ...(c.email ? { email: c.email } : {}),
              ...(c.telefone ? { telefone: c.telefone } : {}),
            })),
          }
        : {}),
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

/** Meses completos desde o início do contrato; null sem data de início. */
export function mesesDeCasa(cliente: Pick<Client, 'data_inicio_contrato'>, hoje: string): number | null {
  return cliente.data_inicio_contrato ? mesesCompletos(cliente.data_inicio_contrato, hoje) : null
}

/** Ativos são os de status ativo; inativos, os pausados e os que saíram (churn). */
export type FiltroDeStatus = 'todos' | 'ativos' | 'inativos'

/** Clientes cujo nome tem o texto buscado (sem diferenciar acentos) e que passam no filtro. */
export function filtrarClientes<C extends Pick<Client, 'nome' | 'status'>>(
  clientes: C[],
  busca: string,
  status: FiltroDeStatus,
): C[] {
  const termo = semAcentos(busca.trim())
  return clientes.filter(
    (c) =>
      (status === 'todos' || (status === 'ativos') === (c.status === 'ativo')) &&
      semAcentos(c.nome).includes(termo),
  )
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
