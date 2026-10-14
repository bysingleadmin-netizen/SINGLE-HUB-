import { textoOuNull } from '@/lib/formulario'
import type { Erros, Validacao } from '@/lib/formulario'
import { parseMoeda } from '@/lib/regras'
import type { CartaoDePagamento } from './cartoes'
import { moedaParaCampo } from './cliente'

// Edição de uma cobrança: valor total, quanto já entrou, quando e uma observação.

export interface FormEdicaoDePagamento {
  valor: string
  valorPago: string
  pagoEm: string
  observacao: string
}

export interface ValoresEdicao {
  valor: number
  valorPago: number
  pagoEm: string | null
  observacao: string | null
}

const VALOR_INVALIDO = 'Informe um valor como 1.500,00.'

export function formDoCartao(
  cartao: Pick<CartaoDePagamento, 'valor' | 'valorPago' | 'pagoEm' | 'observacao'>,
): FormEdicaoDePagamento {
  return {
    valor: moedaParaCampo(cartao.valor),
    valorPago: cartao.valorPago > 0 ? moedaParaCampo(cartao.valorPago) : '',
    pagoEm: cartao.pagoEm ?? '',
    observacao: cartao.observacao ?? '',
  }
}

export function validarEdicaoDePagamento(
  form: FormEdicaoDePagamento,
): Validacao<ValoresEdicao, FormEdicaoDePagamento> {
  const erros: Erros<FormEdicaoDePagamento> = {}
  const valor = parseMoeda(form.valor)
  const valorPago = form.valorPago.trim() === '' ? 0 : parseMoeda(form.valorPago)
  if (valor == null || valor <= 0) erros.valor = VALOR_INVALIDO
  if (valorPago == null) erros.valorPago = VALOR_INVALIDO
  else if (valor != null && valorPago > valor) erros.valorPago = 'O valor pago não pode passar do total.'
  if (valorPago != null && valorPago > 0 && form.pagoEm.trim() === '') {
    erros.pagoEm = 'Informe a data do pagamento.'
  }
  if (Object.keys(erros).length > 0 || valor == null || valorPago == null) return { erros }
  return {
    valores: {
      valor,
      valorPago,
      pagoEm: valorPago > 0 ? form.pagoEm : null,
      observacao: textoOuNull(form.observacao),
    },
  }
}
