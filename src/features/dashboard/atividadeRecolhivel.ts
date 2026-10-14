// Atividade recente no Dashboard: recolhida mostra as 4 últimas; expandida, tudo das últimas
// 24 horas. O que é mais antigo só aparece no histórico completo. A escolha fica guardada no
// navegador para não voltar ao padrão a cada troca de página.

export const RECOLHIDA = 4
const JANELA_MS = 24 * 3_600_000
export const CHAVE_EXPANDIDA = 'single:atividade-expandida'

export function registrosVisiveis<T extends { created_at: string }>(
  registros: T[],
  expandida: boolean,
  agora: Date = new Date(),
): T[] {
  if (!expandida) return registros.slice(0, RECOLHIDA)
  const limite = agora.getTime() - JANELA_MS
  const recentes = registros.filter((r) => new Date(r.created_at).getTime() >= limite)
  // Um dia sem movimento não deixa o painel vazio
  return recentes.length > 0 ? recentes : registros.slice(0, RECOLHIDA)
}

/** Expandir mostraria mais do que a lista recolhida? */
export function temMaisNas24h<T extends { created_at: string }>(registros: T[], agora: Date = new Date()): boolean {
  return registrosVisiveis(registros, true, agora).length > RECOLHIDA
}

export function lerExpandida(): boolean {
  try {
    return localStorage.getItem(CHAVE_EXPANDIDA) === '1'
  } catch {
    return false
  }
}

export function guardarExpandida(valor: boolean): void {
  try {
    localStorage.setItem(CHAVE_EXPANDIDA, valor ? '1' : '0')
  } catch {
    // Sem armazenamento, a escolha vale só até sair da página
  }
}
