// Tema claro ou escuro, escolhido em Configurações e lembrado no navegador.
// O index.html aplica o tema salvo antes do app carregar, para a tela não piscar escura;
// a mesma regra está aqui para o app e para os testes.

export type Tema = 'escuro' | 'claro'

const CHAVE = 'tema'

// Cor da barra do navegador no celular, igual ao fundo de cada tema
const COR_DA_BARRA: Record<Tema, string> = { escuro: '#0a0a0a', claro: '#f4f4f6' }

/** O tema salvo; escuro quando não há nada salvo ou o navegador bloqueia o armazenamento. */
export function lerTema(): Tema {
  try {
    return localStorage.getItem(CHAVE) === 'claro' ? 'claro' : 'escuro'
  } catch {
    return 'escuro'
  }
}

export function aplicarTema(tema: Tema) {
  document.documentElement.setAttribute('data-theme', tema === 'claro' ? 'light' : 'dark')
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', COR_DA_BARRA[tema])
}

export function salvarTema(tema: Tema) {
  try {
    localStorage.setItem(CHAVE, tema)
  } catch {
    // Sem armazenamento o tema vale só até recarregar a página
  }
  aplicarTema(tema)
}
