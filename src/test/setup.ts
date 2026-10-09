import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
  // Preferências guardadas no navegador (menu recolhido, quadro ou lista) não vazam entre testes
  localStorage.clear()
})
