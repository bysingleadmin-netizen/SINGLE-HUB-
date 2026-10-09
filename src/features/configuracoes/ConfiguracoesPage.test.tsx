vi.mock('@/lib/supabase', async () => {
  const { criarSupabaseFalso } = await import('@/test/supabaseFalso')
  return { supabase: criarSupabaseFalso() }
})

import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { Cargo } from '@/lib/permissoes'
import { bancoFalso, perfilDeTeste, renderizar } from '@/test/renderizar'
import { ConfiguracoesPage } from './ConfiguracoesPage'

function abrir(cargo: Cargo = 'CEO') {
  bancoFalso().reiniciar({
    profiles: [
      perfilDeTeste(cargo),
      { ...perfilDeTeste('Designer'), id: 'u2', nome: 'Bia Souza', email: 'bia@single.com' },
    ],
  })
  return renderizar(<ConfiguracoesPage />, { cargo })
}

function equipe() {
  return within(screen.getByRole('region', { name: 'Equipe' }))
}

describe('meu perfil', () => {
  it('mostra nome, e-mail e cargo', async () => {
    abrir('Social Media')
    const perfil = within(screen.getByRole('region', { name: 'Meu perfil' }))
    expect(perfil.getByLabelText('Nome')).toHaveValue('Luan Uliana')
    expect(perfil.getByText('luan@single.com')).toBeInTheDocument()
    expect(perfil.getByText('Social Media')).toBeInTheDocument()
  })

  it('salva o nome', async () => {
    abrir()
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: '  Luan U.  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByText('Perfil atualizado.')).toBeInTheDocument()
    expect(bancoFalso().tabelas.profiles[0].nome).toBe('Luan U.')
  })

  it('não salva nome em branco', async () => {
    abrir()
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByText('Informe seu nome.')).toBeInTheDocument()
    expect(bancoFalso().tabelas.profiles[0].nome).toBe('Luan Uliana')
  })

  it('avisa quando o banco recusa', async () => {
    abrir()
    bancoFalso().erroEscrita = { message: 'negado' }
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Luan U.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByText('Não foi possível salvar o perfil.')).toBeInTheDocument()
  })

  it('recusa foto grande demais', async () => {
    abrir()
    const grande = new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'foto.png', { type: 'image/png' })
    fireEvent.change(screen.getByLabelText('Enviar foto'), { target: { files: [grande] } })
    expect(await screen.findByText('A imagem deve ter no máximo 2 MB.')).toBeInTheDocument()
    expect(bancoFalso().tabelas.profiles[0].avatar_url).toBeNull()
  })

  it('envia a foto para a pasta do próprio usuário', async () => {
    abrir()
    const foto = new File(['x'], 'foto.jpg', { type: 'image/jpeg' })
    fireEvent.change(screen.getByLabelText('Enviar foto'), { target: { files: [foto] } })
    expect(await screen.findByText('Foto atualizada.')).toBeInTheDocument()
    expect(bancoFalso().tabelas.profiles[0].avatar_url).toMatch(
      /^https:\/\/falso\.test\/avatars\/u1\//,
    )
  })
})

describe('equipe', () => {
  it('a liderança troca o cargo dos outros, mas não o próprio', async () => {
    abrir('Founder')
    const cargoDaBia = await equipe().findByLabelText('Cargo de Bia Souza')
    expect(cargoDaBia).toHaveValue('Designer')
    expect(equipe().queryByLabelText('Cargo de Luan Uliana')).not.toBeInTheDocument()

    fireEvent.change(cargoDaBia, { target: { value: 'Copywriter' } })
    expect(await screen.findByText('Cargo atualizado.')).toBeInTheDocument()
    expect(bancoFalso().tabelas.profiles[1].cargo).toBe('Copywriter')
  })

  it('desfaz e avisa quando o banco recusa a troca de cargo', async () => {
    abrir('CEO')
    const cargoDaBia = await equipe().findByLabelText('Cargo de Bia Souza')
    bancoFalso().erroEscrita = { message: 'Apenas a liderança pode alterar cargos.' }
    fireEvent.change(cargoDaBia, { target: { value: 'Copywriter' } })

    expect(await screen.findByText('Não foi possível atualizar o cargo.')).toBeInTheDocument()
    await waitFor(() => expect(equipe().getByLabelText('Cargo de Bia Souza')).toHaveValue('Designer'))
  })

  it('quem não é liderança vê a equipe sem poder editar', async () => {
    abrir('Designer')
    expect(await equipe().findByText('Bia Souza')).toBeInTheDocument()
    expect(equipe().queryByRole('combobox')).not.toBeInTheDocument()
    expect(equipe().getByText('bia@single.com')).toBeInTheDocument()
  })

  it('falha de leitura vira erro com tentar novamente', async () => {
    bancoFalso().reiniciar({ profiles: [perfilDeTeste()] })
    bancoFalso().erroLeitura = { message: 'sem rede' }
    renderizar(<ConfiguracoesPage />)
    expect(await screen.findByRole('alert')).toBeInTheDocument()

    bancoFalso().erroLeitura = null
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(await equipe().findByText('Luan Uliana')).toBeInTheDocument()
  })
})
