import { Link } from 'react-router-dom'
import { BarrasHorizontais } from '@/components/graficos/BarrasHorizontais'
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
import { useColunasDoQuadro } from '@/dados/colunas'
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
import { rotaDaTarefa } from '@/features/demandas/tarefa'
import { hojeISO } from '@/lib/datas'
import { formatarData } from '@/lib/formato'
import { COLUNAS_CONTEUDO, COLUNAS_TAREFA } from '@/lib/rotulos'
import {
  calcularMetricas,
  cargaPorPessoa,
  diasDeAtraso,
  otimizacaoPendente,
  plural,
  proximasEntregas,
  proximasOtimizacoes,
  tarefaAberta,
  tarefaAtrasada,
} from '@/lib/regras'
import { AtividadeRecente } from './AtividadeRecente'
import { Carga } from './Carga'
import { GraficoMRR } from './GraficoMRR'
import { GraficoStatus } from './GraficoStatus'
import { contarPorColuna } from './statusDosCards'
import { atividadeDaSemana, cardsPorCliente, tendenciasDosIndicadores } from './tendencias'
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
  const colunasDeDemandas = useColunasDoQuadro('demandas', COLUNAS_TAREFA)
  const colunasDeConteudo = useColunasDoQuadro('conteudo', COLUNAS_CONTEUDO)
  // Os números e as roscas acompanham o que a equipe muda, sem recarregar a página
  useTempoReal(['tasks', 'content_cards', 'clients'])

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
  // O status de um card é a coluna em que ele está
  const porColunaDeDemandas = contarPorColuna(tarefas.data ?? [], colunasDeDemandas.colunas, (tarefa) => tarefa.status)
  const porColunaDeConteudo = contarPorColuna(cards.data ?? [], colunasDeConteudo.colunas, (card) => card.etapa)
  const porCliente = cardsPorCliente(tarefas.data ?? [], clientes.data ?? [])
  const semana = atividadeDaSemana(tarefas.data ?? [], cards.data ?? [], hoje)
  const tendencias = tendenciasDosIndicadores(clientes.data ?? [], tarefas.data ?? [], hoje)
  const roscas = [
    { titulo: 'Demandas', fatias: porColunaDeDemandas },
    { titulo: 'Conteúdo', fatias: porColunaDeConteudo },
  ]
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
        // Só números da operação; o que é dinheiro fica no Financeiro
        <div className={`${styles.kpis} ${styles.kpisOperacao} stagger`}>
          <KpiCard
            rotulo="Clientes ativos"
            valor={metricas.clientesAtivos}
            carregando={kpis.carregando}
            tendencia={tendencias.clientesAtivos}
          />
          <KpiCard
            rotulo="Demandas abertas"
            valor={(tarefas.data ?? []).filter(tarefaAberta).length}
            carregando={kpis.carregando}
            tendencia={tendencias.demandasAbertas}
          />
          <KpiCard
            rotulo="Entregas de hoje"
            valor={agendaDeHoje.filter((item) => item.origem !== 'evento').length}
            carregando={painelHoje.carregando}
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
          ) : roscas.every(({ fatias }) => fatias.every((fatia) => fatia.total === 0)) ? (
            <EstadoVazio
              ilustracao="quadro"
              titulo="Nenhum card nos quadros."
              texto="Demandas e conteúdos aparecem aqui, separados pela coluna em que estão."
            />
          ) : (
            <div className={styles.roscas}>
              {roscas.map(({ titulo, fatias }) => (
                <section key={titulo} aria-label={titulo}>
                  <h3 className={styles.roscaTitulo}>{titulo}</h3>
                  <GraficoStatus titulo={`${titulo} por coluna`} fatias={fatias} />
                </section>
              ))}
            </div>
          )}
        </Painel>
      </div>

      <div className={styles.paineisIguais}>
        <Painel titulo="Cards por cliente">
          {painelStatus.erro ? (
            <EstadoErro onTentar={todas.tentar} />
          ) : painelStatus.carregando ? (
            <Carregando />
          ) : porCliente.length === 0 ? (
            <EstadoVazio ilustracao="clientes" titulo="Nenhuma demanda em aberto com cliente." />
          ) : (
            <BarrasHorizontais titulo="Demandas em aberto por cliente" itens={porCliente} />
          )}
        </Painel>

        <Painel titulo="Atividade da semana">
          {painelStatus.erro ? (
            <EstadoErro onTentar={todas.tentar} />
          ) : painelStatus.carregando ? (
            <Carregando />
          ) : (
            <GraficoMRR
              nome="Cards criados"
              periodo="nos últimos 7 dias"
              comparar={false}
              serie={semana}
              formatar={(valor) => plural(valor, 'card criado', 'cards criados')}
            />
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
                      <Link to={rotaDaTarefa(tarefa)} className={ui.linhaTitulo}>
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
