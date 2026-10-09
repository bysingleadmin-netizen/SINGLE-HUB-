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

async function abrirEquipe(cargo: Cargo = 'CEO') {
  abrir(cargo)
  fireEvent.click(screen.getByRole('tab', { name: 'Equipe' }))
  return within(await screen.findByRole('tabpanel', { name: 'Equipe' }))
}

describe('meu perfil', () => {
  it('mostra nome, e-mail e cargo', async () => {
    abrir('Social Media')
    expect(screen.getByLabelText('Nome')).toHaveValue('Luan Uliana')
    expect(screen.getByText('luan@single.com')).toBeInTheDocument()
    expect(screen.getByText('Social Media')).toBeInTheDocument()
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

describe('aba Equipe', () => {
  it('não existe para quem não é da liderança', () => {
    abrir('Designer')
    expect(screen.queryByRole('tab', { name: 'Equipe' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Convidar colaborador' })).not.toBeInTheDocument()
    expect(screen.queryByText('Bia Souza')).not.toBeInTheDocument()
  })

  it.each(['CEO', 'Founder', 'Co-Founder'] as const)('aparece para %s', (cargo) => {
    abrir(cargo)
    expect(screen.getByRole('tab', { name: 'Equipe' })).toBeInTheDocument()
  })

  it('lista a equipe e troca o cargo dos outros direto na lista, mas não o próprio', async () => {
    const equipe = await abrirEquipe('Founder')
    const cargoDaBia = await equipe.findByLabelText('Cargo de Bia Souza')
    expect(cargoDaBia).toHaveValue('Designer')
    expect(equipe.getByText('bia@single.com')).toBeInTheDocument()
    expect(equipe.queryByLabelText('Cargo de Luan Uliana')).not.toBeInTheDocument()

    fireEvent.change(cargoDaBia, { target: { value: 'Copywriter' } })
    expect(await screen.findByText('Cargo atualizado.')).toBeInTheDocument()
    expect(bancoFalso().tabelas.profiles[1].cargo).toBe('Copywriter')
  })

  it('desfaz e avisa quando o banco recusa a troca de cargo', async () => {
    const equipe = await abrirEquipe()
    const cargoDaBia = await equipe.findByLabelText('Cargo de Bia Souza')
    bancoFalso().erroEscrita = { message: 'Apenas a liderança pode alterar cargos.' }
    fireEvent.change(cargoDaBia, { target: { value: 'Copywriter' } })

    expect(await screen.findByText('Não foi possível atualizar o cargo.')).toBeInTheDocument()
    await waitFor(() => expect(equipe.getByLabelText('Cargo de Bia Souza')).toHaveValue('Designer'))
  })

  it('falha de leitura vira erro com tentar novamente', async () => {
    bancoFalso().reiniciar({ profiles: [perfilDeTeste()] })
    bancoFalso().erroLeitura = { message: 'sem rede' }
    renderizar(<ConfiguracoesPage />)
    fireEvent.click(screen.getByRole('tab', { name: 'Equipe' }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()

    bancoFalso().erroLeitura = null
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(
      await within(screen.getByRole('tabpanel', { name: 'Equipe' })).findByText('Luan Uliana'),
    ).toBeInTheDocument()
  })
})

describe('convidar colaborador', () => {
  async function abrirConvite() {
    const equipe = await abrirEquipe()
    fireEvent.click(equipe.getByRole('button', { name: 'Convidar colaborador' }))
    return within(screen.getByRole('dialog', { name: 'Convidar colaborador' }))
  }

  it('pede o convite à função do servidor e confirma', async () => {
    const convite = await abrirConvite()
    fireEvent.change(convite.getByLabelText('E-mail'), { target: { value: ' ana@single.com ' } })
    fireEvent.click(convite.getByRole('button', { name: 'Enviar convite' }))

    expect(await screen.findByText('Convite enviado para ana@single.com.')).toBeInTheDocument()
    expect(bancoFalso().funcoesChamadas).toEqual([
      // O cargo escolhido no modal vai junto; sem mexer, é o padrão
      { nome: 'convidar-colaborador', body: { email: 'ana@single.com', cargo: 'Social Media' } },
    ])
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('não envia e-mail inválido', async () => {
    const convite = await abrirConvite()
    fireEvent.change(convite.getByLabelText('E-mail'), { target: { value: 'ana' } })
    fireEvent.click(convite.getByRole('button', { name: 'Enviar convite' }))
    expect(await convite.findByText('Informe um e-mail válido.')).toBeInTheDocument()
    expect(bancoFalso().funcoesChamadas).toHaveLength(0)
  })

  it('explica quando a função de convite ainda não foi publicada', async () => {
    const convite = await abrirConvite()
    bancoFalso().erroDaFuncao = { message: 'Not found', context: { status: 404 } }
    fireEvent.change(convite.getByLabelText('E-mail'), { target: { value: 'ana@single.com' } })
    fireEvent.click(convite.getByRole('button', { name: 'Enviar convite' }))
    expect(
      await screen.findByText(
        'A função de convite ainda não foi publicada no Supabase. Veja docs/INTEGRACOES.md.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Convidar colaborador' })).toBeInTheDocument()
  })

  it('mostra o motivo quando o servidor recusa', async () => {
    const convite = await abrirConvite()
    bancoFalso().respostaDaFuncao = { erro: 'Este e-mail já tem acesso ao sistema.' }
    fireEvent.change(convite.getByLabelText('E-mail'), { target: { value: 'bia@single.com' } })
    fireEvent.click(convite.getByRole('button', { name: 'Enviar convite' }))
    expect(await screen.findByText('Este e-mail já tem acesso ao sistema.')).toBeInTheDocument()
  })
})
