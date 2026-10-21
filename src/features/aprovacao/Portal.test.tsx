vi.mock('@/lib/supabase', async () => {
  const { criarSupabaseFalso } = await import('@/test/supabaseFalso')
  return { supabase: criarSupabaseFalso() }
})

import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { ConteudoPage } from '@/features/conteudo/ConteudoPage'
import { bancoFalso, perfilDeTeste, renderizar } from '@/test/renderizar'
import { AprovarPage } from './AprovarPage'
import type { PedidoPublico } from './aprovacao'

const TOKEN = '6f1c2a9e-3b7d-4c51-9a2e-1d4b8f0c7e33'

const PEDIDO: PedidoPublico = {
  titulo: 'Post de lançamento',
  status: 'pendente',
  conteudo: [
    { tipo: 'copy', label: 'Legenda — opção 1', valor: 'Chegou a nova coleção!\nVem conferir.' },
    { tipo: 'imagem', label: 'Arte do feed', valor: 'https://cdn.test/arte1.png' },
    { tipo: 'imagem', valor: 'https://cdn.test/arte2.png' },
    { tipo: 'video', label: 'Reels', valor: 'https://cdn.test/reels.mp4' },
    { tipo: 'video', label: 'Vídeo do Drive', valor: 'https://drive.google.com/file/d/abc123/view?usp=sharing' },
    { tipo: 'link', label: 'Prévia no Figma', valor: 'https://www.figma.com/file/x' },
  ],
  comentario: null,
  respondido_em: null,
  cliente: 'Conecta',
  expirado: false,
  respondido: false,
}

function abrirPortal(pedido: PedidoPublico | null = PEDIDO, resposta = 'ok', token = TOKEN) {
  bancoFalso().reiniciar()
  bancoFalso().rpcs = {
    aprovacao_por_token: () => pedido,
    responder_aprovacao: () => resposta,
  }
  renderizar(
    <Routes>
      <Route path="/aprovar/:token" element={<AprovarPage />} />
    </Routes>,
    { rota: `/aprovar/${token}` },
  )
}

const resposta = () => bancoFalso().funcoesChamadas.find((c) => c.nome === 'responder_aprovacao')?.body

describe('portal de aprovação', () => {
  it('mostra cada material num card: texto com quebras e copiar, imagens, vídeo e link', async () => {
    abrirPortal()
    expect(await screen.findByRole('heading', { name: 'Post de lançamento' })).toBeInTheDocument()
    expect(bancoFalso().funcoesChamadas[0]).toEqual({ nome: 'aprovacao_por_token', body: { p_token: TOKEN } })

    const copy = within(screen.getByRole('article', { name: 'Legenda — opção 1' }))
    expect(copy.getByText(/Chegou a nova coleção!/)).toHaveTextContent('Chegou a nova coleção! Vem conferir.')
    expect(copy.getByRole('button', { name: 'Copiar' })).toBeInTheDocument()
    // Item sem nome ganha o tipo com o número
    expect(screen.getByRole('article', { name: 'Imagem 3' })).toBeInTheDocument()
    const video = screen.getByRole('article', { name: 'Reels' }).querySelector('video')!
    expect(video).toHaveAttribute('src', 'https://cdn.test/reels.mp4#t=0.1')
    expect(video).toHaveAttribute('playsinline')
    // Link do Drive é uma página, não o arquivo: o vídeo toca no player do Drive dentro do card
    const drive = within(screen.getByRole('article', { name: 'Vídeo do Drive' }))
    expect(drive.getByTitle('Vídeo do Drive')).toHaveAttribute('src', 'https://drive.google.com/file/d/abc123/preview')
    expect(drive.getByRole('link', { name: /Abrir em drive.google.com/ })).toHaveAttribute(
      'href',
      'https://drive.google.com/file/d/abc123/view?usp=sharing',
    )
    expect(screen.getByRole('link', { name: 'figma.com' })).toHaveAttribute('href', 'https://www.figma.com/file/x')
  })

  it('imagem abre em tela cheia e passa para a próxima', async () => {
    abrirPortal()
    fireEvent.click(await screen.findByRole('button', { name: 'Ampliar Arte do feed' }))
    const lightbox = within(screen.getByRole('dialog', { name: 'Imagem: Arte do feed' }))
    expect(lightbox.getByText('1 de 2')).toBeInTheDocument()
    fireEvent.click(lightbox.getByRole('button', { name: 'Próxima imagem' }))
    expect(screen.getByRole('dialog', { name: 'Imagem: Imagem 3' })).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'ArrowLeft' })
    expect(screen.getByRole('dialog', { name: 'Imagem: Arte do feed' })).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('aprovar envia a resposta e mostra a confirmação', async () => {
    abrirPortal()
    fireEvent.click(await screen.findByRole('button', { name: 'Aprovar' }))
    expect(await screen.findByRole('heading', { name: 'Material aprovado!' })).toBeInTheDocument()
    expect(resposta()).toEqual({ p_token: TOKEN, p_status: 'aprovado', p_comentario: null })
  })

  it('revisão abre o comentário com foco e não envia sem ele', async () => {
    abrirPortal()
    fireEvent.click(await screen.findByRole('button', { name: 'Solicitar revisão' }))
    const campo = screen.getByLabelText('O que precisa mudar?')
    await waitFor(() => expect(campo).toHaveFocus())
    fireEvent.click(screen.getByRole('button', { name: 'Enviar pedido de revisão' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Conte o que precisa mudar.')
    expect(resposta()).toBeUndefined()

    fireEvent.change(campo, { target: { value: 'Trocar a foto do item 2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar pedido de revisão' }))
    expect(await screen.findByRole('heading', { name: 'Pedido de revisão enviado' })).toBeInTheDocument()
    expect(resposta()).toEqual({ p_token: TOKEN, p_status: 'revisao', p_comentario: 'Trocar a foto do item 2' })
  })

  it('reprovar pede confirmação, com motivo opcional, e Voltar desiste', async () => {
    abrirPortal()
    fireEvent.click(await screen.findByRole('button', { name: 'Reprovar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }))
    expect(screen.getByRole('button', { name: 'Aprovar' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reprovar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar reprovação' }))
    expect(await screen.findByRole('heading', { name: 'Resposta enviada' })).toBeInTheDocument()
    expect(resposta()).toMatchObject({ p_status: 'reprovado' })
  })

  it('link inexistente, expirado ou malformado mostra o aviso', async () => {
    abrirPortal(null)
    expect(await screen.findByRole('heading', { name: 'Link inválido ou expirado' })).toBeInTheDocument()
  })

  it('token que não é um UUID nem consulta o banco', async () => {
    abrirPortal(PEDIDO, 'ok', 'qualquer-coisa')
    expect(await screen.findByRole('heading', { name: 'Link inválido ou expirado' })).toBeInTheDocument()
    expect(bancoFalso().funcoesChamadas).toEqual([])
  })

  it('link vencido (24 horas) diz que expirou, sem mostrar o material', async () => {
    abrirPortal({ ...PEDIDO, conteudo: [], expirado: true, respondido: false, cliente: 'Conecta' })
    expect(await screen.findByRole('heading', { name: 'Este link expirou' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Aprovar' })).not.toBeInTheDocument()
  })

  it('quem já respondeu e abre depois do prazo vê a resposta dada, não o aviso de expirado', async () => {
    abrirPortal({ ...PEDIDO, status: 'aprovado', conteudo: [], expirado: true, respondido: true })
    expect(await screen.findByRole('heading', { name: 'Você já respondeu esta aprovação' })).toBeInTheDocument()
  })

  it('mostra o nome do cliente', async () => {
    abrirPortal({ ...PEDIDO, cliente: 'Conecta', expirado: false, respondido: false })
    expect(await screen.findByText('Aprovação de material · Conecta')).toBeInTheDocument()
  })

  it('se o link venceu enquanto estava aberto, a resposta leva ao aviso de expirado', async () => {
    abrirPortal(PEDIDO, 'expirado')
    fireEvent.click(await screen.findByRole('button', { name: 'Aprovar' }))
    bancoFalso().rpcs.aprovacao_por_token = () => ({ ...PEDIDO, conteudo: [], expirado: true, respondido: false })
    expect(await screen.findByRole('heading', { name: 'Este link expirou' })).toBeInTheDocument()
  })

  it('pedido já respondido mostra a resposta e não deixa responder de novo', async () => {
    abrirPortal({ ...PEDIDO, status: 'revisao', comentario: 'Trocar a cor', respondido: true, conteudo: [] })
    expect(await screen.findByRole('heading', { name: 'Você já respondeu esta aprovação' })).toBeInTheDocument()
    expect(screen.getByText('Trocar a cor')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Aprovar' })).not.toBeInTheDocument()
  })

  it('se o link expirou enquanto estava aberto, a resposta leva ao aviso', async () => {
    abrirPortal(PEDIDO, 'invalido')
    fireEvent.click(await screen.findByRole('button', { name: 'Aprovar' }))
    bancoFalso().rpcs.aprovacao_por_token = () => null
    expect(await screen.findByRole('heading', { name: 'Link inválido ou expirado' })).toBeInTheDocument()
  })
})

describe('aprovação no card de Conteúdo', () => {
  function popular(extra: Record<string, unknown[]> = {}) {
    bancoFalso().reiniciar({
      profiles: [perfilDeTeste()],
      clients: [
        { id: 'c1', nome: 'Conecta', status: 'ativo', mrr: 0, contato_telefone: '(27) 99999-0000', created_at: '2026-01-01' },
      ],
      content_cards: [
        {
          id: 'k1',
          titulo: 'Post de lançamento',
          tipo_conteudo: 'post',
          client_id: 'c1',
          responsavel_id: null,
          etapa: 'aguardando_aprovacao',
          data_entrega: null,
          observacoes: null,
          posicao: 1,
          created_at: '2026-10-01T00:00:00Z',
        },
      ],
      card_attachments: [
        { id: 'a1', quadro: 'conteudo', card_id: 'k1', tipo: 'imagem', url: 'https://cdn.test/arte.png', nome: 'arte.png', created_at: '2026-10-01' },
      ],
      aprovacoes: [],
      ...extra,
    })
  }

  async function abrirCard() {
    renderizar(<ConteudoPage />, { rota: '/app/conteudo?abrir=k1' })
    const painel = within(await screen.findByRole('dialog', { name: 'Post de lançamento' }))
    return within(await painel.findByRole('region', { name: 'Aprovação do cliente' }))
  }

  it('gera o link com os anexos do card e um texto, e mostra para copiar e mandar no WhatsApp', async () => {
    popular()
    const secao = await abrirCard()
    fireEvent.click(secao.getByRole('button', { name: 'Gerar link de aprovação' }))
    const modal = within(screen.getByRole('dialog', { name: 'Gerar link de aprovação' }))
    // O anexo do card já entra como imagem
    expect(modal.getByLabelText('ou cole o endereço')).toHaveValue('https://cdn.test/arte.png')
    fireEvent.click(modal.getByRole('button', { name: 'Texto (copy)' }))
    fireEvent.click(modal.getByRole('button', { name: 'Gerar link' }))
    expect(await modal.findByText('Escreva o texto de o item 2.')).toBeInTheDocument()
    fireEvent.change(modal.getByLabelText('Texto'), { target: { value: 'Chegou a coleção!' } })
    fireEvent.click(modal.getByRole('button', { name: 'Gerar link' }))

    const pronto = within(await screen.findByRole('dialog', { name: 'Link de aprovação pronto' }))
    const [linha] = bancoFalso().tabelas.aprovacoes
    expect(linha).toMatchObject({
      card_id: 'k1',
      client_id: 'c1',
      titulo: 'Post de lançamento',
      created_by: 'u1',
      conteudo: [
        { tipo: 'imagem', label: 'arte.png', valor: 'https://cdn.test/arte.png' },
        { tipo: 'copy', valor: 'Chegou a coleção!' },
      ],
    })
    // Sempre o endereço oficial, nunca o endereço em que a equipe está (os de deploy pedem login da Vercel)
    expect(pronto.getByLabelText('Link de aprovação')).toHaveValue(`https://singlehubos.vercel.app/aprovar/${linha.token}`)
    const whatsapp = pronto.getByRole('link', { name: 'Enviar no WhatsApp' }).getAttribute('href')!
    expect(whatsapp).toMatch(/^https:\/\/wa\.me\/5527999990000\?text=/)
    expect(decodeURIComponent(whatsapp)).toContain(`/aprovar/${linha.token}`)
  })

  it('envia o vídeo escolhido para o Storage e grava o endereço', async () => {
    popular({ card_attachments: [] })
    const secao = await abrirCard()
    fireEvent.click(secao.getByRole('button', { name: 'Gerar link de aprovação' }))
    const modal = within(screen.getByRole('dialog', { name: 'Gerar link de aprovação' }))
    fireEvent.change(modal.getByLabelText('Tipo'), { target: { value: 'video' } })
    const video = new File(['x'], 'reels.mp4', { type: 'video/mp4' })
    fireEvent.change(modal.getByLabelText(/Enviar vídeo/), { target: { files: [video] } })
    expect(modal.getByText('reels.mp4')).toBeInTheDocument()
    fireEvent.click(modal.getByRole('button', { name: 'Gerar link' }))
    await screen.findByRole('dialog', { name: 'Link de aprovação pronto' })
    const [item] = bancoFalso().tabelas.aprovacoes[0].conteudo as { tipo: string; valor: string; label: string }[]
    expect(item.tipo).toBe('video')
    expect(item.label).toBe('reels.mp4')
    expect(item.valor).toMatch(/^https:\/\/falso\.test\/anexos\/aprovacoes\/k1\/.+\.mp4$/)
  })

  it('mostra a resposta do cliente no card e o selo no quadro', async () => {
    popular({
      aprovacoes: [
        {
          id: 'p1',
          card_id: 'k1',
          client_id: 'c1',
          token: 't1',
          titulo: 'Post de lançamento',
          status: 'revisao',
          conteudo: [{ tipo: 'copy', valor: 'Oi' }],
          comentario: 'Trocar a foto',
          created_by: 'u1',
          created_at: '2026-10-18T10:00:00Z',
          respondido_em: '2026-10-18T12:00:00Z',
          expira_em: '2099-01-01T00:00:00Z',
          link_expira_em: '2099-01-01T00:00:00Z',
        },
      ],
    })
    const secao = await abrirCard()
    expect(secao.getByText('Revisão pedida')).toBeInTheDocument()
    expect(secao.getByText('Trocar a foto')).toBeInTheDocument()
    // Respondido: o link não aparece mais
    expect(secao.queryByLabelText('Link de aprovação')).not.toBeInTheDocument()
    const coluna = within(screen.getByRole('region', { name: 'Aguardando Aprovação' }))
    expect(coluna.getByText('Revisão pedida')).toBeInTheDocument()
  })

  it('fora de Aguardando Aprovação, explica onde gerar o link', async () => {
    popular()
    bancoFalso().tabelas.content_cards[0].etapa = 'editar'
    const secao = await abrirCard()
    expect(secao.queryByRole('button', { name: 'Gerar link de aprovação' })).not.toBeInTheDocument()
    expect(secao.getByText(/Mova o card para Aguardando Aprovação/)).toBeInTheDocument()
  })

  it('sem a migration 0013, o card não tem a seção', async () => {
    popular()
    bancoFalso().tabelasAusentes = ['aprovacoes']
    renderizar(<ConteudoPage />, { rota: '/app/conteudo?abrir=k1' })
    const painel = within(await screen.findByRole('dialog', { name: 'Post de lançamento' }))
    await painel.findByRole('region', { name: 'Anexos' })
    expect(painel.queryByRole('region', { name: 'Aprovação do cliente' })).not.toBeInTheDocument()
  })
})
