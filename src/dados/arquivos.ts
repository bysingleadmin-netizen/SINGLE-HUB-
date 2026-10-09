import { supabase } from '@/lib/supabase'

const TAMANHO_MAXIMO = 2 * 1024 * 1024
const TIPOS_ACEITOS = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']

export const ACEITA_IMAGENS = TIPOS_ACEITOS.join(',')

/** Devolve a mensagem de erro, ou null se o arquivo pode ser enviado. */
export function validarImagem(
  arquivo: Pick<File, 'type' | 'size'>,
  /** Limite em MB; logos e avatares ficam em 2, anexos de card aceitam mais */
  maximoMB = 2,
): string | null {
  if (!TIPOS_ACEITOS.includes(arquivo.type)) return 'Envie uma imagem PNG, JPG, WEBP ou SVG.'
  if (arquivo.size > (maximoMB === 2 ? TAMANHO_MAXIMO : maximoMB * 1024 * 1024)) {
    return `A imagem deve ter no máximo ${maximoMB} MB.`
  }
  return null
}

/** Envia a imagem para `bucket/pasta/` e devolve a URL pública. */
export async function enviarImagem(
  bucket: 'logos' | 'avatars' | 'anexos',
  pasta: string,
  arquivo: File,
): Promise<string> {
  const extensao = arquivo.name.includes('.') ? arquivo.name.split('.').pop() : 'png'
  // O sufixo aleatório evita que dois envios no mesmo milissegundo se sobrescrevam
  const caminho = `${pasta}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extensao}`
  const { error } = await supabase.storage
    .from(bucket)
    .upload(caminho, arquivo, { contentType: arquivo.type, upsert: true })
  if (error) throw error
  return supabase.storage.from(bucket).getPublicUrl(caminho).data.publicUrl
}
