import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/AuthContext'
import { supabase } from '@/lib/supabase'
import type { CardAttachment, QuadroId } from '@/types/database'
import { enviarImagem } from './arquivos'

// Anexos dos cards: links digitados e imagens enviadas.
//
// Ficam em uma tabela só (`card_attachments`) para Demandas e Conteúdo, com `quadro` dizendo
// de qual dos dois é o card; assim os dois quadros compartilham tela e regras. A imagem vai
// para o bucket `anexos` do Storage, na pasta do card, e a tabela guarda a URL pública.
// Tabela e bucket chegam com a migration 0003; sem ela, os quadros não mostram anexos.

// Códigos da API e do Postgres para "tabela não existe"
const TABELA_AUSENTE = new Set(['PGRST205', '42P01'])

export function useAnexos(quadro: QuadroId) {
  const consulta = useQuery({
    queryKey: ['card_attachments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('card_attachments')
        .select('*')
        .order('created_at', { ascending: true })
      if (error) {
        if (TABELA_AUSENTE.has(error.code ?? '')) return null
        throw error
      }
      return (data ?? []) as CardAttachment[]
    },
  })
  const porCard = new Map<string, CardAttachment[]>()
  for (const anexo of consulta.data ?? []) {
    if (anexo.quadro !== quadro) continue
    porCard.set(anexo.card_id, [...(porCard.get(anexo.card_id) ?? []), anexo])
  }
  return { porCard, disponivel: consulta.data != null }
}

/** Aceita só endereços da web e completa com https:// quando falta. Null se não for um link. */
export function normalizarUrl(texto: string): string | null {
  const limpo = texto.trim()
  if (limpo === '') return null
  try {
    const url = new URL(/^https?:\/\//i.test(limpo) ? limpo : `https://${limpo}`)
    return url.hostname.includes('.') ? url.href : null
  } catch {
    return null
  }
}

type NovoAnexo = { tipo: 'link'; url: string } | { tipo: 'imagem'; arquivo: File }

export function useAnexar(quadro: QuadroId, cardId: string) {
  const { perfil } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (novo: NovoAnexo) => {
      const url =
        novo.tipo === 'link' ? novo.url : await enviarImagem('anexos', `${quadro}/${cardId}`, novo.arquivo)
      const { error } = await supabase.from('card_attachments').insert({
        quadro,
        card_id: cardId,
        tipo: novo.tipo,
        url,
        nome: novo.tipo === 'imagem' ? novo.arquivo.name : null,
        created_by: perfil?.id ?? null,
      })
      if (error) throw error
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['card_attachments'] }),
  })
}

export function useRemoverAnexo() {
  const queryClient = useQueryClient()
  return useMutation({
    // O arquivo fica no Storage: a URL pode estar colada em outro lugar, e apagar o registro
    // já tira o anexo do card
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('card_attachments').delete().eq('id', id)
      if (error) throw error
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['card_attachments'] }),
  })
}

/** Nome curto para mostrar: o do arquivo ou o domínio do link. */
export function rotuloDoAnexo(anexo: Pick<CardAttachment, 'tipo' | 'url' | 'nome'>): string {
  if (anexo.nome) return anexo.nome
  try {
    return new URL(anexo.url).hostname.replace(/^www\./, '')
  } catch {
    return anexo.url
  }
}
