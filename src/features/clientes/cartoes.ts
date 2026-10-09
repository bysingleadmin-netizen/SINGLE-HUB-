import type { Client, ClientPayment, FormaDePagamento, PaymentStatus } from '@/types/database'

// Os pagamentos mensais não são cadastrados à mão. Os cartões são calculados a partir do
// cadastro do cliente (início do contrato, valor mensal e dia de vencimento); no banco só
// ficam os meses pagos e o cartão seguinte ao último pagamento.

/** Limite de meses gerados para um contrato muito antigo */
const MAXIMO_DE_MESES = 120

export interface CartaoDePagamento {
  /** Primeiro dia do mês de referência, 'AAAA-MM-01' */
  mes: string
  valor: number
  vencimento: string
  /** 'pendente' com vencimento passado aparece como 'atrasado' */
  status: PaymentStatus
  dataPagamento: string | null
  forma: FormaDePagamento | null
  /** id da linha em client_payments; null enquanto o cartão só existe na tela */
  id: string | null
}

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

/**
 * Cartões do cliente em ordem cronológica: um por mês, do início do contrato até o mês atual,
 * mais o mês seguinte quando tudo até aqui já foi pago.
 * Mês pago mostra o que foi pago; mês em aberto usa o valor e o dia atuais do cadastro.
 */
export function gerarCartoes(
  cliente: Pick<Client, 'id' | 'status' | 'mrr' | 'data_inicio_contrato' | 'dia_vencimento'>,
  pagamentos: ClientPayment[],
  hoje: string,
): CartaoDePagamento[] {
  const linhas = new Map(
    pagamentos.filter((p) => p.client_id === cliente.id).map((p) => [p.mes_referencia, p]),
  )
  const dia = diaDeVencimento(cliente)
  const mesAtual = `${hoje.slice(0, 7)}-01`
  const meses = new Set(linhas.keys())

  if (cliente.data_inicio_contrato && cliente.status === 'ativo') {
    let mes = `${cliente.data_inicio_contrato.slice(0, 7)}-01`
    // Contrato muito antigo: fica com os meses mais recentes
    const gerados: string[] = []
    for (; mes <= mesAtual; mes = proximoMes(mes)) gerados.push(mes)
    for (const gerado of gerados.slice(-MAXIMO_DE_MESES)) meses.add(gerado)
    // Enquanto o último mês da lista estiver pago, o cartão do mês seguinte já fica à vista
    if (gerados.length > 0) {
      let fim = [...meses].sort().pop() as string
      for (let passos = 0; passos < 24 && linhas.get(fim)?.status === 'pago'; passos++) {
        fim = proximoMes(fim)
        meses.add(fim)
      }
    }
  }

  return [...meses].sort().map((mes) => {
    const linha = linhas.get(mes)
    if (linha?.status === 'pago') {
      return {
        mes,
        valor: Number(linha.valor),
        vencimento: linha.data_vencimento,
        status: 'pago' as const,
        dataPagamento: linha.data_pagamento,
        forma: linha.forma_pagamento ?? null,
        id: linha.id,
      }
    }
    const vencimento = dia ? vencimentoNoMes(mes, dia) : (linha?.data_vencimento ?? mes)
    return {
      mes,
      valor: Number(cliente.mrr),
      vencimento,
      status: vencimento < hoje ? ('atrasado' as const) : ('pendente' as const),
      dataPagamento: null,
      forma: null,
      id: linha?.id ?? null,
    }
  })
}
