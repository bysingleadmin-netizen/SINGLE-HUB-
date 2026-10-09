import { useState } from 'react'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { EstadoErro, EstadoVazio } from '@/components/ui/Estado'
import { Icone } from '@/components/ui/Icone'
import { Pill } from '@/components/ui/Pill'
import { Skeleton } from '@/components/ui/Skeleton'
import { useClientes } from '@/dados/tabelas'
import { formatarMoeda } from '@/lib/formato'
import { plural } from '@/lib/regras'
import { STATUS_CLIENTE, opcao } from '@/lib/rotulos'
import { ClienteDrawer, fidelidadeDoCliente } from './ClienteDrawer'
import { ClienteModal } from './ClienteModal'
import styles from './clientes.module.css'

/** undefined: fechado. 'novo': cadastro. Um id: edição daquele cliente. */
type Formulario = undefined | 'novo' | string

export function ClientesPage() {
  const clientes = useClientes()
  const [abertoId, setAbertoId] = useState<string>()
  const [formulario, setFormulario] = useState<Formulario>()

  const lista = clientes.data ?? []
  const aberto = lista.find((c) => c.id === abertoId)
  const emEdicao = lista.find((c) => c.id === formulario)

  const botaoNovo = (
    <Button onClick={() => setFormulario('novo')}>
      <Icone nome="mais" tamanho={16} />
      Novo cliente
    </Button>
  )

  return (
    <div className={styles.pagina}>
      <div className={styles.barra}>
        <p className={styles.contagem}>
          {clientes.isSuccess && lista.length > 0 && plural(lista.length, 'cliente', 'clientes')}
        </p>
        {botaoNovo}
      </div>

      {clientes.isError ? (
        <EstadoErro onTentar={() => void clientes.refetch()} />
      ) : clientes.isLoading ? (
        <div className={styles.grade} aria-busy="true">
          <Skeleton altura="132px" raio="var(--radius)" />
          <Skeleton altura="132px" raio="var(--radius)" />
          <Skeleton altura="132px" raio="var(--radius)" />
        </div>
      ) : lista.length === 0 ? (
        <EstadoVazio
          titulo="Nenhum cliente cadastrado."
          texto="Cadastre o primeiro cliente para começar a organizar demandas e campanhas."
          acao={botaoNovo}
        />
      ) : (
        <div className={`${styles.grade} stagger`}>
          {lista.map((cliente) => {
            const status = opcao(STATUS_CLIENTE, cliente.status)
            return (
              <button
                key={cliente.id}
                type="button"
                className={styles.card}
                onClick={() => setAbertoId(cliente.id)}
              >
                <span className={styles.cardTopo}>
                  <Avatar nome={cliente.nome} url={cliente.logo_url} tamanho={40} />
                  <span className={styles.cardNome}>{cliente.nome}</span>
                  <Pill tom={status.tom}>{status.rotulo}</Pill>
                </span>
                <span className={styles.cardValor}>{formatarMoeda(Number(cliente.mrr))}</span>
                <span className={styles.cardFidelidade}>{fidelidadeDoCliente(cliente)}</span>
              </button>
            )
          })}
        </div>
      )}

      {aberto && (
        <ClienteDrawer
          key={aberto.id}
          cliente={aberto}
          onEditar={() => setFormulario(aberto.id)}
          onFechar={() => setAbertoId(undefined)}
        />
      )}

      {formulario === 'novo' && <ClienteModal onFechar={() => setFormulario(undefined)} />}
      {emEdicao && (
        <ClienteModal
          key={emEdicao.id}
          cliente={emEdicao}
          onFechar={() => setFormulario(undefined)}
        />
      )}
    </div>
  )
}
