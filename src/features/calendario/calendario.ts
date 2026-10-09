import { hojeISO, somarDias } from '@/lib/datas'
import { textoOuNull } from '@/lib/formulario'
import type { Erros, Validacao } from '@/lib/formulario'
import { TIPOS_EVENTO, opcao } from '@/lib/rotulos'
import type { Tom } from '@/lib/rotulos'
import type { CalendarEvent, ContentCard, Task, TipoEvento } from '@/types/database'

// Eventos são guardados como timestamps com fuso. Na tela, o dia de um evento
// é sempre o dia no relógio de quem está olhando.

export interface MesAno {
  ano: number
  /** 1 a 12 */
  mes: number
}

export interface DiaDaGrade {
  iso: string
  /** false para os dias do mês anterior ou seguinte que completam a semana */
  doMes: boolean
}

const doisDigitos = (n: number) => String(n).padStart(2, '0')

export function mesDe(iso: string): MesAno {
  const [ano, mes] = iso.split('-').map(Number)
  return { ano, mes }
}

export function mesVizinho({ ano, mes }: MesAno, passo: 1 | -1): MesAno {
  const indice = ano * 12 + (mes - 1) + passo
  return { ano: Math.floor(indice / 12), mes: (indice % 12) + 1 }
}

/** Semanas completas, de domingo a sábado, que cobrem o mês. */
export function gradeDoMes(ano: number, mes: number): DiaDaGrade[] {
  const primeiro = `${ano}-${doisDigitos(mes)}-01`
  const diaDaSemana = new Date(ano, mes - 1, 1).getDay()
  const diasNoMes = new Date(ano, mes, 0).getDate()
  const total = Math.ceil((diaDaSemana + diasNoMes) / 7) * 7
  const inicio = somarDias(primeiro, -diaDaSemana)
  return Array.from({ length: total }, (_, i) => {
    const iso = somarDias(inicio, i)
    return { iso, doMes: i >= diaDaSemana && i < diaDaSemana + diasNoMes }
  })
}

export type Periodo = 'quinzena' | 'semana' | 'mes'

/** Domingo da semana em que o dia cai (a grade do mês também começa no domingo). */
export function inicioDaSemana(iso: string): string {
  const [ano, mes, dia] = iso.split('-').map(Number)
  return somarDias(iso, -new Date(ano, mes - 1, dia).getDay())
}

/**
 * Dias mostrados nas visões curtas: a semana inteira em que `ancora` cai, de domingo a sábado,
 * ou 15 dias corridos a partir de `ancora`.
 */
export function diasDoPeriodo(periodo: 'quinzena' | 'semana', ancora: string): string[] {
  const inicio = periodo === 'semana' ? inicioDaSemana(ancora) : ancora
  return Array.from({ length: periodo === 'semana' ? 7 : 15 }, (_, i) => somarDias(inicio, i))
}

/** "sex., 9" para o cabeçalho de cada dia nas visões curtas. */
export function diaCurto(iso: string): string {
  const [ano, mes, dia] = iso.split('-').map(Number)
  const semana = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' }).format(
    new Date(ano, mes - 1, dia),
  )
  return `${semana.replace('.', '')} ${dia}`
}

export function nomeDoMes(ano: number, mes: number): string {
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(
    new Date(ano, mes - 1, 1),
  )
}

export function nomeDoDia(iso: string): string {
  const [ano, mes, dia] = iso.split('-').map(Number)
  return new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }).format(
    new Date(ano, mes - 1, dia),
  )
}

/** Dias locais que o evento ocupa, do início ao fim. */
export function diasDoEvento(evento: Pick<CalendarEvent, 'data_inicio' | 'data_fim'>): string[] {
  const inicio = hojeISO(new Date(evento.data_inicio))
  const fim = evento.data_fim ? hojeISO(new Date(evento.data_fim)) : inicio
  const dias = [inicio]
  for (let dia = somarDias(inicio, 1); dia <= fim; dia = somarDias(dia, 1)) dias.push(dia)
  return dias
}

function hora(timestamp: string): string {
  const data = new Date(timestamp)
  return `${doisDigitos(data.getHours())}:${doisDigitos(data.getMinutes())}`
}

export function horarioDoEvento(
  evento: Pick<CalendarEvent, 'data_inicio' | 'data_fim' | 'dia_inteiro'>,
): string {
  if (evento.dia_inteiro) return 'Dia inteiro'
  return evento.data_fim
    ? `${hora(evento.data_inicio)} às ${hora(evento.data_fim)}`
    : hora(evento.data_inicio)
}

/** Uma linha da agenda: um evento do calendário ou a entrega de uma demanda ou de um conteúdo. */
export interface ItemDeAgenda {
  /** Única entre as três origens, para servir de key */
  chave: string
  origem: 'evento' | 'demanda' | 'conteudo'
  titulo: string
  /** 'Reunião', 'Demanda', 'Conteúdo'... */
  rotulo: string
  tom: Tom
  /** Dias locais que o item ocupa */
  dias: string[]
  horario: string
  /** Entrega já feita: aparece apagada */
  concluido: boolean
  /** Para onde o item leva; eventos não têm tela própria */
  rota: string | null
  clientId: string | null
  /** O evento de origem, quando o item é um evento */
  evento: CalendarEvent | null
  /** Posição dentro do dia: dia inteiro, entregas e depois os com horário */
  ordem: string
}

/**
 * Junta eventos e entregas em uma lista só. As entregas são calculadas na hora a partir das
 * demandas e dos conteúdos com data; nada é copiado para a tabela de eventos, então não há
 * como um item aparecer duas vezes. Arquivados ficam de fora.
 */
export function montarAgenda(
  eventos: CalendarEvent[],
  tarefas: Pick<Task, 'id' | 'titulo' | 'status' | 'client_id' | 'data_entrega'>[],
  cards: Pick<ContentCard, 'id' | 'titulo' | 'etapa' | 'client_id' | 'data_entrega'>[],
): ItemDeAgenda[] {
  const deEventos = eventos.map((evento): ItemDeAgenda => {
    const tipo = opcao(TIPOS_EVENTO, evento.tipo)
    return {
      chave: `evento-${evento.id}`,
      origem: 'evento',
      titulo: evento.titulo,
      rotulo: tipo.rotulo,
      tom: tipo.tom,
      dias: diasDoEvento(evento),
      horario: horarioDoEvento(evento),
      concluido: false,
      rota: null,
      clientId: evento.client_id,
      evento,
      ordem: evento.dia_inteiro ? '0' : `2${evento.data_inicio}`,
    }
  })

  const entrega = (
    origem: 'demanda' | 'conteudo',
    item: { id: string; titulo: string; client_id: string | null; data_entrega: string | null },
    concluido: boolean,
  ): ItemDeAgenda => ({
    chave: `${origem}-${item.id}`,
    origem,
    titulo: item.titulo,
    rotulo: origem === 'demanda' ? 'Demanda' : 'Conteúdo',
    tom: 'vermelho',
    dias: [item.data_entrega as string],
    horario: 'Entrega',
    concluido,
    rota: origem === 'demanda' ? `/app/demandas?abrir=${item.id}` : `/app/conteudo?abrir=${item.id}`,
    clientId: item.client_id,
    evento: null,
    ordem: '1',
  })

  return [
    ...deEventos,
    ...tarefas
      .filter((t) => t.data_entrega && t.status !== 'arquivado')
      .map((t) => entrega('demanda', t, t.status === 'concluido')),
    ...cards
      .filter((c) => c.data_entrega && c.etapa !== 'arquivado')
      .map((c) => entrega('conteudo', c, c.etapa === 'publicado')),
  ]
}

/** Itens de cada dia, já na ordem em que aparecem. */
export function agendaPorDia(itens: ItemDeAgenda[]): Map<string, ItemDeAgenda[]> {
  const mapa = new Map<string, ItemDeAgenda[]>()
  for (const item of itens) {
    for (const dia of item.dias) {
      const lista = mapa.get(dia)
      if (lista) lista.push(item)
      else mapa.set(dia, [item])
    }
  }
  for (const lista of mapa.values()) lista.sort((a, b) => a.ordem.localeCompare(b.ordem))
  return mapa
}

export interface FormEvento {
  titulo: string
  descricao: string
  tipo: TipoEvento
  data_inicio: string
  hora_inicio: string
  data_fim: string
  hora_fim: string
  dia_inteiro: boolean
  client_id: string
  /** ids de perfis */
  participantes: string[]
}

export type ValoresEvento = Pick<
  CalendarEvent,
  'titulo' | 'descricao' | 'tipo' | 'data_inicio' | 'data_fim' | 'dia_inteiro' | 'client_id'
>

export function formNovoEvento(dia: string): FormEvento {
  return {
    titulo: '',
    descricao: '',
    tipo: 'reuniao',
    data_inicio: dia,
    hora_inicio: '09:00',
    data_fim: '',
    hora_fim: '',
    dia_inteiro: false,
    client_id: '',
    participantes: [],
  }
}

/** Junta data e hora locais em um timestamp ISO. */
function instante(data: string, horario: string): string {
  const [ano, mes, dia] = data.split('-').map(Number)
  const [horas, minutos] = horario.split(':').map(Number)
  return new Date(ano, mes - 1, dia, horas, minutos).toISOString()
}

export function validarEvento(form: FormEvento): Validacao<ValoresEvento, FormEvento> {
  const erros: Erros<FormEvento> = {}
  const titulo = form.titulo.trim()
  const dataFim = form.data_fim || form.data_inicio

  if (titulo === '') erros.titulo = 'Informe o título do evento.'
  if (form.data_inicio === '') erros.data_inicio = 'Informe a data.'
  if (!form.dia_inteiro && form.hora_inicio === '') erros.hora_inicio = 'Informe a hora de início.'
  if (Object.keys(erros).length > 0) return { erros }

  let inicio: string
  let fim: string | null
  if (form.dia_inteiro) {
    if (dataFim < form.data_inicio) return { erros: { data_fim: 'O fim não pode vir antes do início.' } }
    inicio = instante(form.data_inicio, '00:00')
    fim = instante(dataFim, '23:59')
  } else {
    inicio = instante(form.data_inicio, form.hora_inicio)
    fim = form.hora_fim ? instante(dataFim, form.hora_fim) : null
    if (fim && fim < inicio) {
      return {
        erros:
          dataFim < form.data_inicio
            ? { data_fim: 'O fim não pode vir antes do início.' }
            : { hora_fim: 'O fim não pode vir antes do início.' },
      }
    }
  }

  return {
    valores: {
      titulo,
      descricao: textoOuNull(form.descricao),
      tipo: form.tipo,
      data_inicio: inicio,
      data_fim: fim,
      dia_inteiro: form.dia_inteiro,
      client_id: textoOuNull(form.client_id),
    },
  }
}
