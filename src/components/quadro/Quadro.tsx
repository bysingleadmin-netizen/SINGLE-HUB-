import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { Icone } from '@/components/ui/Icone'
import { agrupar, destinoDoArraste, reordenarColunas } from './colunas'
import type { ItemQuadro } from './colunas'
import styles from './quadro.module.css'

interface ColunaQuadro {
  id: string
  titulo: string
  /** Criada pela equipe; pode ser removida quando estiver vazia */
  personalizada?: boolean
}

/** Ações de personalização das colunas. Sem elas, o quadro tem colunas fixas. */
export interface EdicaoDeColunas {
  renomear: (id: string, titulo: string) => void
  criar: (titulo: string) => void
  reordenar: (ids: string[]) => void
  remover: (id: string) => void
}

interface QuadroProps<T extends ItemQuadro> {
  colunas: readonly ColunaQuadro[]
  itens: T[]
  colunaDe: (item: T) => string
  /** Usado nos nomes acessíveis: "Abrir …", "Arquivar …" */
  tituloDe: (item: T) => string
  renderCard: (item: T) => ReactNode
  atrasado?: (item: T) => boolean
  onMover: (item: T, coluna: string) => void
  onCriar: (coluna: string) => void
  onAbrir: (item: T) => void
  onArquivar: (item: T) => void
  edicao?: EdicaoDeColunas
}

// O arraste de uma coluna usa o mesmo contexto dos cards; o prefixo separa os dois
const PREFIXO_COLUNA = 'coluna:'

interface CardProps {
  id: string
  titulo: string
  atrasado: boolean
  children: ReactNode
  onAbrir: () => void
  onArquivar: () => void
}

function Card({ id, titulo, atrasado, children, onAbrir, onArquivar }: CardProps) {
  const { setNodeRef, listeners, isDragging } = useDraggable({ id })
  return (
    <div
      ref={setNodeRef}
      className={styles.card}
      data-atrasado={atrasado || undefined}
      data-arrastando={isDragging || undefined}
      {...listeners}
    >
      {/* O botão ocupa o card inteiro: clicar em qualquer ponto abre o detalhe */}
      <button type="button" className={styles.cardAbrir} aria-label={`Abrir ${titulo}`} onClick={onAbrir}>
        {children}
      </button>
      <button
        type="button"
        className={styles.cardArquivar}
        aria-label={`Arquivar ${titulo}`}
        title="Arquivar"
        onClick={onArquivar}
      >
        <Icone nome="arquivar" tamanho={16} />
      </button>
    </div>
  )
}

interface ColunaProps {
  coluna: ColunaQuadro
  total: number
  children: ReactNode
  onCriar: () => void
  edicao?: EdicaoDeColunas
}

function Coluna({ coluna, total, children, onCriar, edicao }: ColunaProps) {
  const { setNodeRef, isOver } = useDroppable({ id: coluna.id })
  const alca = useDraggable({ id: `${PREFIXO_COLUNA}${coluna.id}`, disabled: !edicao })
  const [nome, setNome] = useState<string | null>(null)

  function salvarNome() {
    const limpo = (nome ?? '').trim()
    if (limpo !== '' && limpo !== coluna.titulo) edicao?.renomear(coluna.id, limpo)
    setNome(null)
  }

  return (
    <section
      ref={setNodeRef}
      className={styles.coluna}
      aria-label={coluna.titulo}
      data-sobre={isOver || undefined}
      data-arrastando={alca.isDragging || undefined}
    >
      <header className={styles.colunaTopo}>
        {nome != null ? (
          <input
            className={styles.colunaNome}
            aria-label={`Nome da coluna ${coluna.titulo}`}
            autoFocus
            value={nome}
            onChange={(evento) => setNome(evento.target.value)}
            onBlur={salvarNome}
            onKeyDown={(evento) => {
              if (evento.key === 'Enter') salvarNome()
              if (evento.key === 'Escape') setNome(null)
            }}
          />
        ) : (
          <h2
            ref={edicao ? alca.setNodeRef : undefined}
            className={styles.colunaTitulo}
            data-editavel={edicao ? true : undefined}
            title={edicao ? 'Dois cliques para renomear, arraste para mudar a ordem' : undefined}
            onDoubleClick={edicao ? () => setNome(coluna.titulo) : undefined}
            {...(edicao ? alca.listeners : {})}
          >
            {coluna.titulo}
          </h2>
        )}
        <span className={styles.colunaTotal}>{total}</span>
        {edicao && coluna.personalizada && total === 0 && (
          <button
            type="button"
            className={styles.colunaCriar}
            aria-label={`Remover a coluna ${coluna.titulo}`}
            title="Remover coluna"
            onClick={() => edicao.remover(coluna.id)}
          >
            <Icone nome="lixeira" tamanho={15} />
          </button>
        )}
        <button
          type="button"
          className={styles.colunaCriar}
          aria-label={`Adicionar em ${coluna.titulo}`}
          title="Adicionar"
          onClick={onCriar}
        >
          <Icone nome="mais" tamanho={16} />
        </button>
      </header>
      <div className={styles.cards}>
        {total === 0 ? <p className={styles.colunaVazia}>Nada aqui.</p> : children}
      </div>
    </section>
  )
}

function NovaColuna({ onCriar }: { onCriar: (titulo: string) => void }) {
  const [nome, setNome] = useState<string | null>(null)

  function aoEnviar(evento: FormEvent) {
    evento.preventDefault()
    const limpo = (nome ?? '').trim()
    if (limpo !== '') onCriar(limpo)
    setNome(null)
  }

  if (nome == null) {
    return (
      <button type="button" className={styles.novaColuna} onClick={() => setNome('')}>
        <Icone nome="mais" tamanho={16} />
        Nova coluna
      </button>
    )
  }
  return (
    <form className={styles.novaColuna} data-aberta onSubmit={aoEnviar}>
      <input
        className={styles.colunaNome}
        aria-label="Nome da nova coluna"
        placeholder="Nome da coluna"
        autoFocus
        value={nome}
        onChange={(evento) => setNome(evento.target.value)}
        onBlur={aoEnviar}
        onKeyDown={(evento) => evento.key === 'Escape' && setNome(null)}
      />
    </form>
  )
}

/**
 * Quadro Kanban: arrastar um card para outra coluna chama `onMover`.
 * Com `edicao`, as colunas podem ser renomeadas (dois cliques no nome), reordenadas
 * (arrastando o nome) e criadas.
 */
export function Quadro<T extends ItemQuadro>({
  colunas,
  itens,
  colunaDe,
  tituloDe,
  renderCard,
  atrasado,
  onMover,
  onCriar,
  onAbrir,
  onArquivar,
  edicao,
}: QuadroProps<T>) {
  const [arrastandoId, setArrastandoId] = useState<string | null>(null)
  const sensores = useSensors(
    // A distância mínima deixa o clique abrir o card sem começar um arraste
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
  )

  const grupos = agrupar(itens, colunas, colunaDe)
  const arrastado = itens.find((item) => item.id === arrastandoId)
  const colunaArrastada = arrastandoId?.startsWith(PREFIXO_COLUNA)
    ? colunas.find((coluna) => `${PREFIXO_COLUNA}${coluna.id}` === arrastandoId)
    : undefined
  const tituloDaColuna = (id: string | number | undefined) =>
    colunas.find((coluna) => coluna.id === id)?.titulo

  function aoSoltar(evento: DragEndEvent) {
    setArrastandoId(null)
    const ativo = String(evento.active.id)
    if (ativo.startsWith(PREFIXO_COLUNA)) {
      const nova = reordenarColunas(
        colunas.map((coluna) => coluna.id),
        ativo.slice(PREFIXO_COLUNA.length),
        evento.over?.id,
      )
      if (nova) edicao?.reordenar(nova)
      return
    }
    const item = itens.find((candidato) => candidato.id === ativo)
    if (!item) return
    const destino = destinoDoArraste(colunaDe(item), evento.over?.id, colunas)
    if (destino) onMover(item, destino)
  }

  return (
    <DndContext
      sensors={sensores}
      onDragStart={(evento) => setArrastandoId(String(evento.active.id))}
      onDragEnd={aoSoltar}
      onDragCancel={() => setArrastandoId(null)}
      accessibility={{
        announcements: {
          onDragStart: ({ active }) =>
            String(active.id).startsWith(PREFIXO_COLUNA) ? 'Coluna levantada.' : 'Card levantado.',
          onDragOver: ({ over }) => {
            const titulo = tituloDaColuna(over?.id)
            return titulo ? `Sobre a coluna ${titulo}.` : undefined
          },
          onDragEnd: ({ over }) => {
            const titulo = tituloDaColuna(over?.id)
            return titulo ? `Solto na coluna ${titulo}.` : 'Solto fora do quadro.'
          },
          onDragCancel: () => 'Movimento cancelado.',
        },
      }}
    >
      <div className={styles.quadro}>
        {colunas.map((coluna) => {
          const daColuna = grupos.get(coluna.id) ?? []
          return (
            <Coluna
              key={coluna.id}
              coluna={coluna}
              total={daColuna.length}
              onCriar={() => onCriar(coluna.id)}
              edicao={edicao}
            >
              {daColuna.map((item) => (
                <Card
                  key={item.id}
                  id={item.id}
                  titulo={tituloDe(item)}
                  atrasado={atrasado?.(item) ?? false}
                  onAbrir={() => onAbrir(item)}
                  onArquivar={() => onArquivar(item)}
                >
                  {renderCard(item)}
                </Card>
              ))}
            </Coluna>
          )
        })}
        {edicao && <NovaColuna onCriar={edicao.criar} />}
      </div>
      <DragOverlay dropAnimation={null}>
        {arrastado && (
          <div className={`${styles.card} ${styles.cardFlutuante}`}>
            <div className={styles.cardAbrir}>{renderCard(arrastado)}</div>
          </div>
        )}
        {colunaArrastada && <div className={styles.colunaFlutuante}>{colunaArrastada.titulo}</div>}
      </DragOverlay>
    </DndContext>
  )
}
