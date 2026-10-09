import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Campo } from '@/components/ui/Campo'
import { EstadoErro } from '@/components/ui/Estado'
import { Pill } from '@/components/ui/Pill'
import { Skeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import ui from '@/components/ui/ui.module.css'
import { useAtualizarOtimista, useSalvar } from '@/dados/base'
import { usePagamentos } from '@/dados/tabelas'
import { hojeISO } from '@/lib/datas'
import { formatarData, formatarMoeda } from '@/lib/formato'
import type { Erros } from '@/lib/formulario'
import { STATUS_PAGAMENTO, opcao } from '@/lib/rotulos'
import type { Client, ClientPayment } from '@/types/database'
import { formatarMes, moedaParaCampo, statusDoPagamento, validarPagamento } from './cliente'
import type { FormPagamento } from './cliente'
import styles from './clientes.module.css'

const CHAVE_DUPLICADA = '23505'

/** Histórico de pagamentos do cliente. Só é montado para a liderança. */
export function Pagamentos({ cliente }: { cliente: Client }) {
  const pagamentos = usePagamentos()
  const salvar = useSalvar<ClientPayment>('client_payments')
  const atualizar = useAtualizarOtimista<ClientPayment>('client_payments')
  const toast = useToast()
  const hoje = hojeISO()

  const formInicial = (): FormPagamento => ({
    mes: '',
    valor: moedaParaCampo(cliente.mrr),
    vencimento: '',
  })
  const [form, setForm] = useState<FormPagamento>(formInicial)
  const [erros, setErros] = useState<Erros<FormPagamento>>({})

  const doCliente = (pagamentos.data ?? [])
    .filter((p) => p.client_id === cliente.id)
    .sort((a, b) => b.mes_referencia.localeCompare(a.mes_referencia))

  function campo(nome: keyof FormPagamento) {
    return {
      value: form[nome],
      erro: erros[nome],
      onChange: (evento: { target: { value: string } }) =>
        setForm((atual) => ({ ...atual, [nome]: evento.target.value })),
    }
  }

  function aoAdicionar(evento: FormEvent) {
    evento.preventDefault()
    const resultado = validarPagamento(form)
    if ('erros' in resultado) {
      setErros(resultado.erros)
      return
    }
    setErros({})
    salvar.mutate(
      { valores: { ...resultado.valores, client_id: cliente.id } },
      {
        onSuccess: () => {
          toast.sucesso('Pagamento adicionado.')
          setForm(formInicial())
        },
        onError: (erro) =>
          toast.erro(
            (erro as { code?: string }).code === CHAVE_DUPLICADA
              ? 'Já existe um pagamento para esse mês.'
              : 'Não foi possível adicionar o pagamento.',
          ),
      },
    )
  }

  function marcarComoPago(pagamento: ClientPayment) {
    atualizar.mutate(
      { id: pagamento.id, valores: { status: 'pago', data_pagamento: hoje } },
      {
        onSuccess: () => toast.sucesso('Pagamento marcado como pago.'),
        onError: () => toast.erro('Não foi possível marcar o pagamento como pago.'),
      },
    )
  }

  return (
    <section className={styles.secao}>
      <h3 className={styles.secaoTitulo}>Histórico de pagamentos</h3>

      {pagamentos.isError ? (
        <EstadoErro onTentar={() => void pagamentos.refetch()} />
      ) : pagamentos.isLoading ? (
        <Skeleton altura="48px" />
      ) : doCliente.length === 0 ? (
        <p className={ui.mudo}>Nenhum pagamento registrado para este cliente.</p>
      ) : (
        <ul className={ui.lista}>
          {doCliente.map((pagamento) => {
            const status = opcao(STATUS_PAGAMENTO, statusDoPagamento(pagamento, hoje))
            return (
              <li key={pagamento.id} className={ui.linha}>
                <div className={ui.linhaTexto}>
                  <span className={ui.linhaTitulo}>{formatarMes(pagamento.mes_referencia)}</span>
                  <span className={ui.mudo}>
                    {formatarMoeda(Number(pagamento.valor))}, vence em{' '}
                    {formatarData(pagamento.data_vencimento)}
                  </span>
                </div>
                <Pill tom={status.tom}>{status.rotulo}</Pill>
                {pagamento.status !== 'pago' && (
                  <Button
                    variante="secundario"
                    className={ui.botaoPequeno}
                    onClick={() => marcarComoPago(pagamento)}
                  >
                    Marcar como pago
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <form className={ui.formulario} onSubmit={aoAdicionar} noValidate>
        <div className={ui.duasColunas}>
          <Campo rotulo="Mês" type="month" {...campo('mes')} />
          <Campo rotulo="Valor" inputMode="decimal" {...campo('valor')} />
        </div>
        <Campo rotulo="Vencimento" type="date" {...campo('vencimento')} />
        <div className={ui.acoes}>
          <Button type="submit" variante="secundario" carregando={salvar.isPending}>
            Adicionar pagamento
          </Button>
        </div>
      </form>
    </section>
  )
}
