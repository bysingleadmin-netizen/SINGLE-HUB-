import { useState } from 'react'
import type { ReactNode } from 'react'
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
import { agrupar, destinoDoArraste } from './colunas'
import type { ItemQuadro } from './colunas'
import styles from './quadro.module.css'

interface ColunaQuadro {
  id: string
  titulo: string
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
}

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
}

function Coluna({ coluna, total, children, onCriar }: ColunaProps) {
  const { setNodeRef, isOver } = useDroppable({ id: coluna.id })
  return (
    <section
      ref={setNodeRef}
      className={styles.coluna}
      aria-label={coluna.titulo}
      data-sobre={isOver || undefined}
    >
      <header className={styles.colunaTopo}>
        <h2 className={styles.colunaTitulo}>{coluna.titulo}</h2>
        <span className={styles.colunaTotal}>{total}</span>
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

/** Quadro Kanban: arrastar um card para outra coluna chama `onMover`. */
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
}: QuadroProps<T>) {
  const [arrastandoId, setArrastandoId] = useState<string | null>(null)
  const sensores = useSensors(
    // A distância mínima deixa o clique abrir o card sem começar um arraste
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
  )

  const grupos = agrupar(itens, colunas, colunaDe)
  const arrastado = itens.find((item) => item.id === arrastandoId)
  const tituloDaColuna = (id: string | number | undefined) =>
    colunas.find((coluna) => coluna.id === id)?.titulo

  function aoSoltar(evento: DragEndEvent) {
    setArrastandoId(null)
    const item = itens.find((candidato) => candidato.id === evento.active.id)
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
          onDragStart: () => 'Card levantado.',
          onDragOver: ({ over }) => {
            const titulo = tituloDaColuna(over?.id)
            return titulo ? `Sobre a coluna ${titulo}.` : undefined
          },
          onDragEnd: ({ over }) => {
            const titulo = tituloDaColuna(over?.id)
            return titulo ? `Card solto na coluna ${titulo}.` : 'Card solto fora do quadro.'
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
      </div>
      <DragOverlay dropAnimation={null}>
        {arrastado && (
          <div className={`${styles.card} ${styles.cardFlutuante}`}>
            <div className={styles.cardAbrir}>{renderCard(arrastado)}</div>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
