import { ETAPAS_DO_LEAD, conversaoEm30Dias, linkDoWhatsapp, tempoNaEtapa, validarConversao, validarLead } from './crm'

describe('linkDoWhatsapp', () => {
  it('acrescenta o 55 só quando falta', () => {
    expect(linkDoWhatsapp('(27) 99999-0000')).toBe('https://wa.me/5527999990000')
    expect(linkDoWhatsapp('+55 27 99999-0000')).toBe('https://wa.me/5527999990000')
    expect(linkDoWhatsapp('5527999990000')).toBe('https://wa.me/5527999990000')
    expect(linkDoWhatsapp('27 3333-4444')).toBe('https://wa.me/552733334444')
  })

  it('sem número que dê para discar, não há link', () => {
    expect(linkDoWhatsapp('')).toBeNull()
    expect(linkDoWhatsapp(null)).toBeNull()
    expect(linkDoWhatsapp('abc')).toBeNull()
    expect(linkDoWhatsapp('9999')).toBeNull()
  })
})

describe('tempoNaEtapa', () => {
  const AGORA = new Date('2026-10-14T12:00:00Z')
  it('em dias', () => {
    expect(tempoNaEtapa('2026-10-14T08:00:00Z', AGORA)).toBe('Na etapa desde hoje')
    expect(tempoNaEtapa('2026-10-13T08:00:00Z', AGORA)).toBe('Na etapa há 1 dia')
    expect(tempoNaEtapa('2026-10-11T08:00:00Z', AGORA)).toBe('Na etapa há 3 dias')
  })
})

describe('conversaoEm30Dias', () => {
  const AGORA = new Date('2026-10-14T12:00:00Z')
  it('convertidos no período sobre criados no período', () => {
    expect(
      conversaoEm30Dias(
        [
          { created_at: '2026-10-01T00:00:00Z', convertido_em: '2026-10-10T00:00:00Z' },
          { created_at: '2026-10-02T00:00:00Z', convertido_em: null },
          { created_at: '2026-10-03T00:00:00Z', convertido_em: null },
          { created_at: '2026-10-04T00:00:00Z', convertido_em: null },
          { created_at: '2026-08-01T00:00:00Z', convertido_em: '2026-08-05T00:00:00Z' },
        ],
        AGORA,
      ),
    ).toEqual({ criados: 4, convertidos: 1, taxa: 0.25 })
  })

  it('sem leads criados no período, a taxa não existe', () => {
    expect(conversaoEm30Dias([], AGORA).taxa).toBeNull()
  })
})

describe('validações', () => {
  it('conversão exige todos os campos', () => {
    expect(validarConversao({ nome: 'Scofield', mrr: '2.870,00', meses: '12', inicio: '2026-10-01' })).toEqual({
      valores: { nome: 'Scofield', mrr: 2870, meses: 12, inicio: '2026-10-01' },
    })
    expect(validarConversao({ nome: ' ', mrr: '', meses: '', inicio: '' })).toEqual({
      erros: {
        nome: 'Informe o nome do cliente.',
        mrr: 'Informe um valor como 1.500,00.',
        meses: 'Escolha a duração do contrato.',
        inicio: 'Informe a data de início.',
      },
    })
  })

  it('lead exige o nome', () => {
    expect(validarLead({ nome: '', empresa: '', telefone: '', origem: '' })).toEqual({ erros: { nome: 'Informe o nome do lead.' } })
    expect(validarLead({ nome: 'Ana', empresa: ' Scofield ', telefone: '', origem: 'Instagram' })).toEqual({
      valores: { nome: 'Ana', empresa: 'Scofield', telefone: null, origem: 'Instagram' },
    })
  })

  it('quatro colunas fixas, a última é Cliente', () => {
    expect(ETAPAS_DO_LEAD.map((e) => e.titulo)).toEqual(['Leads', 'Reunião', 'Fechamento de contrato', 'Cliente'])
  })
})
