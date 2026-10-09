// Apoio aos formulários: cada tela valida com uma função pura que devolve
// os valores prontos para o banco ou os erros por campo.

export type Erros<F> = Partial<Record<keyof F, string>>

export type Validacao<V, F> = { valores: V } | { erros: Erros<F> }

export function textoOuNull(texto: string): string | null {
  const limpo = texto.trim()
  return limpo === '' ? null : limpo
}

/**
 * Aceita só endereços da web. Completa com https:// quando falta.
 * Null se vazio, undefined se não for um link válido.
 */
export function normalizarLink(texto: string): string | null | undefined {
  const limpo = texto.trim()
  if (limpo === '') return null
  try {
    const url = new URL(/^https?:\/\//i.test(limpo) ? limpo : `https://${limpo}`)
    return url.hostname.includes('.') ? url.href : undefined
  } catch {
    return undefined
  }
}

export function emailValido(texto: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(texto)
}
