import { useState } from 'react'
import { Link } from 'react-router-dom'
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
import { ClienteModal } from './ClienteModal'
import { fidelidadeDoCliente, linkInstagram } from './cliente'
import styles from './clientes.module.css'

/** undefined: fechado. 'novo': cadastro. Um id: edição daquele cliente. */
type Formulario = undefined | 'novo' | string

export function ClientesPage() {
  const clientes = useClientes()
  const [formulario, setFormulario] = useState<Formulario>()

  const lista = clientes.data ?? []
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
          ilustracao="clientes"
          titulo="Nenhum cliente cadastrado."
          texto="Cadastre o primeiro cliente para começar a organizar demandas e campanhas."
          acao={botaoNovo}
        />
      ) : (
        <div className={`${styles.grade} stagger`}>
          {lista.map((cliente) => {
            const status = opcao(STATUS_CLIENTE, cliente.status)
            const instagram = linkInstagram(cliente.instagram)
            return (
              <article key={cliente.id} className={styles.card}>
                <div className={styles.cardTopo}>
                  <Avatar nome={cliente.nome} url={cliente.logo_url} tamanho={40} />
                  {/* O link cobre o card inteiro; as ações rápidas ficam por cima dele */}
                  <Link to={`/app/clientes/${cliente.id}`} className={styles.cardNome}>
                    {cliente.nome}
                  </Link>
                  <Pill tom={status.tom}>{status.rotulo}</Pill>
                </div>
                <span className={styles.cardValor}>{formatarMoeda(Number(cliente.mrr))}</span>
                <span className={styles.cardFidelidade}>{fidelidadeDoCliente(cliente)}</span>

                <div className={styles.cardAcoes}>
                  <button
                    type="button"
                    className={styles.cardAcao}
                    aria-label={`Editar ${cliente.nome}`}
                    title="Editar"
                    onClick={() => setFormulario(cliente.id)}
                  >
                    <Icone nome="editar" tamanho={16} />
                  </button>
                  {cliente.link_conta_anuncios && (
                    <a
                      className={styles.cardAcao}
                      href={cliente.link_conta_anuncios}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Conta de anúncios de ${cliente.nome}`}
                      title="Abrir conta de anúncios"
                    >
                      <Icone nome="externo" tamanho={16} />
                    </a>
                  )}
                  {instagram && (
                    <a
                      className={styles.cardAcao}
                      href={instagram}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Instagram de ${cliente.nome}`}
                      title="Abrir Instagram"
                    >
                      <Icone nome="instagram" tamanho={16} />
                    </a>
                  )}
                </div>
              </article>
            )
          })}
        </div>
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
