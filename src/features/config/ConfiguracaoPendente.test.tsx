import { render, screen } from '@testing-library/react'
import { ConfiguracaoPendente } from './ConfiguracaoPendente'

describe('ConfiguracaoPendente', () => {
  it('lista exatamente as variáveis que faltam', () => {
    render(<ConfiguracaoPendente faltando={['VITE_SUPABASE_ANON_KEY']} />)
    expect(screen.getByRole('heading', { name: 'Configuração pendente' })).toBeInTheDocument()
    expect(screen.getByText('VITE_SUPABASE_ANON_KEY')).toBeInTheDocument()
    expect(screen.queryByText('VITE_SUPABASE_URL')).not.toBeInTheDocument()
  })

  it('lista as duas quando as duas faltam', () => {
    render(<ConfiguracaoPendente faltando={['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']} />)
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })
})
