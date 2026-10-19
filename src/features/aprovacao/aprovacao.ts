import { normalizarUrl } from '@/dados/anexos'
import type { Opcao } from '@/lib/rotulos'
import type { Aprovacao, CardAttachment, ItemDeAprovacao, StatusAprovacao, TipoDeItem } from '@/types/database'

// Pedido de aprovação: a equipe junta os materiais de um card de Conteúdo (textos, imagens,
// vídeos e links) e manda ao cliente um link /aprovar/<token>, que abre sem login.

export const STATUS_APROVACAO: readonly Opcao<StatusAprovacao>[] = [
  { valor: 'pendente', rotulo: 'Aguardando cliente', tom: 'amarelo' },
  { valor: 'aprovado', rotulo: 'Aprovado', tom: 'verde' },
  { valor: 'revisao', rotulo: 'Revisão pedida', tom: 'laranja' },
  { valor: 'reprovado', rotulo: 'Reprovado', tom: 'vermelho' },
]

export const TIPOS_DE_ITEM: readonly { valor: TipoDeItem; rotulo: string }[] = [
  { valor: 'copy', rotulo: 'Texto (copy)' },
  { valor: 'imagem', rotulo: 'Imagem' },
  { valor: 'video', rotulo: 'Vídeo' },
  { valor: 'link', rotulo: 'Link' },
]

/** Um item como o formulário guarda: o arquivo escolhido ainda não foi enviado. */
export interface ItemDoForm {
  tipo: TipoDeItem
  label: string
  /** Texto do copy ou endereço colado */
  valor: string
  arquivo?: File
}

export function itemVazio(tipo: TipoDeItem = 'copy'): ItemDoForm {
  return { tipo, label: '', valor: '' }
}

/** Os anexos do card já entram como itens: imagem vira imagem, link vira link. */
export function itensDosAnexos(anexos: Pick<CardAttachment, 'tipo' | 'url' | 'nome'>[]): ItemDoForm[] {
  return anexos.map((anexo) => ({
    tipo: anexo.tipo === 'imagem' ? 'imagem' : 'link',
    label: anexo.nome ?? '',
    valor: anexo.url,
  }))
}

/**
 * Confere os itens antes de enviar. Devolve a mensagem do primeiro problema, ou null.
 * Imagem e vídeo valem com arquivo escolhido ou com endereço colado.
 */
export function problemaDosItens(itens: ItemDoForm[]): string | null {
  if (itens.length === 0) return 'Adicione ao menos um material.'
  for (const [i, item] of itens.entries()) {
    const nome = item.label.trim() || `o item ${i + 1}`
    if (item.tipo === 'copy') {
      if (item.valor.trim() === '') return `Escreva o texto de ${nome}.`
      continue
    }
    if (item.arquivo && item.tipo !== 'link') continue
    if (item.valor.trim() === '') {
      return item.tipo === 'link' ? `Cole o link de ${nome}.` : `Envie o arquivo ou cole o endereço de ${nome}.`
    }
    if (!normalizarUrl(item.valor)) return `O endereço de ${nome} não é um link válido.`
  }
  return null
}

/** O item como vai para o banco, com o endereço já do arquivo enviado. */
export function itemParaSalvar(item: ItemDoForm, enderecoDoArquivo?: string): ItemDeAprovacao {
  const valor =
    item.tipo === 'copy' ? item.valor.trim() : (enderecoDoArquivo ?? normalizarUrl(item.valor) ?? item.valor.trim())
  const label = item.label.trim()
  return { tipo: item.tipo, valor, ...(label ? { label } : {}) }
}

/**
 * Endereço oficial do sistema. O link vai sempre com ele, nunca com o endereço em que a equipe
 * está: os endereços de cada deploy da Vercel (singlehub-xxxx-single-hub.vercel.app) pedem login
 * da Vercel, e o cliente caía nessa tela.
 */
export const ENDERECO_PUBLICO = import.meta.env.VITE_URL_PUBLICA || 'https://singlehubos.vercel.app'

export function linkDaAprovacao(token: string, origem: string = ENDERECO_PUBLICO): string {
  return `${origem.replace(/\/+$/, '')}/aprovar/${token}`
}

export function mensagemDoWhatsapp(titulo: string, link: string): string {
  return `Olá! O material "${titulo}" está pronto para a sua aprovação. É só abrir o link: ${link}`
}

/** O pedido mais recente de cada card, que é o que o selo do quadro mostra. */
export function ultimaPorCard(aprovacoes: Aprovacao[]): Map<string, Aprovacao> {
  const porCard = new Map<string, Aprovacao>()
  for (const a of aprovacoes) {
    const atual = porCard.get(a.card_id)
    if (!atual || a.created_at > atual.created_at) porCard.set(a.card_id, a)
  }
  return porCard
}

/** O link já não abre. Antes da migration 0014 não há prazo do link: vale o do pedido. */
export function expirou(
  aprovacao: Pick<Aprovacao, 'expira_em' | 'link_expira_em'>,
  agora: Date = new Date(),
): boolean {
  return new Date(aprovacao.link_expira_em ?? aprovacao.expira_em).getTime() <= agora.getTime()
}

/** O que o portal recebe de aprovacao_por_token: só o que é do pedido. */
export interface PedidoPublico {
  titulo: string
  status: StatusAprovacao
  /** Vazio quando o link venceu ou já foi respondido */
  conteudo: ItemDeAprovacao[]
  comentario: string | null
  respondido_em: string | null
  /** Migration 0014: nome do cliente, o link venceu (24 horas), já foi respondido */
  cliente?: string | null
  expirado?: boolean
  respondido?: boolean
}

export type RespostaDoPortal = 'ok' | 'invalido' | 'expirado' | 'ja_respondido' | 'comentario_obrigatorio'
