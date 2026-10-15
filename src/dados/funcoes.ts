// Respostas das Edge Functions chamadas pelo app (supabase.functions.invoke)

/** Recusa esperada: a função responde 200 com o motivo em `erro` */
export interface Recusa {
  erro?: string
  detalhe?: string
}

export async function lerFalha(error: unknown): Promise<{ status?: number; corpo: Recusa | null }> {
  const contexto = (error as { context?: { status?: number; json?: () => Promise<unknown> } }).context
  let corpo: Recusa | null = null
  if (typeof contexto?.json === 'function') {
    try {
      corpo = (await contexto.json()) as Recusa
    } catch {
      // resposta sem JSON
    }
  }
  return { status: contexto?.status, corpo }
}
