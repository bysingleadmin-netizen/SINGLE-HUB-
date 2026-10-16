vi.mock('@/lib/supabase', async () => {
  const { criarSupabaseFalso } = await import('@/test/supabaseFalso')
  return { supabase: criarSupabaseFalso() }
})

import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { Cargo } from '@/lib/permissoes'
import { bancoFalso, perfilDeTeste, renderizar } from '@/test/renderizar'
import { ConfiguracoesPage } from './ConfiguracoesPage'

function abrir(cargo: Cargo = 'Liderança') {
  bancoFalso().reiniciar({
    profiles: [
      perfilDeTeste(cargo),
      { ...perfilDeTeste('Colaborador'), id: 'u2', nome: 'Bia Souza', email: 'bia@single.com' },
    ],
  })
  return renderizar(<ConfiguracoesPage />, { cargo })
}

async function abrirEquipe(cargo: Cargo = 'Liderança') {
  abrir(cargo)
  fireEvent.click(screen.getByRole('tab', { name: 'Equipe' }))
  return within(await screen.findByRole('tabpanel', { name: 'Equipe' }))
}

describe('meu perfil', () => {
  it('mostra nome, e-mail e cargo', async () => {
    abrir('Colaborador')
    expect(screen.getByLabelText('Nome')).toHaveValue('Luan Uliana')
    expect(screen.getByText('luan@single.com')).toBeInTheDocument()
    expect(screen.getByText('Colaborador')).toBeInTheDocument()
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

describe('aparência', () => {
  it('começa no escuro e troca para o claro, guardando a escolha', () => {
    abrir('Colaborador')
    const grupo = within(screen.getByRole('group', { name: 'Tema' }))
    expect(grupo.getByRole('button', { name: 'Escuro' })).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(grupo.getByRole('button', { name: 'Claro' }))
    expect(grupo.getByRole('button', { name: 'Claro' })).toHaveAttribute('aria-pressed', 'true')
    expect(localStorage.getItem('tema')).toBe('claro')
    expect(document.documentElement).toHaveAttribute('data-theme', 'light')

    fireEvent.click(grupo.getByRole('button', { name: 'Escuro' }))
    expect(localStorage.getItem('tema')).toBe('escuro')
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
  })

  it('a liderança também acha a aparência na aba do perfil', () => {
    localStorage.setItem('tema', 'claro')
    abrir('Liderança')
    expect(screen.getByRole('button', { name: 'Claro' })).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('aba Equipe', () => {
  it('não existe para quem não é da liderança', () => {
    abrir('Colaborador')
    expect(screen.queryByRole('tab', { name: 'Equipe' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Convidar colaborador' })).not.toBeInTheDocument()
    expect(screen.queryByText('Bia Souza')).not.toBeInTheDocument()
  })

  it.each(['Liderança'] as const)('aparece para %s', (cargo) => {
    abrir(cargo)
    expect(screen.getByRole('tab', { name: 'Equipe' })).toBeInTheDocument()
  })

  it('lista a equipe e troca o cargo dos outros direto na lista, mas não o próprio', async () => {
    const equipe = await abrirEquipe('Liderança')
    const cargoDaBia = await equipe.findByLabelText('Cargo de Bia Souza')
    expect(cargoDaBia).toHaveValue('Colaborador')
    expect(equipe.getByText('bia@single.com')).toBeInTheDocument()
    expect(equipe.queryByLabelText('Cargo de Luan Uliana')).not.toBeInTheDocument()

    fireEvent.change(cargoDaBia, { target: { value: 'Colaborador' } })
    expect(await screen.findByText('Cargo atualizado.')).toBeInTheDocument()
    expect(bancoFalso().tabelas.profiles[1].cargo).toBe('Colaborador')
  })

  it('desfaz e avisa quando o banco recusa a troca de cargo', async () => {
    const equipe = await abrirEquipe()
    const cargoDaBia = await equipe.findByLabelText('Cargo de Bia Souza')
    bancoFalso().erroEscrita = { message: 'Apenas a liderança pode alterar cargos.' }
    fireEvent.change(cargoDaBia, { target: { value: 'Colaborador' } })

    expect(await screen.findByText('Não foi possível atualizar o cargo.')).toBeInTheDocument()
    await waitFor(() => expect(equipe.getByLabelText('Cargo de Bia Souza')).toHaveValue('Colaborador'))
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
      { nome: 'convidar-colaborador', body: { email: 'ana@single.com', cargo: 'Colaborador' } },
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

describe('convite com nome e cargo', () => {
  it('manda o nome para o e-mail cumprimentar a pessoa', async () => {
    const equipe = await abrirEquipe()
    fireEvent.click(equipe.getByRole('button', { name: 'Convidar colaborador' }))
    const convite = within(screen.getByRole('dialog', { name: 'Convidar colaborador' }))
    fireEvent.change(convite.getByLabelText('Nome'), { target: { value: ' Ana ' } })
    fireEvent.change(convite.getByLabelText('E-mail'), { target: { value: 'ana@single.com' } })
    fireEvent.click(convite.getByRole('button', { name: 'Enviar convite' }))
    await screen.findByText('Convite enviado para ana@single.com.')
    expect(bancoFalso().funcoesChamadas).toEqual([
      { nome: 'convidar-colaborador', body: { email: 'ana@single.com', nome: 'Ana', cargo: 'Colaborador' } },
    ])
  })

  it('o cargo da equipe usa a lista nova, mesmo com cargo antigo no banco', async () => {
    bancoFalso().reiniciar({
      profiles: [perfilDeTeste('Liderança'), { ...perfilDeTeste('Colaborador'), id: 'u2', nome: 'Bia Souza', cargo: 'Designer' }],
    })
    renderizar(<ConfiguracoesPage />, { cargo: 'Liderança' })
    fireEvent.click(screen.getByRole('tab', { name: 'Equipe' }))
    expect(await screen.findByLabelText('Cargo de Bia Souza')).toHaveValue('Colaborador')
  })
})

describe('remover colaborador', () => {
  it('pede confirmação, chama a função do servidor e avisa', async () => {
    const equipe = await abrirEquipe()
    fireEvent.click(await equipe.findByRole('button', { name: 'Remover Bia Souza' }))
    // Nada acontece antes de confirmar
    expect(bancoFalso().funcoesChamadas).toEqual([])
    const confirmacao = within(equipe.getByRole('group', { name: 'Confirmar exclusão de Bia Souza' }))
    expect(confirmacao.getByText(/perde o acesso ao sistema na hora e recebe um e-mail/)).toBeInTheDocument()
    bancoFalso().respostaDaFuncao = { ok: true, emailEnviado: true }
    fireEvent.click(confirmacao.getByRole('button', { name: 'Excluir' }))
    expect(await screen.findByText('Bia Souza foi removido da equipe e avisado por e-mail.')).toBeInTheDocument()
    expect(bancoFalso().funcoesChamadas).toEqual([{ nome: 'remover-colaborador', body: { id: 'u2' } }])
  })

  it('cancelar não remove', async () => {
    const equipe = await abrirEquipe()
    fireEvent.click(await equipe.findByRole('button', { name: 'Remover Bia Souza' }))
    fireEvent.click(equipe.getByRole('button', { name: 'Cancelar' }))
    expect(equipe.queryByRole('group', { name: 'Confirmar exclusão de Bia Souza' })).not.toBeInTheDocument()
    expect(bancoFalso().funcoesChamadas).toEqual([])
  })

  it('ninguém remove a si mesmo', async () => {
    const equipe = await abrirEquipe()
    await equipe.findByRole('button', { name: 'Remover Bia Souza' })
    expect(equipe.queryByRole('button', { name: 'Remover Luan Uliana' })).not.toBeInTheDocument()
  })

  it('mostra a recusa da função', async () => {
    const equipe = await abrirEquipe()
    fireEvent.click(await equipe.findByRole('button', { name: 'Remover Bia Souza' }))
    bancoFalso().respostaDaFuncao = { erro: 'Apenas a liderança pode remover colaboradores.' }
    fireEvent.click(equipe.getByRole('button', { name: 'Excluir' }))
    expect(await screen.findByText('Apenas a liderança pode remover colaboradores.')).toBeInTheDocument()
  })
})
