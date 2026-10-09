import type { Registro } from '@/dados/atividade'
import { textoOuNull } from '@/lib/formulario'
import type { Erros, Validacao } from '@/lib/formulario'
import { COLUNAS_CONTEUDO } from '@/lib/rotulos'
import type { ContentCard, ContentEtapa, TipoConteudo } from '@/types/database'

export interface FormCard {
  titulo: string
  tipo_conteudo: TipoConteudo
  client_id: string
  responsavel_id: string
  etapa: ContentEtapa
  data_entrega: string
  observacoes: string
}

export type ValoresCard = Pick<
  ContentCard,
  | 'titulo'
  | 'tipo_conteudo'
  | 'client_id'
  | 'responsavel_id'
  | 'etapa'
  | 'data_entrega'
  | 'observacoes'
>

export function formNovoCard(etapa: ContentEtapa): FormCard {
  return {
    titulo: '',
    tipo_conteudo: 'post',
    client_id: '',
    responsavel_id: '',
    etapa,
    data_entrega: '',
    observacoes: '',
  }
}

export function formDoCard(card: ContentCard): FormCard {
  return {
    titulo: card.titulo,
    tipo_conteudo: card.tipo_conteudo,
    client_id: card.client_id ?? '',
    responsavel_id: card.responsavel_id ?? '',
    etapa: card.etapa,
    data_entrega: card.data_entrega ?? '',
    observacoes: card.observacoes ?? '',
  }
}

export function validarCard(form: FormCard): Validacao<ValoresCard, FormCard> {
  const titulo = form.titulo.trim()
  if (titulo === '') {
    const erros: Erros<FormCard> = { titulo: 'Informe o título do conteúdo.' }
    return { erros }
  }
  return {
    valores: {
      titulo,
      tipo_conteudo: form.tipo_conteudo,
      client_id: textoOuNull(form.client_id),
      responsavel_id: textoOuNull(form.responsavel_id),
      etapa: form.etapa,
      data_entrega: textoOuNull(form.data_entrega),
      observacoes: textoOuNull(form.observacoes),
    },
  }
}

export function tituloDaEtapa(etapa: string): string {
  return COLUNAS_CONTEUDO.find((coluna) => coluna.id === etapa)?.titulo ?? etapa
}

/** O que registrar quando um card muda de etapa. Arquivar não entra no registro. */
export function atividadeDoMovimento(
  card: Pick<ContentCard, 'id' | 'titulo'>,
  destino: string,
): Registro | null {
  if (destino === 'arquivado') return null
  const publicado = destino === 'publicado'
  return {
    acao: publicado ? 'conteudo_publicado' : 'conteudo_movido',
    descricao: publicado
      ? `publicou o conteúdo "${card.titulo}"`
      : `moveu o conteúdo "${card.titulo}" para ${tituloDaEtapa(destino)}`,
    entidade: 'content_cards',
    entidadeId: card.id,
  }
}
