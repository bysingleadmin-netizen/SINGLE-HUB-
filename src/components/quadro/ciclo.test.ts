import { datasDoCiclo, diasParaExcluir, venceuOPrazoVisivel } from './ciclo'

const AGORA = new Date('2026-10-20T12:00:00Z')

function diasAtras(dias: number): string {
  return new Date(AGORA.getTime() - dias * 86_400_000).toISOString()
}

describe('venceuOPrazoVisivel', () => {
  it('card em aberto nunca vence', () => {
    expect(venceuOPrazoVisivel({ concluded_at: null }, AGORA)).toBe(false)
    expect(venceuOPrazoVisivel({}, AGORA)).toBe(false)
  })

  it('concluído fica 7 dias no quadro e depois sai', () => {
    expect(venceuOPrazoVisivel({ concluded_at: diasAtras(6) }, AGORA)).toBe(false)
    expect(venceuOPrazoVisivel({ concluded_at: diasAtras(7) }, AGORA)).toBe(true)
  })
})

describe('diasParaExcluir', () => {
  it('conta 30 dias a partir do arquivamento', () => {
    expect(diasParaExcluir({ archived_at: diasAtras(0) }, AGORA)).toBe(30)
    expect(diasParaExcluir({ archived_at: diasAtras(29) }, AGORA)).toBe(1)
    expect(diasParaExcluir({ archived_at: diasAtras(45) }, AGORA)).toBe(0)
  })

  it('sem data de arquivamento, conta do fim dos 7 dias de concluído', () => {
    expect(diasParaExcluir({ concluded_at: diasAtras(8) }, AGORA)).toBe(29)
  })

  it('sem nenhuma data, não há prazo', () => {
    expect(diasParaExcluir({}, AGORA)).toBeNull()
  })
})

describe('datasDoCiclo', () => {
  const instante = AGORA.toISOString()

  it('chegar à última coluna conclui o card', () => {
    expect(datasDoCiclo('concluido', 'concluido', AGORA)).toEqual({
      concluded_at: instante,
      archived_at: null,
    })
  })

  it('arquivar à mão não mexe na data de conclusão', () => {
    expect(datasDoCiclo('arquivado', 'concluido', AGORA)).toEqual({ archived_at: instante })
  })

  it('voltar para uma coluna em aberto limpa as duas datas', () => {
    expect(datasDoCiclo('a_fazer', 'concluido', AGORA)).toEqual({
      concluded_at: null,
      archived_at: null,
    })
  })
})
