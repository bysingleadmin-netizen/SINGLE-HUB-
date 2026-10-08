import { variaveisFaltando } from './env'

describe('variaveisFaltando', () => {
  it('lista as duas variáveis quando nada está definido', () => {
    expect(variaveisFaltando({})).toEqual(['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'])
  })

  it('trata valor só com espaços como ausente', () => {
    expect(
      variaveisFaltando({
        VITE_SUPABASE_URL: 'https://x.supabase.co',
        VITE_SUPABASE_ANON_KEY: '   ',
      }),
    ).toEqual(['VITE_SUPABASE_ANON_KEY'])
  })

  it('retorna vazio quando tudo está preenchido', () => {
    expect(
      variaveisFaltando({
        VITE_SUPABASE_URL: 'https://x.supabase.co',
        VITE_SUPABASE_ANON_KEY: 'k',
      }),
    ).toEqual([])
  })
})
