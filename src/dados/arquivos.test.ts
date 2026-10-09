vi.mock('@/lib/supabase', () => ({ supabase: {} }))

import { validarImagem } from './arquivos'

describe('validarImagem', () => {
  it('aceita imagens pequenas', () => {
    expect(validarImagem({ type: 'image/png', size: 100_000 })).toBeNull()
    expect(validarImagem({ type: 'image/svg+xml', size: 5_000 })).toBeNull()
  })

  it('recusa o que não é imagem', () => {
    expect(validarImagem({ type: 'application/pdf', size: 1_000 })).toBe(
      'Envie uma imagem PNG, JPG, WEBP ou SVG.',
    )
  })

  it('recusa imagem acima de 2 MB', () => {
    expect(validarImagem({ type: 'image/jpeg', size: 2 * 1024 * 1024 + 1 })).toBe(
      'A imagem deve ter no máximo 2 MB.',
    )
  })
})
