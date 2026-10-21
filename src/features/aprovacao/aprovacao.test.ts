import type { Aprovacao } from '@/types/database'
import {
  expirou,
  itemParaSalvar,
  itemVazio,
  itensDosAnexos,
  linkDaAprovacao,
  mensagemDoWhatsapp,
  problemaDosItens,
  ultimaPorCard,
  videoIncorporado,
} from './aprovacao'

describe('problemaDosItens', () => {
  it('pede ao menos um material', () => {
    expect(problemaDosItens([])).toBe('Adicione ao menos um material.')
  })

  it('texto precisa de conteúdo; link e endereço precisam ser da web', () => {
    expect(problemaDosItens([{ ...itemVazio('copy'), label: 'Legenda' }])).toBe('Escreva o texto de Legenda.')
    expect(problemaDosItens([itemVazio('link')])).toBe('Cole o link de o item 1.')
    expect(problemaDosItens([{ ...itemVazio('imagem'), valor: 'não é link' }])).toBe(
      'O endereço de o item 1 não é um link válido.',
    )
    expect(problemaDosItens([itemVazio('video')])).toBe('Envie o arquivo ou cole o endereço de o item 1.')
  })

  it('imagem e vídeo valem com arquivo escolhido', () => {
    const arquivo = new File(['x'], 'foto.png', { type: 'image/png' })
    expect(problemaDosItens([{ ...itemVazio('imagem'), arquivo }, { ...itemVazio('copy'), valor: 'Oi' }])).toBeNull()
  })
})

describe('itemParaSalvar', () => {
  it('limpa o texto, completa o link e usa o endereço do arquivo enviado', () => {
    expect(itemParaSalvar({ tipo: 'copy', label: ' Legenda ', valor: ' Olá\nmundo ' })).toEqual({
      tipo: 'copy',
      label: 'Legenda',
      valor: 'Olá\nmundo',
    })
    expect(itemParaSalvar({ tipo: 'link', label: '', valor: 'drive.google.com/x' })).toEqual({
      tipo: 'link',
      valor: 'https://drive.google.com/x',
    })
    expect(itemParaSalvar({ tipo: 'imagem', label: 'Arte', valor: '' }, 'https://cdn/arte.png')).toEqual({
      tipo: 'imagem',
      label: 'Arte',
      valor: 'https://cdn/arte.png',
    })
  })
})

describe('apoio', () => {
  it('anexos do card viram itens', () => {
    expect(
      itensDosAnexos([
        { tipo: 'imagem', url: 'https://cdn/a.png', nome: 'a.png' },
        { tipo: 'link', url: 'https://figma.com/x', nome: null },
      ]),
    ).toEqual([
      { tipo: 'imagem', label: 'a.png', valor: 'https://cdn/a.png' },
      { tipo: 'link', label: '', valor: 'https://figma.com/x' },
    ])
  })

  it('link e mensagem do WhatsApp', () => {
    const link = linkDaAprovacao('abc')
    expect(link).toBe('https://singlehubos.vercel.app/aprovar/abc')
    expect(linkDaAprovacao('abc', 'https://outro.com/')).toBe('https://outro.com/aprovar/abc')
    expect(mensagemDoWhatsapp('Post de Natal', link)).toContain('"Post de Natal"')
    expect(mensagemDoWhatsapp('Post de Natal', link)).toContain(link)
  })

  it('o selo do card usa o pedido mais recente', () => {
    const pedido = (id: string, card_id: string, created_at: string) => ({ id, card_id, created_at }) as Aprovacao
    const ultima = ultimaPorCard([
      pedido('1', 'k1', '2026-10-01T10:00:00Z'),
      pedido('2', 'k1', '2026-10-03T10:00:00Z'),
      pedido('3', 'k2', '2026-10-02T10:00:00Z'),
    ])
    expect(ultima.get('k1')?.id).toBe('2')
    expect(ultima.get('k2')?.id).toBe('3')
  })

  it('expirou compara com agora', () => {
    const agora = new Date('2026-10-19T12:00:00Z')
    expect(expirou({ expira_em: '2026-10-19T11:59:00Z' }, agora)).toBe(true)
    expect(expirou({ expira_em: '2026-11-18T12:00:00Z' }, agora)).toBe(false)
    // Com a migration 0014, vale o prazo do link (24 horas), não o do pedido
    expect(expirou({ expira_em: '2026-11-18T12:00:00Z', link_expira_em: '2026-10-19T11:00:00Z' }, agora)).toBe(true)
  })
})

describe('videoIncorporado', () => {
  it('link do Google Drive vira o player do Drive', () => {
    const preview = 'https://drive.google.com/file/d/1PHEzBDniJpO0tfc8q17FuQvsI1dNeV_r/preview'
    expect(videoIncorporado('https://drive.google.com/file/d/1PHEzBDniJpO0tfc8q17FuQvsI1dNeV_r/view?usp=sharing')).toBe(
      preview,
    )
    expect(videoIncorporado('https://drive.google.com/open?id=1PHEzBDniJpO0tfc8q17FuQvsI1dNeV_r')).toBe(preview)
    expect(videoIncorporado('https://drive.google.com/uc?id=1PHEzBDniJpO0tfc8q17FuQvsI1dNeV_r&export=download')).toBe(
      preview,
    )
  })

  it('YouTube e Vimeo viram o player deles', () => {
    expect(videoIncorporado('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ')
    expect(videoIncorporado('https://youtu.be/dQw4w9WgXcQ?si=x')).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ')
    expect(videoIncorporado('https://youtube.com/shorts/dQw4w9WgXcQ')).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ')
    expect(videoIncorporado('https://vimeo.com/76979871')).toBe('https://player.vimeo.com/video/76979871')
  })

  it('arquivo de vídeo continua no player do navegador', () => {
    expect(videoIncorporado('https://x.supabase.co/storage/v1/object/public/anexos/a/reels.mp4')).toBeNull()
    expect(videoIncorporado('https://drive.google.com/drive/folders/abc')).toBeNull()
    expect(videoIncorporado('não é link')).toBeNull()
  })
})
