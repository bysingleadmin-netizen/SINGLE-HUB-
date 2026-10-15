// Onde a sessão do Supabase fica guardada, conforme o "Lembrar minha conta" do login:
// marcado, no localStorage (continua ao fechar e abrir o navegador); desmarcado, no
// sessionStorage (some ao fechar a aba ou o navegador). A preferência fica no localStorage.

const PREFERENCIA = 'single:lembrar-conta'

/** O armazenamento do navegador, ou null onde ele não existe ou está bloqueado */
function armazenamento(qual: 'local' | 'session'): Storage | null {
  try {
    return qual === 'local' ? window.localStorage : window.sessionStorage
  } catch {
    return null
  }
}

export function lembrarConta(): boolean {
  try {
    return armazenamento('local')?.getItem(PREFERENCIA) === '1'
  } catch {
    return false
  }
}

export function definirLembrarConta(lembrar: boolean) {
  try {
    armazenamento('local')?.setItem(PREFERENCIA, lembrar ? '1' : '0')
  } catch {
    // sem armazenamento, a sessão dura até a aba fechar
  }
}

/**
 * Armazenamento que o cliente do Supabase usa para a sessão. Lê dos dois lugares (a sessão
 * pode ter sido gravada antes da preferência mudar) e grava só no lugar da preferência atual,
 * limpando o outro.
 */
export const armazenamentoDaSessao = {
  getItem(chave: string): string | null {
    try {
      return armazenamento('session')?.getItem(chave) ?? armazenamento('local')?.getItem(chave) ?? null
    } catch {
      return null
    }
  },
  setItem(chave: string, valor: string) {
    const [destino, outro] = lembrarConta() ? (['local', 'session'] as const) : (['session', 'local'] as const)
    try {
      armazenamento(destino)?.setItem(chave, valor)
      armazenamento(outro)?.removeItem(chave)
    } catch {
      // armazenamento cheio ou bloqueado: a sessão vale só enquanto a página estiver aberta
    }
  },
  removeItem(chave: string) {
    try {
      armazenamento('local')?.removeItem(chave)
      armazenamento('session')?.removeItem(chave)
    } catch {
      // nada a limpar
    }
  },
}
