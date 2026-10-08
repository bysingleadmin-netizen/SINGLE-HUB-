import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ConfiguracaoPendente } from '@/features/config/ConfiguracaoPendente'
import { variaveisFaltando } from '@/lib/env'
import './styles/global.css'

const raiz = createRoot(document.getElementById('root')!)
const faltando = variaveisFaltando(import.meta.env)

if (faltando.length > 0) {
  raiz.render(
    <StrictMode>
      <ConfiguracaoPendente faltando={faltando} />
    </StrictMode>,
  )
} else {
  // O app (e o cliente Supabase) só é carregado com as variáveis presentes.
  void import('./App').then(({ default: App }) => {
    raiz.render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  })
}
