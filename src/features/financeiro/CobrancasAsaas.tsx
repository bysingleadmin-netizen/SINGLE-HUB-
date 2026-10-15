import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { EstadoErro, EstadoVazio } from '@/components/ui/Estado'
import { Modal } from '@/components/ui/Modal'
import { Painel } from '@/components/ui/Painel'
import { Pill } from '@/components/ui/Pill'
import { Selecao } from '@/components/ui/Selecao'
import { Skeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import ui from '@/components/ui/ui.module.css'
import { AsaasJaVinculado, useReceitasAsaas, useVincularAsaas } from '@/dados/asaas'
import { porId } from '@/dados/base'
import { useClientes } from '@/dados/tabelas'
import { useTempoReal } from '@/dados/tempoReal'
import { formatarData, formatarMoeda } from '@/lib/formato'
import { plural } from '@/lib/regras'
import type { Client, ReceitaAsaas } from '@/types/database'
import { formaDoAsaas, situacaoDoAsaas } from './asaas'
import styles from './financeiro.module.css'

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

/** Cobranças que o Asaas mandou pelo webhook, com o vínculo de cada uma a um cliente daqui. */
export function CobrancasAsaas() {
  const receitas = useReceitasAsaas()
  const clientes = useClientes()
  const [vinculando, setVinculando] = useState<ReceitaAsaas>()
  // Um pagamento confirmado no Asaas aparece aqui sem recarregar a página
  useTempoReal(['receitas_asaas'])

  if (receitas.isError || clientes.isError) {
    return (
      <EstadoErro
        onTentar={() => {
          void receitas.refetch()
          void clientes.refetch()
        }}
      />
    )
  }
  if (receitas.isLoading || clientes.isLoading) return <Skeleton altura="160px" raio="var(--radius)" />
  if (receitas.data === null) {
    return (
      <EstadoVazio
        ilustracao="pagamentos"
        titulo="As cobranças do Asaas aparecem depois da migration 0006."
        texto="Rode supabase/migrations/0006_asaas.sql no Supabase, publique a função asaas-webhook e cadastre o webhook no Asaas (o passo a passo está em docs/INTEGRACOES.md)."
      />
    )
  }

  const lista = receitas.data ?? []
  const clientePorId = porId(clientes.data)
  const semVinculo = lista.filter((receita) => !receita.vinculado).length

  return (
    <Painel titulo="Cobranças Asaas">
      {lista.length === 0 ? (
        <EstadoVazio
          ilustracao="pagamentos"
          titulo="Nenhuma cobrança do Asaas ainda."
          texto="Elas chegam sozinhas pelo webhook assim que o Asaas criar ou atualizar uma cobrança."
        />
      ) : (
        <>
          {semVinculo > 0 && (
            <p className={ui.mudo}>
              {plural(semVinculo, 'cobrança sem cliente vinculado', 'cobranças sem cliente vinculado')}
            </p>
          )}
          <ul className={`${ui.lista} stagger`}>
            {lista.map((receita) => {
              const situacao = situacaoDoAsaas(receita.status)
              const cliente = receita.cliente_id ? clientePorId.get(receita.cliente_id) : undefined
              const nome = cliente?.nome ?? receita.nome_cliente_asaas ?? 'Cliente sem nome'
              const detalhes = [
                receita.descricao,
                receita.data_vencimento && `vence ${formatarData(receita.data_vencimento)}`,
                receita.data_pagamento && `pago ${formatarData(receita.data_pagamento)}`,
                formaDoAsaas(receita.forma_pagamento),
                receita.tipo === 'SUBSCRIPTION' && 'assinatura',
              ].filter(Boolean)
              return (
                <li key={receita.id} className={ui.linha} data-cobranca>
                  <div className={ui.linhaTexto}>
                    <span className={ui.linhaTitulo}>{nome}</span>
                    <span className={ui.mudo}>{detalhes.join(', ')}</span>
                  </div>
                  <Pill tom={situacao.tom}>{situacao.rotulo}</Pill>
                  <span className={styles.valor}>{formatarMoeda(Number(receita.valor ?? 0))}</span>
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
        </>
      )}
      {vinculando && (
        <VincularCliente
          key={vinculando.id}
          receita={vinculando}
          clientes={clientes.data ?? []}
          onFechar={() => setVinculando(undefined)}
        />
      )}
    </Painel>
  )
}
