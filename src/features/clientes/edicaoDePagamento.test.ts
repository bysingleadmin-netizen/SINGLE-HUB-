import { formDoCartao, validarEdicaoDePagamento } from './edicaoDePagamento'

const form = (campos = {}) => ({ valor: '2.870,00', valorPago: '2.000,00', pagoEm: '2026-10-05', observacao: '', ...campos })

describe('validarEdicaoDePagamento', () => {
  it('aceita pagamento parcial', () => {
    expect(validarEdicaoDePagamento(form())).toEqual({
      valores: { valor: 2870, valorPago: 2000, pagoEm: '2026-10-05', observacao: null },
    })
  })

  it('pago vazio vale zero e dispensa a data', () => {
    expect(validarEdicaoDePagamento(form({ valorPago: '', pagoEm: '' }))).toEqual({
      valores: { valor: 2870, valorPago: 0, pagoEm: null, observacao: null },
    })
  })

  it('recusa total inválido, pago maior que o total e pago sem data', () => {
    expect(validarEdicaoDePagamento(form({ valor: 'abc' }))).toEqual({ erros: { valor: 'Informe um valor como 1.500,00.' } })
    expect(validarEdicaoDePagamento(form({ valorPago: '3.000,00' }))).toEqual({
      erros: { valorPago: 'O valor pago não pode passar do total.' },
    })
    expect(validarEdicaoDePagamento(form({ pagoEm: '' }))).toEqual({ erros: { pagoEm: 'Informe a data do pagamento.' } })
  })
})

describe('formDoCartao', () => {
  it('preenche com o que a cobrança já tem', () => {
    expect(
      formDoCartao({ valor: 2870, valorPago: 2000, pagoEm: '2026-10-05', observacao: 'resto dia 20' }),
    ).toEqual({ valor: '2870,00', valorPago: '2000,00', pagoEm: '2026-10-05', observacao: 'resto dia 20' })
  })
})
