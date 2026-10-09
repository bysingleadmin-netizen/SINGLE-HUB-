import { atividadeDoMovimento, formNovoCard, validarCard } from './card'

describe('validarCard', () => {
  it('exige o título', () => {
    expect(validarCard({ ...formNovoCard('editar'), titulo: '' })).toEqual({
      erros: { titulo: 'Informe o título do conteúdo.' },
    })
  })

  it('troca os campos em branco por null', () => {
    expect(
      validarCard({
        ...formNovoCard('captar_material'),
        titulo: ' Reels de lançamento ',
        tipo_conteudo: 'reels',
        responsavel_id: 'u1',
        data_entrega: '2026-10-20',
      }),
    ).toEqual({
      valores: {
        titulo: 'Reels de lançamento',
        tipo_conteudo: 'reels',
        client_id: null,
        responsavel_id: 'u1',
        etapa: 'captar_material',
        data_entrega: '2026-10-20',
        observacoes: null,
      },
    })
  })
})

describe('atividadeDoMovimento', () => {
  const card = { id: 'k1', titulo: 'Carrossel' }

  it('publicar tem registro próprio', () => {
    expect(atividadeDoMovimento(card, 'publicado')).toEqual({
      acao: 'conteudo_publicado',
      descricao: 'publicou o conteúdo "Carrossel"',
      entidade: 'content_cards',
      entidadeId: 'k1',
    })
  })

  it('as outras etapas registram o movimento', () => {
    expect(atividadeDoMovimento(card, 'editar')).toMatchObject({
      acao: 'conteudo_movido',
      descricao: 'moveu o conteúdo "Carrossel" para Editar',
    })
  })

  it('arquivar não gera registro', () => {
    expect(atividadeDoMovimento(card, 'arquivado')).toBeNull()
  })
})
