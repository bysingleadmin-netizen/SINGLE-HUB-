import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlternarVisao, useVisao } from '@/components/quadro/AlternarVisao'
import { TabelaDeTarefas } from '@/components/quadro/TabelaDeTarefas'
import type { ColunaDaTabela } from '@/components/quadro/TabelaDeTarefas'
import { CelulaCliente, CelulaPessoa } from '@/components/quadro/celulas'
import lista from '@/components/quadro/lista.module.css'
import pagina from '@/components/quadro/pagina.module.css'
import { Avatar } from '@/components/ui/Avatar'
import { BlocoDeVinculo } from '@/components/ui/BlocoDeVinculo'
import { Button } from '@/components/ui/Button'
import { Campo } from '@/components/ui/Campo'
import { EstadoErro, EstadoVazio } from '@/components/ui/Estado'
import { Icone } from '@/components/ui/Icone'
import { MenuAcoes } from '@/components/ui/MenuDeAcoes'
import { Pill } from '@/components/ui/Pill'
import { Selecao } from '@/components/ui/Selecao'
import { Skeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import { useColunasOpcionais } from '@/dados/esquema'
import { useExcluir } from '@/dados/excluir'
import { useClientes, usePerfis } from '@/dados/tabelas'
import { useAuth } from '@/features/auth/AuthContext'
import { hojeISO } from '@/lib/datas'
import { formatarData, formatarMoeda } from '@/lib/formato'
import { isLideranca } from '@/lib/permissoes'
import { formatarFidelidade, plural } from '@/lib/regras'
import { STATUS_CLIENTE, opcao } from '@/lib/rotulos'
import type { Client } from '@/types/database'
import { ClienteDrawer } from './ClienteDrawer'
import { ClienteModal } from './ClienteModal'
import { fidelidadeDoCliente, filtrarClientes, linkInstagram, mesesDeCasa } from './cliente'
import type { FiltroDeStatus } from './cliente'
import { seloDoContrato } from './contrato'
import styles from './clientes.module.css'

/** undefined: fechado. 'novo': cadastro. Um id: edição daquele cliente. */
type Formulario = undefined | 'novo' | string

const FILTROS: readonly { valor: FiltroDeStatus; rotulo: string }[] = [
  { valor: 'todos', rotulo: 'Todos' },
  { valor: 'ativos', rotulo: 'Ativos' },
  { valor: 'inativos', rotulo: 'Inativos (pausados e churn)' },
]

export function ClientesPage() {
  const clientes = useClientes()
  const perfis = usePerfis()
  const colunasDoBanco = useColunasOpcionais()
  const [formulario, setFormulario] = useState<Formulario>()
  // Cliente com a ficha aberta, pela tabela
  const [aberto, setAberto] = useState<string>()
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<FiltroDeStatus>('todos')
  const [visao, setVisao] = useVisao('clientes')
  const { perfil } = useAuth()
  const lideranca = isLideranca(perfil?.cargo)
  const excluir = useExcluir<Client>({
    tabela: 'clients',
    recarregar: ['client_payments', 'tasks', 'content_cards'],
  })
  const toast = useToast()

  function excluirCliente(cliente: Client) {
    excluir.mutate(cliente.id, {
      onSuccess: () => toast.sucesso('Cliente excluído.'),
      // O banco recusa enquanto houver anúncios do cliente
      onError: () =>
        toast.erro('Não foi possível excluir o cliente. Se ele tem anúncios, exclua os anúncios antes.'),
    })
  }

  const todos = clientes.data ?? []
  const visiveis = filtrarClientes(todos, busca, filtro)
  const emEdicao = todos.find((c) => c.id === formulario)
  const naFicha = todos.find((c) => c.id === aberto)
  const hoje = hojeISO()
  const perfilDe = (id: string | undefined) => perfis.data?.find((p) => p.id === id)

  const colunas: ColunaDaTabela<Client>[] = [
    {
      chave: 'nome',
      titulo: 'Nome',
      render: (c) => <CelulaCliente cliente={c} />,
      ordem: (c) => c.nome,
    },
    // Área e responsáveis chegam com a migration 0012
    ...(colunasDoBanco.baseDeClientes
      ? [
          {
            chave: 'area',
            titulo: 'Área de atuação',
            render: (c: Client) =>
              c.area_atuacao ?? <span className={lista.celulaMuda}>Não informada</span>,
            ordem: (c: Client) => c.area_atuacao ?? null,
          },
          {
            chave: 'responsavel',
            titulo: 'Responsável SINGLE',
            render: (c: Client) => (
              <CelulaPessoa
                perfil={perfilDe(c.responsaveis?.[0])}
                outros={Math.max(0, (c.responsaveis?.length ?? 0) - 1)}
              />
            ),
            ordem: (c: Client) => perfilDe(c.responsaveis?.[0])?.nome ?? null,
          },
        ]
      : []),
    {
      chave: 'mrr',
      titulo: 'MRR',
      render: (c) => <span className={styles.celulaValor}>{formatarMoeda(Number(c.mrr))}</span>,
      ordem: (c) => Number(c.mrr),
    },
    {
      chave: 'status',
      titulo: 'Status',
      render: (c) => {
        const status = opcao(STATUS_CLIENTE, c.status)
        return <Pill tom={status.tom}>{status.rotulo}</Pill>
      },
      ordem: (c) => opcao(STATUS_CLIENTE, c.status).rotulo,
    },
    {
      chave: 'casa',
      titulo: 'Meses de casa',
      render: (c) => {
        const meses = mesesDeCasa(c, hoje)
        return meses == null ? <span className={lista.celulaMuda}>—</span> : formatarFidelidade(meses)
      },
      ordem: (c) => mesesDeCasa(c, hoje),
    },
    {
      chave: 'inicio',
      titulo: 'Início',
      render: (c) =>
        c.data_inicio_contrato ? (
          formatarData(c.data_inicio_contrato)
        ) : (
          <span className={lista.celulaMuda}>Sem data</span>
        ),
      ordem: (c) => c.data_inicio_contrato,
    },
  ]

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
          {clientes.isSuccess &&
            todos.length > 0 &&
            (visiveis.length === todos.length
              ? plural(todos.length, 'cliente', 'clientes')
              : `${visiveis.length} de ${plural(todos.length, 'cliente', 'clientes')}`)}
        </p>
        {botaoNovo}
      </div>

      {todos.length > 0 && (
        <div className={pagina.barra}>
          <div className={pagina.filtros}>
            <Campo
              rotulo="Buscar cliente"
              type="search"
              placeholder="Nome do cliente"
              value={busca}
              onChange={(evento) => setBusca(evento.target.value)}
            />
            <Selecao
              rotulo="Status"
              opcoes={FILTROS}
              value={filtro}
              onChange={(evento) => setFiltro(evento.target.value as FiltroDeStatus)}
            />
          </div>
          <div className={pagina.acoes}>
            <AlternarVisao
              visao={visao}
              onMudar={setVisao}
              rotulo="Forma de ver os clientes"
              nomes={{ quadro: 'Cards', lista: 'Tabela' }}
            />
          </div>
        </div>
      )}

      {clientes.isError ? (
        <EstadoErro onTentar={() => void clientes.refetch()} />
      ) : clientes.isLoading ? (
        <div className={styles.grade} aria-busy="true">
          <Skeleton altura="132px" raio="var(--radius)" />
          <Skeleton altura="132px" raio="var(--radius)" />
          <Skeleton altura="132px" raio="var(--radius)" />
        </div>
      ) : todos.length === 0 ? (
        <EstadoVazio
          ilustracao="clientes"
          titulo="Nenhum cliente cadastrado."
          texto="Cadastre o primeiro cliente para começar a organizar demandas e anúncios."
          acao={botaoNovo}
        />
      ) : visiveis.length === 0 ? (
        <EstadoVazio ilustracao="busca" titulo="Nenhum cliente com essa busca." />
      ) : visao === 'lista' ? (
        <TabelaDeTarefas
          rotulo="Base de clientes"
          itens={visiveis}
          colunas={colunas}
          tituloDe={(c) => c.nome}
          ordemInicial="nome"
          onAbrir={(c) => setAberto(c.id)}
          acoes={(cliente) => (
            <MenuAcoes
              nome={cliente.nome}
              onEditar={() => setFormulario(cliente.id)}
              onExcluir={lideranca ? () => excluirCliente(cliente) : undefined}
              aviso="As cobranças dele também são excluídas, e as tarefas e conteúdos ficam sem cliente."
            />
          )}
        />
      ) : (
        <div className={`${styles.grade} stagger`}>
          {visiveis.map((cliente) => {
            const status = opcao(STATUS_CLIENTE, cliente.status)
            const instagram = linkInstagram(cliente.instagram)
            const selo = seloDoContrato(cliente, hoje)
            return (
              <article key={cliente.id} className={styles.card}>
                <div className={styles.cardTopo}>
                  <Avatar nome={cliente.nome} url={cliente.logo_url} tamanho={40} forma="quadrado" />
                  {/* O link cobre o card inteiro; as ações rápidas ficam por cima dele */}
                  <Link to={`/app/clientes/${cliente.id}`} className={styles.cardNome}>
                    {cliente.nome}
                  </Link>
                  <Pill tom={status.tom}>{status.rotulo}</Pill>
                </div>
                <span className={styles.cardValor}>{formatarMoeda(Number(cliente.mrr))}</span>
                {cliente.contato_nome && (
                  <BlocoDeVinculo pessoas={[{ nome: cliente.contato_nome, detalhe: 'Contato' }]} />
                )}
                <div className={styles.cardContrato}>
                  <span className={styles.cardFidelidade}>
                    {cliente.data_inicio_contrato
                      ? `${fidelidadeDoCliente(cliente)} de casa`
                      : 'Sem data de início'}
                  </span>
                  {selo && <Pill tom={selo.tom}>{selo.texto}</Pill>}
                </div>

                <div className={styles.cardAcoes}>
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
                  <MenuAcoes
                    nome={cliente.nome}
                    onEditar={() => setFormulario(cliente.id)}
                    // Excluir leva o histórico de cobranças: só a liderança, que cuida do Financeiro
                    onExcluir={lideranca ? () => excluirCliente(cliente) : undefined}
                    aviso="As cobranças dele também são excluídas, e as tarefas e conteúdos ficam sem cliente."
                  />
                </div>
              </article>
            )
          })}
        </div>
      )}

      {naFicha && (
        <ClienteDrawer
          cliente={naFicha}
          onEditar={() => setFormulario(naFicha.id)}
          onFechar={() => setAberto(undefined)}
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
