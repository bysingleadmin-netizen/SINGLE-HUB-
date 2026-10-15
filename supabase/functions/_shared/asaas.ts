// Regras do Asaas usadas pelas Edge Functions asaas-webhook e asaas-sync, sem nada do Deno nem
// do Supabase: as funções usam e os testes do app (vitest) conferem.

export interface PagamentoAsaas {
  id: string
  customer?: string | null
  /** Nem sempre vem: a cobrança do Asaas traz só o id do cliente */
  customerName?: string | null
  description?: string | null
  value?: number | null
  dueDate?: string | null
  paymentDate?: string | null
  /** Data em que o cliente pagou (pode vir antes de o dinheiro cair) */
  clientPaymentDate?: string | null
  /** Cartão: confirmado antes de o dinheiro cair */
  confirmedDate?: string | null
  status?: string | null
  billingType?: string | null
  subscription?: string | null
}

export interface EventoAsaas {
  event?: string
  payment?: PagamentoAsaas
}

/** Cliente como o Asaas guarda (GET /customers) */
export interface ClienteAsaas {
  id: string
  name?: string | null
  cpfCnpj?: string | null
}

/** Cliente daqui, como a tabela clients guarda */
export interface ClienteDaqui {
  id: string
  nome: string
  cnpj?: string | null
  asaas_customer_id?: string | null
}

export interface LinhaDaCobranca {
  asaas_id: string
  asaas_customer_id: string | null
  nome_cliente_asaas: string | null
  descricao: string | null
  valor: number | null
  data_vencimento: string | null
  data_pagamento: string | null
  status: string | null
  forma_pagamento: string | null
  tipo: string | null
  atualizado_em: string
}

/**
 * O header asaas-access-token bate com o segredo? Sem segredo configurado, nada passa.
 * A comparação percorre tudo, para o tempo de resposta não revelar quanto do token acertou.
 */
export function tokenValido(recebido: string | null, esperado: string | undefined): boolean {
  if (!esperado || recebido == null) return false
  const a = new TextEncoder().encode(recebido)
  const b = new TextEncoder().encode(esperado)
  let diferenca = a.length ^ b.length
  for (let i = 0; i < b.length; i++) diferenca |= (a[i] ?? 0) ^ b[i]
  return diferenca === 0
}

/**
 * A linha de receitas_asaas de uma cobrança. O nome do cliente vem do cadastro do Asaas quando
 * ele é conhecido, porque a cobrança em si quase nunca traz o nome.
 */
export function linhaDoPagamento(
  pagamento: PagamentoAsaas,
  agora: string,
  cliente?: ClienteAsaas | null,
): LinhaDaCobranca {
  return {
    asaas_id: pagamento.id,
    asaas_customer_id: pagamento.customer ?? null,
    nome_cliente_asaas: cliente?.name ?? pagamento.customerName ?? null,
    descricao: pagamento.description ?? null,
    valor: pagamento.value ?? null,
    data_vencimento: pagamento.dueDate ?? null,
    data_pagamento: pagamento.paymentDate ?? pagamento.clientPaymentDate ?? pagamento.confirmedDate ?? null,
    status: pagamento.status ?? null,
    forma_pagamento: pagamento.billingType ?? null,
    tipo: pagamento.subscription ? 'SUBSCRIPTION' : (pagamento.billingType ?? null),
    atualizado_em: agora,
  }
}

/** A linha de um evento de cobrança (PAYMENT_*); null para os outros eventos. */
export function linhaDaCobranca(
  evento: EventoAsaas,
  agora: string,
  cliente?: ClienteAsaas | null,
): LinhaDaCobranca | null {
  const pagamento = evento.payment
  if (!evento.event?.startsWith('PAYMENT_') || !pagamento?.id) return null
  const linha = linhaDoPagamento(pagamento, agora, cliente)
  // Na exclusão o Asaas manda a cobrança como ela estava; aqui ela passa a contar como excluída
  return evento.event === 'PAYMENT_DELETED' ? { ...linha, status: 'DELETED' } : linha
}

export const somenteDigitos = (texto: string | null | undefined) => (texto ?? '').replace(/\D/g, '')

/** Palavras do nome, minúsculas e sem acento nem pontuação */
function palavras(nome: string | null | undefined): string[] {
  return (nome ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .split(/\s+/)
    .map((palavra) => palavra.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(Boolean)
}

export interface Vinculo {
  clienteId: string
  /** O id do Asaas ainda não está no cliente daqui e deve ser gravado nele */
  gravarId: boolean
}

/**
 * O cliente daqui de um cliente do Asaas, nesta ordem:
 * 1. pelo id do Asaas já gravado no cliente;
 * 2. pelo CPF/CNPJ, só os dígitos;
 * 3. pelas duas primeiras palavras do nome, sem acento.
 * Em 2 e 3, só quando um único cliente casar e ele ainda não estiver ligado a outro cliente do
 * Asaas: na dúvida, a cobrança fica sem vínculo e a liderança vincula à mão.
 */
export function acharClienteDoAsaas(clientes: ClienteDaqui[], asaas: ClienteAsaas): Vinculo | null {
  const ligado = clientes.find((cliente) => cliente.asaas_customer_id === asaas.id)
  if (ligado) return { clienteId: ligado.id, gravarId: false }

  const unicoLivre = (candidatos: ClienteDaqui[]): Vinculo | null =>
    candidatos.length === 1 && !candidatos[0].asaas_customer_id
      ? { clienteId: candidatos[0].id, gravarId: true }
      : null

  const documento = somenteDigitos(asaas.cpfCnpj)
  if (documento.length >= 11) {
    const porDocumento = clientes.filter((cliente) => somenteDigitos(cliente.cnpj) === documento)
    if (porDocumento.length > 0) return unicoLivre(porDocumento)
  }

  const termo = palavras(asaas.name).slice(0, 2).join(' ')
  if (termo.length < 3) return null
  return unicoLivre(clientes.filter((cliente) => palavras(cliente.nome).join(' ').includes(termo)))
}

/**
 * Liga cada cliente do Asaas a um cliente daqui. Um cliente daqui recebe um só id do Asaas:
 * depois de ligado a um, ele não casa com os seguintes por CNPJ ou nome.
 */
export function vincularClientes(
  clientes: ClienteDaqui[],
  doAsaas: ClienteAsaas[],
): Map<string, Vinculo> {
  const copia = clientes.map((cliente) => ({ ...cliente }))
  const vinculos = new Map<string, Vinculo>()
  for (const asaas of doAsaas) {
    const vinculo = acharClienteDoAsaas(copia, asaas)
    if (!vinculo) continue
    vinculos.set(asaas.id, vinculo)
    const cliente = copia.find((c) => c.id === vinculo.clienteId)
    if (cliente) cliente.asaas_customer_id = asaas.id
  }
  return vinculos
}

// API REST do Asaas (https://docs.asaas.com). A chave vai no header access_token.

export const API_ASAAS = 'https://api.asaas.com/v3'

/** Contas novas do Asaas recusam chamadas sem User-Agent */
const CABECALHOS = (chave: string) => ({
  access_token: chave,
  'User-Agent': 'SINGLE-OS',
  'Content-Type': 'application/json',
})

export class FalhaDoAsaas extends Error {
  constructor(
    readonly status: number,
    mensagem: string,
  ) {
    super(mensagem)
  }
}

type Buscar = (url: string, init: RequestInit) => Promise<Response>

async function pedir<T>(buscar: Buscar, url: string, chave: string): Promise<T> {
  const resposta = await buscar(url, { headers: CABECALHOS(chave) })
  if (!resposta.ok) {
    const corpo = await resposta.text().catch(() => '')
    throw new FalhaDoAsaas(resposta.status, `Asaas respondeu ${resposta.status}: ${corpo.slice(0, 300)}`)
  }
  return (await resposta.json()) as T
}

/** Limite de páginas, para um hasMore que nunca acaba não prender a função */
const MAXIMO_DE_PAGINAS = 200

/** Todas as páginas de uma listagem (/payments, /customers), de 100 em 100. */
export async function listarTudo<T>(
  base: string,
  caminho: string,
  chave: string,
  buscar: Buscar = fetch,
): Promise<T[]> {
  const itens: T[] = []
  for (let pagina = 0; pagina < MAXIMO_DE_PAGINAS; pagina++) {
    const separador = caminho.includes('?') ? '&' : '?'
    const url = `${base}${caminho}${separador}limit=100&offset=${pagina * 100}`
    const lista = await pedir<{ data?: T[]; hasMore?: boolean }>(buscar, url, chave)
    itens.push(...(lista.data ?? []))
    if (!lista.hasMore) break
  }
  return itens
}

/** Um cliente do Asaas pelo id; null se o Asaas não achar. */
export async function buscarClienteAsaas(
  base: string,
  id: string,
  chave: string,
  buscar: Buscar = fetch,
): Promise<ClienteAsaas | null> {
  try {
    return await pedir<ClienteAsaas>(buscar, `${base}/customers/${encodeURIComponent(id)}`, chave)
  } catch (falha) {
    if (falha instanceof FalhaDoAsaas && falha.status === 404) return null
    throw falha
  }
}
