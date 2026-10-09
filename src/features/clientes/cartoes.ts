import type { Client, ClientPayment, FormaDePagamento, PaymentStatus } from '@/types/database'

// Pagamentos recorrentes.
//
// Ninguém cadastra pagamento à mão. A partir do cadastro do cliente (valor mensal e dia de
// vencimento), o sistema grava em `client_payments` uma cobrança por mês: a do mês atual e as
// dos próximos MESES_A_FRENTE. Meses anteriores ao atual nunca são criados depois do fato.
//
// Decisões:
//   * As cobranças ficam gravadas, e não calculadas na tela, para que o Financeiro, o cliente e
//     os relatórios leiam a mesma coisa e para o que venceu continuar existindo depois que o
//     mês vira.
//   * Mudar o valor ou o dia no cadastro reescreve só as cobranças em aberto do mês atual em
//     diante. Cobrança paga é histórico e não muda; cobrança em aberto de mês passado também
//     fica como estava, porque é o que era devido naquele mês.
//   * Cliente pausado ou em churn deixa de gerar cobrança, e as em aberto do mês atual em
//     diante são canceladas.
//   * "Atrasado" não é gravado: é uma cobrança pendente cujo vencimento passou.

/** Quantos meses além do atual já ficam com cobrança criada */
export const MESES_A_FRENTE = 3

const doisDigitos = (n: number) => String(n).padStart(2, '0')

export function proximoMes(mes: string): string {
  const [ano, numero] = mes.split('-').map(Number)
  return numero === 12 ? `${ano + 1}-01-01` : `${ano}-${doisDigitos(numero + 1)}-01`
}

/** Dia do mês em que o cliente paga: o do cadastro ou, sem ele, o dia em que o contrato começou. */
export function diaDeVencimento(
  cliente: Pick<Client, 'dia_vencimento' | 'data_inicio_contrato'>,
): number | null {
  if (cliente.dia_vencimento) return cliente.dia_vencimento
  return cliente.data_inicio_contrato ? Number(cliente.data_inicio_contrato.slice(8, 10)) : null
}

/** Data de vencimento dentro do mês; em mês mais curto, cai no último dia. */
export function vencimentoNoMes(mes: string, dia: number): string {
  const [ano, numero] = mes.split('-').map(Number)
  const ultimoDia = new Date(ano, numero, 0).getDate()
  return `${ano}-${doisDigitos(numero)}-${doisDigitos(Math.min(dia, ultimoDia))}`
}

const emAberto = (pagamento: Pick<ClientPayment, 'status'>) =>
  pagamento.status === 'pendente' || pagamento.status === 'atrasado'

export interface NovaCobranca {
  client_id: string
  mes_referencia: string
  valor: number
  data_vencimento: string
  status: 'pendente'
}

export interface PlanoDeCobrancas {
  inserir: NovaCobranca[]
  /** Cobranças em aberto cujo valor ou vencimento ficou diferente do cadastro */
  atualizar: { id: string; valor: number; data_vencimento: string }[]
  /** Cobranças em aberto de clientes que deixaram de ser ativos */
  cancelar: string[]
}

type ClienteCobravel = Pick<
  Client,
  'id' | 'status' | 'mrr' | 'data_inicio_contrato' | 'dia_vencimento'
>

/**
 * O que falta gravar para as cobranças baterem com o cadastro dos clientes.
 * Com tudo em dia, as três listas vêm vazias; rodar de novo não muda nada.
 */
export function planoDeCobrancas(
  clientes: ClienteCobravel[],
  pagamentos: ClientPayment[],
  hoje: string,
): PlanoDeCobrancas {
  const plano: PlanoDeCobrancas = { inserir: [], atualizar: [], cancelar: [] }
  const mesAtual = `${hoje.slice(0, 7)}-01`

  for (const cliente of clientes) {
    const doCliente = pagamentos.filter((p) => p.client_id === cliente.id)
    const futuras = doCliente.filter((p) => emAberto(p) && p.mes_referencia >= mesAtual)

    if (cliente.status !== 'ativo') {
      plano.cancelar.push(...futuras.map((p) => p.id))
      continue
    }

    const dia = diaDeVencimento(cliente)
    const valor = Number(cliente.mrr)
    // Sem dia de vencimento ou sem valor não há o que cobrar
    if (!dia || valor <= 0) continue

    const existentes = new Set(doCliente.map((p) => p.mes_referencia))
    // Contrato que começa no futuro só gera cobrança a partir do mês em que começa
    const inicio = cliente.data_inicio_contrato
      ? `${cliente.data_inicio_contrato.slice(0, 7)}-01`
      : mesAtual
    let mes = mesAtual
    for (let i = 0; i <= MESES_A_FRENTE; i++, mes = proximoMes(mes)) {
      if (mes < inicio || existentes.has(mes)) continue
      plano.inserir.push({
        client_id: cliente.id,
        mes_referencia: mes,
        valor,
        data_vencimento: vencimentoNoMes(mes, dia),
        status: 'pendente',
      })
    }

    for (const cobranca of futuras) {
      const vencimento = vencimentoNoMes(cobranca.mes_referencia, dia)
      if (Number(cobranca.valor) !== valor || cobranca.data_vencimento !== vencimento) {
        plano.atualizar.push({ id: cobranca.id, valor, data_vencimento: vencimento })
      }
    }
  }
  return plano
}

export function planoVazio(plano: PlanoDeCobrancas): boolean {
  return plano.inserir.length + plano.atualizar.length + plano.cancelar.length === 0
}

/** Uma cobrança mensal como a tela mostra. */
export interface CartaoDePagamento {
  id: string
  clienteId: string
  /** Primeiro dia do mês de referência, 'AAAA-MM-01' */
  mes: string
  valor: number
  vencimento: string
  /** 'pendente' com vencimento passado aparece como 'atrasado' */
  status: PaymentStatus
  dataPagamento: string | null
  forma: FormaDePagamento | null
}

/** As cobranças em ordem de mês, com o atraso calculado pela data de hoje. */
export function cartoesDe(pagamentos: ClientPayment[], hoje: string): CartaoDePagamento[] {
  return [...pagamentos]
    .sort(
      (a, b) =>
        a.mes_referencia.localeCompare(b.mes_referencia) || a.client_id.localeCompare(b.client_id),
    )
    .map((p) => ({
      id: p.id,
      clienteId: p.client_id,
      mes: p.mes_referencia,
      valor: Number(p.valor),
      vencimento: p.data_vencimento,
      status: emAberto(p) && p.data_vencimento < hoje ? 'atrasado' : p.status,
      dataPagamento: p.data_pagamento,
      forma: p.forma_pagamento ?? null,
    }))
}

/** Separa o que ainda se espera receber do que já foi pago (o histórico, do mais recente ao mais antigo). */
export function separarCartoes(cartoes: CartaoDePagamento[]) {
  return {
    abertos: cartoes.filter((c) => c.status === 'pendente' || c.status === 'atrasado'),
    historico: cartoes.filter((c) => c.status === 'pago').reverse(),
  }
}
