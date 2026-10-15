import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { EstadoVazio } from '@/components/ui/Estado'
import { Icone } from '@/components/ui/Icone'
import { Modal } from '@/components/ui/Modal'
import { Pill } from '@/components/ui/Pill'
import { Selecao } from '@/components/ui/Selecao'
import { useToast } from '@/components/ui/Toast'
import ui from '@/components/ui/ui.module.css'
import { AsaasJaVinculado, useSincronizarAsaas, useVincularAsaas } from '@/dados/asaas'
import { porId } from '@/dados/base'
import { formatarData, formatarMoeda } from '@/lib/formato'
import { plural } from '@/lib/regras'
import type { Client, ReceitaAsaas } from '@/types/database'
import { formaDoAsaas, situacaoDoAsaas } from './asaas'
import styles from './financeiro.module.css'

/** Nome do cliente da cobrança: o daqui, se vinculada; senão, o do Asaas. */
export function nomeDaReceita(receita: ReceitaAsaas, clientePorId: Map<string, Pick<Client, 'nome'>>): string {
  const cliente = receita.cliente_id ? clientePorId.get(receita.cliente_id) : undefined
  return cliente?.nome ?? receita.nome_cliente_asaas ?? 'Cliente sem nome'
}

interface VincularProps {
  receita: ReceitaAsaas
  clientes: Client[]
  onFechar: () => void
}

function VincularCliente({ receita, clientes, onFechar }: VincularProps) {
  const [clienteId, setClienteId] = useState('')
  const [erro, setErro] = useState<string>()
  const vincular = useVincularAsaas()
  const toast = useToast()
  const nome = receita.nome_cliente_asaas ?? 'cliente do Asaas'
  // Cliente já ligado a outro cadastro do Asaas fica de fora: trocar desligaria o anterior
  const livres = clientes.filter(
    (cliente) => !cliente.asaas_customer_id || cliente.asaas_customer_id === receita.asaas_customer_id,
  )

  async function aoEnviar(evento: FormEvent) {
    evento.preventDefault()
    if (!clienteId) {
      setErro('Escolha o cliente.')
      return
    }
    try {
      await vincular.mutateAsync({ receita, clienteId })
      const cliente = clientes.find((c) => c.id === clienteId)
      toast.sucesso(`Cobranças de ${nome} vinculadas a ${cliente?.nome ?? 'o cliente'}.`)
      onFechar()
    } catch (falha) {
      toast.erro(
        falha instanceof AsaasJaVinculado
          ? 'Este cliente do Asaas já está ligado a outro cliente.'
          : 'Não foi possível vincular a cobrança.',
      )
    }
  }

  return (
    <Modal aberto titulo="Vincular cliente" onFechar={onFechar}>
      <form className={ui.formulario} onSubmit={aoEnviar} noValidate>
        <p className={ui.mudo}>
          {receita.asaas_customer_id
            ? `As cobranças de ${nome} no Asaas, inclusive as próximas, passam a ser deste cliente.`
            : 'Esta cobrança passa a ser deste cliente.'}
        </p>
        <Selecao
          rotulo="Cliente"
          vazio="Escolha o cliente"
          opcoes={livres.map((cliente) => ({ valor: cliente.id, rotulo: cliente.nome }))}
          value={clienteId}
          erro={erro}
          onChange={(evento) => {
            setClienteId(evento.target.value)
            setErro(undefined)
          }}
        />
        {livres.length < clientes.length && (
          <p className={ui.mudo}>Clientes já ligados a outro cadastro do Asaas não aparecem aqui.</p>
        )}
        <div className={ui.acoes}>
          <Button variante="fantasma" onClick={onFechar}>
            Cancelar
          </Button>
          <Button type="submit" carregando={vincular.isPending}>
            Vincular
          </Button>
        </div>
      </form>
    </Modal>
  )
}

interface ListaProps {
  receitas: ReceitaAsaas[]
  clientes: Client[]
  /** Na página de um cliente o nome dele não se repete em cada linha */
  comCliente?: boolean
}

/** Cobranças do Asaas, cada uma com o status em cor e o vínculo com o cliente daqui. */
export function ListaDeReceitas({ receitas, clientes, comCliente = true }: ListaProps) {
  const [vinculando, setVinculando] = useState<ReceitaAsaas>()
  const clientePorId = porId(clientes)

  return (
    <>
      <ul className={`${ui.lista} stagger`}>
        {receitas.map((receita) => {
          const situacao = situacaoDoAsaas(receita.status)
          const nome = nomeDaReceita(receita, clientePorId)
          const pagaEm = receita.data_pagamento && `pago ${formatarData(receita.data_pagamento)}`
          const venceEm = receita.data_vencimento && `vence ${formatarData(receita.data_vencimento)}`
          const detalhes = [
            comCliente ? receita.descricao : (receita.descricao ?? nome),
            pagaEm || venceEm,
            formaDoAsaas(receita.forma_pagamento),
            receita.tipo === 'SUBSCRIPTION' && 'assinatura',
          ].filter(Boolean)
          return (
            <li key={receita.id} className={ui.linha} data-cobranca>
              <div className={ui.linhaTexto}>
                {comCliente ? (
                  <span className={`${ui.linhaTitulo} ${styles.nomeAsaas}`}>
                    {receita.vinculado && receita.cliente_id ? (
                      <Link to={`/app/clientes/${receita.cliente_id}`}>{nome}</Link>
                    ) : (
                      nome
                    )}
                    {receita.vinculado && (
                      <span className={styles.vinculado} title="Vinculada a um cliente do sistema">
                        <Icone nome="vinculo" tamanho={14} />
                        <span className={ui.somenteLeitor}>vinculada</span>
                      </span>
                    )}
                  </span>
                ) : (
                  <span className={ui.linhaTitulo}>{formatarMoeda(Number(receita.valor ?? 0))}</span>
                )}
                <span className={ui.mudo}>{detalhes.join(', ')}</span>
              </div>
              <Pill tom={situacao.tom}>{situacao.rotulo}</Pill>
              {comCliente && <span className={styles.valor}>{formatarMoeda(Number(receita.valor ?? 0))}</span>}
              {!receita.vinculado && (
                <Button
                  variante="secundario"
                  className={ui.botaoPequeno}
                  aria-label={`Vincular cliente de ${receita.nome_cliente_asaas ?? 'cobrança sem nome'}`}
                  onClick={() => setVinculando(receita)}
                >
                  Vincular cliente
                </Button>
              )}
            </li>
          )
        })}
      </ul>
      {vinculando && (
        <VincularCliente
          key={vinculando.id}
          receita={vinculando}
          clientes={clientes}
          onFechar={() => setVinculando(undefined)}
        />
      )}
    </>
  )
}

/** Traz do Asaas as cobranças que já existem; o webhook cuida das que vierem depois. */
export function SincronizarAsaas() {
  const sincronizar = useSincronizarAsaas()
  const toast = useToast()

  async function aoClicar() {
    try {
      const { cobrancas, vinculadas, semVinculo } = await sincronizar.mutateAsync()
      toast.sucesso(
        `Asaas sincronizado: ${plural(cobrancas, 'cobrança', 'cobranças')}, ${plural(vinculadas, 'vinculada a cliente', 'vinculadas a clientes')}${
          semVinculo > 0 ? ` e ${semVinculo} sem cliente` : ''
        }.`,
      )
    } catch (falha) {
      toast.erro(falha instanceof Error ? falha.message : 'Não foi possível sincronizar o Asaas.')
    }
  }

  return (
    <Button variante="secundario" className={ui.botaoPequeno} carregando={sincronizar.isPending} onClick={aoClicar}>
      {sincronizar.isPending ? 'Sincronizando…' : 'Sincronizar Asaas'}
    </Button>
  )
}

/** Sem a tabela receitas_asaas no banco (migration 0006 não rodada) */
export function SemTabelaAsaas() {
  return (
    <EstadoVazio
      ilustracao="pagamentos"
      titulo="As cobranças do Asaas aparecem depois da migration 0006."
      texto="Rode supabase/migrations/0006_asaas.sql no Supabase e publique as funções asaas-webhook e asaas-sync (o passo a passo está em docs/INTEGRACOES.md)."
    />
  )
}
