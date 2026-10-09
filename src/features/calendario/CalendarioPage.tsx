import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Drawer } from '@/components/ui/Drawer'
import { EstadoErro, EstadoVazio } from '@/components/ui/Estado'
import { Icone } from '@/components/ui/Icone'
import { Pill } from '@/components/ui/Pill'
import { Skeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import ui from '@/components/ui/ui.module.css'
import { juntarConsultas, porId, useRemover } from '@/dados/base'
import { useEventos, useParticipantes } from '@/dados/eventos'
import { useCards, useClientes, usePerfis, useTarefas } from '@/dados/tabelas'
import { hojeISO, somarDias } from '@/lib/datas'
import { formatarData } from '@/lib/formato'
import { plural } from '@/lib/regras'
import type { CalendarEvent } from '@/types/database'
import { EventoModal } from './EventoModal'
import {
  agendaPorDia,
  diaCurto,
  diasDoPeriodo,
  gradeDoMes,
  mesDe,
  mesVizinho,
  montarAgenda,
  nomeDoDia,
  nomeDoMes,
} from './calendario'
import type { ItemDeAgenda, Periodo } from './calendario'
import styles from './calendario.module.css'

const DIAS_DA_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const CHIPS_POR_DIA = 3
// Nas visões curtas cada dia tem mais altura, então cabem mais itens antes do "mais"
const CHIPS_NA_VISAO_CURTA = 8
const DIA_VALIDO = /^\d{4}-\d{2}-\d{2}$/

const PERIODOS: readonly { valor: Periodo; rotulo: string; passo: number }[] = [
  { valor: 'quinzena', rotulo: '15 dias', passo: 15 },
  { valor: 'semana', rotulo: 'Semana atual', passo: 7 },
  { valor: 'mes', rotulo: 'Mês', passo: 0 },
]

interface CelulaProps {
  iso: string
  itens: ItemDeAgenda[]
  hoje: string
  limite: number
  /** Dia do mês vizinho que completa a semana na grade mensal */
  fora?: boolean
  /** Nas visões curtas o dia traz o próprio nome: "sex 9" */
  rotulo?: string
  onAbrir: (iso: string) => void
}

/**
 * Um dia do calendário. O dia inteiro abre o painel do dia; cada item é clicável por si:
 * a entrega de uma demanda ou de um conteúdo leva direto ao card.
 */
function Celula({ iso, itens, hoje, limite, fora, rotulo, onAbrir }: CelulaProps) {
  return (
    <div className={styles.dia} data-fora={fora || undefined} data-curta={rotulo ? true : undefined}>
      <button
        type="button"
        className={styles.diaAbrir}
        aria-current={iso === hoje ? 'date' : undefined}
        aria-label={
          itens.length > 0 ? `${nomeDoDia(iso)}, ${plural(itens.length, 'item', 'itens')}` : nomeDoDia(iso)
        }
        onClick={() => onAbrir(iso)}
      >
        <span className={styles.diaNumero}>{rotulo ?? Number(iso.slice(8))}</span>
      </button>
      {itens.slice(0, limite).map((item) =>
        item.rota ? (
          <Link
            key={item.chave}
            to={item.rota}
            className={styles.chip}
            data-tom={item.tom}
            data-concluido={item.concluido || undefined}
            title={`${item.rotulo}: ${item.titulo}`}
          >
            {item.titulo}
          </Link>
        ) : (
          <span
            key={item.chave}
            className={styles.chip}
            data-tom={item.tom}
            data-concluido={item.concluido || undefined}
          >
            {item.titulo}
          </span>
        ),
      )}
      {itens.length > limite && <span className={styles.mais}>mais {itens.length - limite}</span>}
    </div>
  )
}

export function CalendarioPage() {
  const eventos = useEventos()
  const participantes = useParticipantes()
  const tarefas = useTarefas()
  const cards = useCards()
  const clientes = useClientes()
  const perfis = usePerfis()
  const remover = useRemover('calendar_events')
  const toast = useToast()
  const [parametros, setParametros] = useSearchParams()

  const hoje = hojeISO()
  const pedido = parametros.get('dia')
  const diaAberto = pedido && DIA_VALIDO.test(pedido) ? pedido : null
  const [periodo, setPeriodo] = useState<Periodo>('mes')
  const [mes, setMes] = useState(() => mesDe(diaAberto ?? hoje))
  /** Primeiro dia de referência das visões de 15 dias e de semana */
  const [ancora, setAncora] = useState(diaAberto ?? hoje)
  /** Dia em que o modal de novo evento abre; null quando fechado */
  const [criandoEm, setCriandoEm] = useState<string | null>(null)

  const consultas = juntarConsultas(eventos, participantes, tarefas, cards, clientes, perfis)
  // Eventos do calendário e entregas de demandas e conteúdos, juntos, sem copiar nada no banco
  const porDia = agendaPorDia(montarAgenda(eventos.data ?? [], tarefas.data ?? [], cards.data ?? []))
  const grade = gradeDoMes(mes.ano, mes.mes)
  const dias = periodo === 'mes' ? [] : diasDoPeriodo(periodo, ancora)
  const vazio =
    periodo === 'mes'
      ? !grade.some((dia) => dia.doMes && porDia.has(dia.iso))
      : !dias.some((dia) => porDia.has(dia))
  const clientePorId = porId(clientes.data)
  const perfilPorId = porId(perfis.data)
  const passo = PERIODOS.find((p) => p.valor === periodo)?.passo ?? 0

  function abrirDia(iso: string | null) {
    setParametros(iso ? { dia: iso } : {}, { replace: true })
  }

  function navegar(sentido: 1 | -1) {
    if (periodo === 'mes') setMes((atual) => mesVizinho(atual, sentido))
    else setAncora((atual) => somarDias(atual, passo * sentido))
  }

  function voltarParaHoje() {
    setMes(mesDe(hoje))
    setAncora(hoje)
  }

  function nomesDosParticipantes(evento: CalendarEvent): string {
    return (participantes.data ?? [])
      .filter((p) => p.event_id === evento.id)
      .map((p) => perfilPorId.get(p.profile_id)?.nome)
      .filter(Boolean)
      .join(', ')
  }

  function excluir(evento: CalendarEvent) {
    remover.mutate(evento.id, {
      onSuccess: () => toast.sucesso('Evento excluído.'),
      onError: () => toast.erro('Não foi possível excluir o evento.'),
    })
  }

  const doDia = diaAberto ? (porDia.get(diaAberto) ?? []) : []
  const anterior = periodo === 'mes' ? 'Mês anterior' : 'Período anterior'
  const proximo = periodo === 'mes' ? 'Próximo mês' : 'Próximo período'

  return (
    <div className={styles.pagina}>
      <div className={styles.barra}>
        <div className={styles.navegacao}>
          <button type="button" className={ui.botaoIcone} aria-label={anterior} onClick={() => navegar(-1)}>
            <Icone nome="setaEsquerda" tamanho={18} />
          </button>
          <h2 className={styles.mes}>
            {periodo === 'mes'
              ? nomeDoMes(mes.ano, mes.mes)
              : `${formatarData(dias[0])} a ${formatarData(dias[dias.length - 1])}`}
          </h2>
          <button type="button" className={ui.botaoIcone} aria-label={proximo} onClick={() => navegar(1)}>
            <Icone nome="seta" tamanho={18} />
          </button>
          <Button variante="fantasma" className={ui.botaoPequeno} onClick={voltarParaHoje}>
            Hoje
          </Button>
        </div>

        <div className={styles.periodos} role="group" aria-label="Período mostrado">
          {PERIODOS.map((opcao) => (
            <button
              key={opcao.valor}
              type="button"
              className={styles.periodo}
              aria-pressed={periodo === opcao.valor}
              onClick={() => {
                setPeriodo(opcao.valor)
                // "15 dias" e "Semana atual" sempre partem de hoje
                setAncora(hoje)
              }}
            >
              {opcao.rotulo}
            </button>
          ))}
        </div>

        <Button variante="secundario" onClick={() => setCriandoEm(hoje)}>
          <Icone nome="mais" tamanho={16} />
          Novo evento
        </Button>
      </div>

      {consultas.erro ? (
        <EstadoErro onTentar={consultas.tentar} />
      ) : consultas.carregando ? (
        <Skeleton altura="520px" raio="var(--radius)" />
      ) : (
        <>
          <div className={styles.calendario} key={periodo}>
            {periodo === 'mes' ? (
              <>
                <div className={styles.semana} aria-hidden="true">
                  {DIAS_DA_SEMANA.map((nome) => (
                    <span key={nome}>{nome}</span>
                  ))}
                </div>
                <div className={styles.grade}>
                  {grade.map((dia) => (
                    <Celula
                      key={dia.iso}
                      iso={dia.iso}
                      itens={porDia.get(dia.iso) ?? []}
                      hoje={hoje}
                      limite={CHIPS_POR_DIA}
                      fora={!dia.doMes}
                      onAbrir={abrirDia}
                    />
                  ))}
                </div>
              </>
            ) : (
              <div className={styles.grade} data-periodo={periodo}>
                {dias.map((dia) => (
                  <Celula
                    key={dia}
                    iso={dia}
                    itens={porDia.get(dia) ?? []}
                    hoje={hoje}
                    limite={CHIPS_NA_VISAO_CURTA}
                    rotulo={diaCurto(dia)}
                    onAbrir={abrirDia}
                  />
                ))}
              </div>
            )}
          </div>
          {vazio && (
            <EstadoVazio
              ilustracao="calendario"
              titulo={periodo === 'mes' ? 'Nada marcado neste mês.' : 'Nada marcado neste período.'}
              texto="Demandas e conteúdos com data de entrega aparecem aqui sozinhos. Reuniões e gravações entram por Novo evento."
            />
          )}
        </>
      )}

      {diaAberto && (
        <Drawer aberto titulo={nomeDoDia(diaAberto)} onFechar={() => abrirDia(null)}>
          <div className={styles.painel}>
            {doDia.length === 0 ? (
              <EstadoVazio ilustracao="calendario" titulo="Nada marcado neste dia." />
            ) : (
              <ul className={`${styles.eventos} stagger`}>
                {doDia.map((item) => {
                  const cliente = item.clientId ? clientePorId.get(item.clientId) : undefined
                  const evento = item.evento
                  const nomes = evento ? nomesDosParticipantes(evento) : ''
                  return (
                    <li
                      key={item.chave}
                      className={styles.evento}
                      data-tom={item.tom}
                      data-concluido={item.concluido || undefined}
                    >
                      <div className={styles.eventoTopo}>
                        <Pill tom={item.tom}>{item.rotulo}</Pill>
                        <span className={ui.mudo}>{item.horario}</span>
                        {evento && (
                          <button
                            type="button"
                            className={ui.botaoIcone}
                            aria-label={`Excluir ${item.titulo}`}
                            title="Excluir"
                            onClick={() => excluir(evento)}
                          >
                            <Icone nome="lixeira" tamanho={16} />
                          </button>
                        )}
                      </div>
                      {item.rota ? (
                        <Link to={item.rota} className={`${styles.eventoTitulo} ${styles.eventoLink}`}>
                          {item.titulo}
                        </Link>
                      ) : (
                        <p className={styles.eventoTitulo}>{item.titulo}</p>
                      )}
                      {evento?.descricao && <p className={ui.mudo}>{evento.descricao}</p>}
                      {cliente && <p className={ui.mudo}>Cliente: {cliente.nome}</p>}
                      {nomes && <p className={ui.mudo}>Com {nomes}</p>}
                    </li>
                  )
                })}
              </ul>
            )}
            <Button variante="secundario" onClick={() => setCriandoEm(diaAberto)}>
              <Icone nome="mais" tamanho={16} />
              Novo evento neste dia
            </Button>
          </div>
        </Drawer>
      )}

      {criandoEm && (
        <EventoModal
          dia={criandoEm}
          clientes={clientes.data ?? []}
          perfis={perfis.data ?? []}
          onFechar={() => setCriandoEm(null)}
        />
      )}
    </div>
  )
}
