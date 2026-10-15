import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { MotionGlobalConfig } from 'framer-motion'
import { afterEach } from 'vitest'

// O jsdom não desenha quadros: as animações do Framer Motion terminariam nunca. Nos testes
// elas pulam direto para o fim, e o que sai da tela sai na hora.
MotionGlobalConfig.skipAnimations = true

afterEach(() => {
  cleanup()
  // Preferências guardadas no navegador (menu recolhido, quadro ou lista) não vazam entre testes
  localStorage.clear()
})
