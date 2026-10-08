export const VARIAVEIS_OBRIGATORIAS = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'] as const

export function variaveisFaltando(env: Record<string, unknown>): string[] {
  return VARIAVEIS_OBRIGATORIAS.filter((nome) => {
    const valor = env[nome]
    return typeof valor !== 'string' || valor.trim() === ''
  })
}
