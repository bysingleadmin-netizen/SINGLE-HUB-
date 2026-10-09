import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
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
import { useClientes, usePerfis } from '@/dados/tabelas'
import { hojeISO } from '@/lib/datas'
import { plural } from '@/lib/regras'
import { TIPOS_EVENTO, opcao } from '@/lib/rotulos'
import type { CalendarEvent } from '@/types/database'
import { EventoModal } from './EventoModal'
import {
  eventosPorDia,
  gradeDoMes,
  horarioDoEvento,
  mesDe,
  mesVizinho,
  nomeDoDia,
  nomeDoMes,
} from './calendario'
import styles from './calendario.module.css'

const DIAS_DA_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const CHIPS_POR_DIA = 3
const DIA_VALIDO = /^\d{4}-\d{2}-\d{2}$/

export function CalendarioPage() {
  const eventos = useEventos()
  const participantes = useParticipantes()
  const clientes = useClientes()
  const perfis = usePerfis()
  const remover = useRemover('calendar_events')
  const toast = useToast()
  const [parametros, setParametros] = useSearchParams()

  const hoje = hojeISO()
  const pedido = parametros.get('dia')
  const diaAberto = pedido && DIA_VALIDO.test(pedido) ? pedido : null
  const [mes, setMes] = useState(() => mesDe(diaAberto ?? hoje))
  /** Dia em que o modal de novo evento abre; null quando fechado */
  const [criandoEm, setCriandoEm] = useState<string | null>(null)

  const consultas = juntarConsultas(eventos, participantes, clientes, perfis)
  const porDia = eventosPorDia(eventos.data ?? [])
  const grade = gradeDoMes(mes.ano, mes.mes)
  const mesVazio = !grade.some((dia) => dia.doMes && porDia.has(dia.iso))
  const clientePorId = porId(clientes.data)
  const perfilPorId = porId(perfis.data)

  function abrirDia(iso: string | null) {
    setParametros(iso ? { dia: iso } : {}, { replace: true })
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

  return (
    <div className={styles.pagina}>
      <div className={styles.barra}>
        <div className={styles.navegacao}>
          <button
            type="button"
            className={ui.botaoIcone}
            aria-label="Mês anterior"
            onClick={() => setMes((atual) => mesVizinho(atual, -1))}
          >
            <Icone nome="setaEsquerda" tamanho={18} />
          </button>
          <h2 className={styles.mes}>{nomeDoMes(mes.ano, mes.mes)}</h2>
          <button
            type="button"
            className={ui.botaoIcone}
            aria-label="Próximo mês"
            onClick={() => setMes((atual) => mesVizinho(atual, 1))}
          >
            <Icone nome="seta" tamanho={18} />
          </button>
          <Button variante="fantasma" className={ui.botaoPequeno} onClick={() => setMes(mesDe(hoje))}>
            Hoje
          </Button>
        </div>
        <Button onClick={() => setCriandoEm(hoje)}>
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
          <div className={styles.calendario}>
            <div className={styles.semana} aria-hidden="true">
              {DIAS_DA_SEMANA.map((nome) => (
                <span key={nome}>{nome}</span>
              ))}
            </div>
            <div className={styles.grade}>
              {grade.map((dia) => {
                const lista = porDia.get(dia.iso) ?? []
                return (
                  <button
                    key={dia.iso}
                    type="button"
                    className={styles.dia}
                    data-fora={!dia.doMes || undefined}
                    aria-current={dia.iso === hoje ? 'date' : undefined}
                    aria-label={
                      lista.length > 0
                        ? `${nomeDoDia(dia.iso)}, ${plural(lista.length, 'evento', 'eventos')}`
                        : nomeDoDia(dia.iso)
                    }
                    onClick={() => abrirDia(dia.iso)}
                  >
                    <span className={styles.diaNumero}>{Number(dia.iso.slice(8))}</span>
                    {lista.slice(0, CHIPS_POR_DIA).map((evento) => (
                      <span
                        key={evento.id}
                        className={styles.chip}
                        data-tom={opcao(TIPOS_EVENTO, evento.tipo).tom}
                      >
                        {evento.titulo}
                      </span>
                    ))}
                    {lista.length > CHIPS_POR_DIA && (
                      <span className={styles.mais}>mais {lista.length - CHIPS_POR_DIA}</span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
          {mesVazio && (
            <EstadoVazio
              ilustracao="calendario"
              titulo="Nenhum evento neste mês."
              texto="Clique em um dia ou em Novo evento para marcar reuniões, gravações e entregas."
            />
          )}
        </>
      )}

      {diaAberto && (
        <Drawer aberto titulo={nomeDoDia(diaAberto)} onFechar={() => abrirDia(null)}>
          <div className={styles.painel}>
            {doDia.length === 0 ? (
              <EstadoVazio ilustracao="calendario" titulo="Nenhum evento neste dia." />
            ) : (
              <ul className={`${styles.eventos} stagger`}>
                {doDia.map((evento) => {
                  const tipo = opcao(TIPOS_EVENTO, evento.tipo)
                  const cliente = evento.client_id ? clientePorId.get(evento.client_id) : undefined
                  const nomes = nomesDosParticipantes(evento)
                  return (
                    <li key={evento.id} className={styles.evento} data-tom={tipo.tom}>
                      <div className={styles.eventoTopo}>
                        <Pill tom={tipo.tom}>{tipo.rotulo}</Pill>
                        <span className={ui.mudo}>{horarioDoEvento(evento)}</span>
                        <button
                          type="button"
                          className={ui.botaoIcone}
                          aria-label={`Excluir ${evento.titulo}`}
                          title="Excluir"
                          onClick={() => excluir(evento)}
                        >
                          <Icone nome="lixeira" tamanho={16} />
                        </button>
                      </div>
                      <p className={styles.eventoTitulo}>{evento.titulo}</p>
                      {evento.descricao && <p className={ui.mudo}>{evento.descricao}</p>}
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
