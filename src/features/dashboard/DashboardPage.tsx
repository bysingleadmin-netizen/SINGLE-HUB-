import { Link } from 'react-router-dom'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { EstadoErro, EstadoVazio } from '@/components/ui/Estado'
import { KpiCard } from '@/components/ui/KpiCard'
import { Painel } from '@/components/ui/Painel'
import { Pill } from '@/components/ui/Pill'
import { Skeleton } from '@/components/ui/Skeleton'
import ui from '@/components/ui/ui.module.css'
import { useAtividadeRecente } from '@/dados/atividade'
import { juntarConsultas, porId } from '@/dados/base'
import { useEventos } from '@/dados/eventos'
import { useOpcoes } from '@/dados/opcoes'
import { useRegistrarOtimizacao } from '@/dados/otimizacao'
import {
  useCampanhas,
  useCards,
  useClientes,
  usePerfis,
  useTarefas,
  useTarefasDeCampanha,
} from '@/dados/tabelas'
import { useTempoReal } from '@/dados/tempoReal'
import { agendaPorDia, montarAgenda } from '@/features/calendario/calendario'
import { hojeISO } from '@/lib/datas'
import { formatarData } from '@/lib/formato'
import { SITUACOES } from '@/lib/rotulos'
import {
  calcularMetricas,
  cargaPorPessoa,
  diasDeAtraso,
  otimizacaoPendente,
  plural,
  proximasEntregas,
  proximasOtimizacoes,
  tarefaAtrasada,
} from '@/lib/regras'
import { AtividadeRecente } from './AtividadeRecente'
import { Carga } from './Carga'
import { GraficoStatus } from './GraficoStatus'
import { contarStatus } from './statusDosCards'
import styles from './dashboard.module.css'

function Carregando() {
  return (
    <div className={styles.carregando} aria-busy="true">
      <Skeleton altura="40px" />
      <Skeleton altura="40px" />
      <Skeleton altura="40px" />
    </div>
  )
}

export function DashboardPage() {
  const clientes = useClientes()
  const tarefas = useTarefas()
  const cards = useCards()
  const campanhas = useCampanhas()
  const tarefasDeAnuncio = useTarefasDeCampanha()
  const perfis = usePerfis()
  const atividade = useAtividadeRecente(100)
  const eventos = useEventos()
  const { registrar, registrando } = useRegistrarOtimizacao()
  const situacoes = useOpcoes('situacao', SITUACOES)
  // A rosca de status acompanha o que a equipe muda nos quadros, sem recarregar a página
  useTempoReal(['tasks', 'content_cards', 'card_options'])

  const hoje = hojeISO()
  const clientePorId = porId(clientes.data)
  const perfilPorId = porId(perfis.data)
  const nomeDoCliente = (id: string | null) =>
    (id && clientePorId.get(id)?.nome) || 'Sem cliente'

  const todas = juntarConsultas(clientes, tarefas, cards, campanhas, perfis, atividade, eventos)
  const kpis = juntarConsultas(clientes, tarefas, cards, tarefasDeAnuncio)
  const painelEntregas = juntarConsultas(tarefas, clientes, perfis)
  const painelOtimizacoes = juntarConsultas(campanhas, clientes)
  const painelAtividade = juntarConsultas(atividade, perfis)
  const painelHoje = juntarConsultas(tarefas, cards, eventos)
  const painelStatus = juntarConsultas(tarefas, cards)

  const metricas = calcularMetricas(
    clientes.data ?? [],
    tarefas.data ?? [],
    cards.data ?? [],
    tarefasDeAnuncio.data ?? [],
  )
  const status = contarStatus(tarefas.data ?? [], cards.data ?? [], situacoes.opcoes)
  const travados = status.find((fatia) => fatia.valor === 'travado')
  const entregas = proximasEntregas(tarefas.data ?? [], hoje)
  const otimizacoes = proximasOtimizacoes(campanhas.data ?? [], hoje)
  const registros = atividade.data ?? []
  const painelCarga = juntarConsultas(tarefas, cards, tarefasDeAnuncio, perfis)
  const carga = cargaPorPessoa(tarefas.data ?? [], cards.data ?? [], tarefasDeAnuncio.data ?? [])
  // Eventos e entregas do dia, da mesma agenda que o Calendário mostra; o que já foi entregue sai
  const agendaDeHoje = (
    agendaPorDia(montarAgenda(eventos.data ?? [], tarefas.data ?? [], cards.data ?? [])).get(hoje) ?? []
  ).filter((item) => !item.concluido)

  return (
    <div className={styles.pagina}>
      {kpis.erro ? (
        <EstadoErro onTentar={todas.tentar} />
      ) : (
        <div className={`${styles.kpis} stagger`}>
          <KpiCard
            rotulo="Clientes ativos"
            valor={metricas.clientesAtivos}
            carregando={kpis.carregando}
          />
          <KpiCard
            rotulo="Tarefas abertas"
            valor={metricas.tarefasAbertas}
            carregando={kpis.carregando}
          />
          <KpiCard
            rotulo="Conteúdos aguardando aprovação"
            valor={metricas.conteudosAguardando}
            carregando={kpis.carregando}
          />
          <KpiCard
            // A equipe pode renomear o status; o número continua sendo o dos cards travados
            rotulo={
              !travados || travados.rotulo === 'Travado' ? 'Cards travados' : `Cards em ${travados.rotulo}`
            }
            valor={travados?.total ?? 0}
            carregando={kpis.carregando}
          />
        </div>
      )}

      <div className={styles.paineisIguais}>
        <Painel titulo="Hoje">
          {painelHoje.erro ? (
            <EstadoErro onTentar={todas.tentar} />
          ) : painelHoje.carregando ? (
            <Carregando />
          ) : agendaDeHoje.length === 0 ? (
            <EstadoVazio ilustracao="calendario" titulo="Nada marcado para hoje." />
          ) : (
            <ul className={`${ui.lista} stagger`}>
              {agendaDeHoje.map((item) => (
                <li key={item.chave} className={`${ui.linha} ${ui.linhaClicavel}`}>
                  <div className={ui.linhaTexto}>
                    <Link to={item.rota ?? `/app/calendario?dia=${hoje}`} className={ui.linhaTitulo}>
                      {item.titulo}
                    </Link>
                    <span className={ui.mudo}>
                      {item.horario}
                      {item.clientId && `, ${nomeDoCliente(item.clientId)}`}
                    </span>
                  </div>
                  <Pill tom={item.tom}>{item.rotulo}</Pill>
                </li>
              ))}
            </ul>
          )}
        </Painel>

        <Painel titulo="Status dos cards">
          {painelStatus.erro ? (
            <EstadoErro onTentar={todas.tentar} />
          ) : painelStatus.carregando ? (
            <Carregando />
          ) : status.every((fatia) => fatia.total === 0) ? (
            <EstadoVazio
              ilustracao="quadro"
              titulo="Nenhum card nos quadros."
              texto="Demandas e conteúdos em andamento aparecem aqui, separados por status."
            />
          ) : (
            <GraficoStatus fatias={status} />
          )}
        </Painel>
      </div>

      <div className={styles.paineis}>
        <Painel titulo="Próximas entregas">
          {painelEntregas.erro ? (
            <EstadoErro onTentar={todas.tentar} />
          ) : painelEntregas.carregando ? (
            <Carregando />
          ) : entregas.length === 0 ? (
            <EstadoVazio
              ilustracao="quadro" titulo="Nenhuma entrega nos próximos 7 dias."
              acao={
                <Link to="/app/demandas" className={ui.linkAcao}>
                  Criar demanda
                </Link>
              }
            />
          ) : (
            <ul className={`${ui.lista} stagger`}>
              {entregas.map((tarefa) => {
                const responsavel = tarefa.responsavel_id
                  ? perfilPorId.get(tarefa.responsavel_id)
                  : undefined
                const prazo = tarefa.data_entrega as string
                return (
                  <li key={tarefa.id} className={`${ui.linha} ${ui.linhaClicavel}`}>
                    <Avatar nome={responsavel?.nome ?? null} url={responsavel?.avatar_url} tamanho={32} />
                    <div className={ui.linhaTexto}>
                      <Link to={`/app/demandas?abrir=${tarefa.id}`} className={ui.linhaTitulo}>
                        {tarefa.titulo}
                      </Link>
                      <span className={ui.mudo}>
                        {nomeDoCliente(tarefa.client_id)}, {responsavel?.nome ?? 'Sem responsável'}
                      </span>
                    </div>
                    {tarefaAtrasada(tarefa, hoje) ? (
                      <Pill tom="vermelho">
                        {plural(diasDeAtraso(prazo, hoje), 'dia', 'dias')} de atraso
                      </Pill>
                    ) : (
                      <span className={ui.mudo}>{prazo === hoje ? 'Hoje' : formatarData(prazo)}</span>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </Painel>

        <Painel titulo="Próximas otimizações">
          {painelOtimizacoes.erro ? (
            <EstadoErro onTentar={todas.tentar} />
          ) : painelOtimizacoes.carregando ? (
            <Carregando />
          ) : otimizacoes.length === 0 ? (
            <EstadoVazio
              ilustracao="campanhas" titulo="Nenhuma otimização nos próximos 3 dias."
              acao={
                <Link to="/app/anuncios" className={ui.linkAcao}>
                  Criar anúncio
                </Link>
              }
            />
          ) : (
            <ul className={`${ui.lista} stagger`}>
              {otimizacoes.map((campanha) => (
                <li key={campanha.id} className={`${ui.linha} ${ui.linhaClicavel}`}>
                  <div className={ui.linhaTexto}>
                    <Link to={`/app/anuncios/${campanha.id}`} className={ui.linhaTitulo}>
                      {campanha.nome}
                    </Link>
                    <span className={ui.mudo}>
                      {nomeDoCliente(campanha.client_id)},{' '}
                      {formatarData(campanha.proxima_otimizacao)}
                    </span>
                  </div>
                  {otimizacaoPendente(campanha, hoje) && <Pill tom="vermelho">Pendente</Pill>}
                  <Button
                    variante="secundario"
                    className={ui.botaoPequeno}
                    disabled={registrando}
                    onClick={() => registrar(campanha)}
                  >
                    Marcar como otimizado
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Painel>
      </div>

      <div className={styles.paineis}>
        <Painel titulo="Carga da equipe">
          {painelCarga.erro ? (
            <EstadoErro onTentar={todas.tentar} />
          ) : painelCarga.carregando ? (
            <Carregando />
          ) : carga.length === 0 ? (
            <EstadoVazio
              ilustracao="clientes"
              titulo="Ninguém com tarefa em aberto."
              texto="Demandas, conteúdos e tarefas de anúncio com responsável aparecem aqui."
            />
          ) : (
            <Carga carga={carga} perfilPorId={perfilPorId} />
          )}
        </Painel>

        <Painel titulo="Atividade recente">
          {painelAtividade.erro ? (
            <EstadoErro onTentar={todas.tentar} />
          ) : painelAtividade.carregando ? (
            <Carregando />
          ) : registros.length === 0 ? (
            <EstadoVazio
              ilustracao="atividade"
              titulo="Nada registrado ainda."
              texto="Clientes, demandas, conteúdos e anúncios criados pela equipe aparecem aqui."
            />
          ) : (
            <AtividadeRecente registros={registros} perfilPorId={perfilPorId} />
          )}
        </Painel>
      </div>
    </div>
  )
}
