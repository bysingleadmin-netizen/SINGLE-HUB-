import { Link } from 'react-router-dom'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { EstadoErro, EstadoVazio } from '@/components/ui/Estado'
import { Icone } from '@/components/ui/Icone'
import type { NomeIcone } from '@/components/ui/Icone'
import { KpiCard } from '@/components/ui/KpiCard'
import { Painel } from '@/components/ui/Painel'
import { Pill } from '@/components/ui/Pill'
import { Skeleton } from '@/components/ui/Skeleton'
import ui from '@/components/ui/ui.module.css'
import { useAtividadeRecente } from '@/dados/atividade'
import { juntarConsultas, porId } from '@/dados/base'
import { useEventos } from '@/dados/eventos'
import { useRegistrarOtimizacao } from '@/dados/otimizacao'
import { useCampanhas, useCards, useClientes, usePerfis, useTarefas } from '@/dados/tabelas'
import { eventosPorDia, horarioDoEvento } from '@/features/calendario/calendario'
import { hojeISO } from '@/lib/datas'
import { formatarData, formatarMoeda } from '@/lib/formato'
import {
  calcularMetricas,
  diasDeAtraso,
  mrrPorMes,
  otimizacaoPendente,
  plural,
  proximasEntregas,
  proximasOtimizacoes,
  tarefaAberta,
  tarefaAtrasada,
  tempoRelativo,
} from '@/lib/regras'
import { TIPOS_EVENTO, opcao } from '@/lib/rotulos'
import { GraficoMRR } from './GraficoMRR'
import styles from './dashboard.module.css'

const ICONE_DA_ENTIDADE: Record<string, NomeIcone> = {
  clients: 'clientes',
  tasks: 'demandas',
  content_cards: 'conteudo',
  campaigns: 'campanhas',
}

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
  const perfis = usePerfis()
  const atividade = useAtividadeRecente()
  const eventos = useEventos()
  const { registrar, registrando } = useRegistrarOtimizacao()

  const hoje = hojeISO()
  const clientePorId = porId(clientes.data)
  const perfilPorId = porId(perfis.data)
  const nomeDoCliente = (id: string | null) =>
    (id && clientePorId.get(id)?.nome) || 'Sem cliente'

  const todas = juntarConsultas(clientes, tarefas, cards, campanhas, perfis, atividade, eventos)
  const kpis = juntarConsultas(clientes, tarefas, cards)
  const painelEntregas = juntarConsultas(tarefas, clientes, perfis)
  const painelOtimizacoes = juntarConsultas(campanhas, clientes)
  const painelAtividade = juntarConsultas(atividade, perfis)
  const painelHoje = juntarConsultas(tarefas, eventos)

  const metricas = calcularMetricas(clientes.data ?? [], tarefas.data ?? [], cards.data ?? [])
  const entregas = proximasEntregas(tarefas.data ?? [], hoje)
  const otimizacoes = proximasOtimizacoes(campanhas.data ?? [], hoje)
  const registros = atividade.data ?? []
  const eventosDeHoje = eventosPorDia(eventos.data ?? []).get(hoje) ?? []
  const entregasDeHoje = (tarefas.data ?? []).filter(
    (tarefa) => tarefaAberta(tarefa) && tarefa.data_entrega === hoje,
  )

  return (
    <div className={styles.pagina}>
      {kpis.erro ? (
        <EstadoErro onTentar={todas.tentar} />
      ) : (
        <div className={`${styles.kpis} stagger`}>
          <KpiCard
            rotulo="MRR total"
            valor={metricas.mrrTotal}
            formatar={formatarMoeda}
            carregando={kpis.carregando}
          />
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
        </div>
      )}

      <div className={styles.paineisIguais}>
        <Painel titulo="Hoje">
          {painelHoje.erro ? (
            <EstadoErro onTentar={todas.tentar} />
          ) : painelHoje.carregando ? (
            <Carregando />
          ) : eventosDeHoje.length + entregasDeHoje.length === 0 ? (
            <EstadoVazio ilustracao="calendario" titulo="Nada marcado para hoje." />
          ) : (
            <ul className={`${ui.lista} stagger`}>
              {eventosDeHoje.map((evento) => {
                const tipo = opcao(TIPOS_EVENTO, evento.tipo)
                return (
                  <li key={evento.id} className={ui.linha}>
                    <div className={ui.linhaTexto}>
                      <Link to={`/app/calendario?dia=${hoje}`} className={ui.linhaTitulo}>
                        {evento.titulo}
                      </Link>
                      <span className={ui.mudo}>{horarioDoEvento(evento)}</span>
                    </div>
                    <Pill tom={tipo.tom}>{tipo.rotulo}</Pill>
                  </li>
                )
              })}
              {entregasDeHoje.map((tarefa) => (
                <li key={tarefa.id} className={ui.linha}>
                  <div className={ui.linhaTexto}>
                    <Link to={`/app/demandas?abrir=${tarefa.id}`} className={ui.linhaTitulo}>
                      {tarefa.titulo}
                    </Link>
                    <span className={ui.mudo}>{nomeDoCliente(tarefa.client_id)}</span>
                  </div>
                  <Pill tom="amarelo">Entrega hoje</Pill>
                </li>
              ))}
            </ul>
          )}
        </Painel>

        <Painel titulo="MRR dos últimos 6 meses">
          {clientes.isError ? (
            <EstadoErro onTentar={todas.tentar} />
          ) : clientes.isLoading ? (
            <Carregando />
          ) : (
            <GraficoMRR serie={mrrPorMes(clientes.data ?? [], hoje)} />
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
                  <li key={tarefa.id} className={ui.linha}>
                    <Avatar nome={responsavel?.nome ?? null} url={responsavel?.avatar_url} tamanho={32} />
                    <div className={ui.linhaTexto}>
                      <Link to="/app/demandas" className={ui.linhaTitulo}>
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
                <Link to="/app/campanhas" className={ui.linkAcao}>
                  Criar campanha
                </Link>
              }
            />
          ) : (
            <ul className={`${ui.lista} stagger`}>
              {otimizacoes.map((campanha) => (
                <li key={campanha.id} className={ui.linha}>
                  <div className={ui.linhaTexto}>
                    <Link to={`/app/campanhas/${campanha.id}`} className={ui.linhaTitulo}>
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

      <Painel titulo="Atividade recente">
        {painelAtividade.erro ? (
          <EstadoErro onTentar={todas.tentar} />
        ) : painelAtividade.carregando ? (
          <Carregando />
        ) : registros.length === 0 ? (
          <EstadoVazio
            ilustracao="atividade" titulo="Nada registrado ainda."
            texto="Clientes, demandas, conteúdos e campanhas criados pela equipe aparecem aqui."
          />
        ) : (
          <ul className={`${ui.lista} stagger`}>
            {registros.map((registro) => (
              <li key={registro.id} className={ui.linha}>
                <span className={styles.iconeAtividade}>
                  <Icone nome={ICONE_DA_ENTIDADE[registro.entidade ?? ''] ?? 'dashboard'} tamanho={16} />
                </span>
                <p className={ui.linhaTexto}>
                  <span>
                    <strong>
                      {(registro.user_id && perfilPorId.get(registro.user_id)?.nome) || 'Alguém'}
                    </strong>{' '}
                    {registro.descricao}
                  </span>
                </p>
                <span className={ui.mudo}>{tempoRelativo(registro.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Painel>
    </div>
  )
}
