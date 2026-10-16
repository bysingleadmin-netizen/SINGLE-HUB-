import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
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
import { AnimatePresence, motion } from 'framer-motion'
import { Icone } from '@/components/ui/Icone'
import { ConfirmarExclusao, MenuDeAcoes } from '@/components/ui/MenuDeAcoes'
import type { AcaoDoMenu } from '@/components/ui/MenuDeAcoes'
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
  /** Sem ele, o menu do card não tem Arquivar */
  onArquivar?: (item: T) => void
  /** Exclusão definitiva, depois da confirmação no card. Sem ele, o menu não tem Excluir */
  onExcluir?: (item: T) => void
  /** Colunas em que o + de criar aparece; sem ele, todas */
  podeCriar?: (coluna: string) => boolean
  edicao?: EdicaoDeColunas
  /** Faixa de baixo do card, fora do botão de abrir: menu de status e anexos */
  renderRodape?: (item: T) => ReactNode
  /** Vence hoje: o card ganha borda vermelha pulsando */
  urgente?: (item: T) => boolean
}

// O arraste de uma coluna usa o mesmo contexto dos cards; o prefixo separa os dois
const PREFIXO_COLUNA = 'coluna:'

interface CardProps {
  id: string
  titulo: string
  atrasado: boolean
  /** Vence hoje: borda vermelha pulsando */
  urgente?: boolean
  /** Acabou de ser solto aqui: entra assentando, sem subir de novo */
  solto?: boolean
  children: ReactNode
  rodape?: ReactNode
  onAbrir: () => void
  onArquivar?: () => void
  onExcluir?: () => void
  /** Outras colunas, para o "Mover para…" do menu */
  destinos: readonly ColunaQuadro[]
  onMoverPara: (coluna: string) => void
}

function Card({
  id,
  titulo,
  atrasado,
  urgente = false,
  solto = false,
  children,
  rodape,
  onAbrir,
  onArquivar,
  onExcluir,
  destinos,
  onMoverPara,
}: CardProps) {
  const { setNodeRef, listeners, isDragging } = useDraggable({ id })
  const [confirmando, setConfirmando] = useState(false)
  const acoes: AcaoDoMenu[] = [
    { rotulo: 'Editar', icone: 'editar', onEscolher: onAbrir },
    ...(destinos.length > 0
      ? [
          {
            rotulo: 'Mover para…',
            icone: 'colunas' as const,
            subacoes: destinos.map((coluna) => ({
              rotulo: coluna.titulo,
              onEscolher: () => onMoverPara(coluna.id),
            })),
          },
        ]
      : []),
    ...(onArquivar ? [{ rotulo: 'Arquivar', icone: 'arquivar' as const, onEscolher: onArquivar }] : []),
    ...(onExcluir
      ? [{ rotulo: 'Excluir', icone: 'lixeira' as const, perigo: true, onEscolher: () => setConfirmando(true) }]
      : []),
  ]
  return (
    // A entrada é a animação do CSS (.card); a saída, ao excluir, arquivar ou mudar de coluna,
    // é esta: o card esmaece antes de sumir
    <motion.div
      ref={setNodeRef}
      className={styles.card}
      data-atrasado={atrasado || undefined}
      data-urgente={(urgente && !atrasado) || undefined}
      data-solto={solto || undefined}
      data-arrastando={isDragging || undefined}
      // Ao sair da coluna: o card solto em outra coluna some na hora (ele já aparece no destino);
      // os outros (excluir, arquivar, mover pelo menu) esmaecem. O id solto vem do AnimatePresence
      variants={{
        saida: (soltoId: string | null) => ({ opacity: 0, transition: { duration: soltoId === id ? 0 : 0.15 } }),
      }}
      exit="saida"
      {...listeners}
    >
      {/* O botão ocupa o card inteiro: clicar em qualquer ponto abre o detalhe */}
      <button type="button" className={styles.cardAbrir} aria-label={`Abrir ${titulo}`} onClick={onAbrir}>
        {children}
      </button>
      {rodape && (
        // Mexer no menu de status ou nos anexos não pode começar um arraste do card
        <div
          onMouseDown={(evento) => evento.stopPropagation()}
          onTouchStart={(evento) => evento.stopPropagation()}
        >
          {rodape}
        </div>
      )}
      {/* Só Editar repetiria o clique no card: o menu aparece quando há mais o que fazer */}
      {acoes.length > 1 && (
        <MenuDeAcoes className={styles.cardAcoes} rotulo={`Ações de ${titulo}`} acoes={acoes} />
      )}
      {confirmando && onExcluir && (
        <div className={styles.cardConfirmar}>
          <ConfirmarExclusao
            nome={titulo}
            onCancelar={() => setConfirmando(false)}
            onConfirmar={() => {
              setConfirmando(false)
              onExcluir()
            }}
          />
        </div>
      )}
    </motion.div>
  )
}

interface ColunaProps {
  coluna: ColunaQuadro
  /** Coluna de onde saiu o card que está sendo arrastado: soltar nela não move nada */
  origem?: string
  total: number
  children: ReactNode
  /** Sem ele, a coluna não tem o + de criar */
  onCriar?: () => void
  edicao?: EdicaoDeColunas
}

function Coluna({ coluna, origem, total, children, onCriar, edicao }: ColunaProps) {
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
      data-sobre={(isOver && origem != null && origem !== coluna.id) || undefined}
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
        {onCriar && (
          <button
            type="button"
            className={styles.colunaCriar}
            aria-label={`Adicionar em ${coluna.titulo}`}
            title="Adicionar"
            onClick={onCriar}
          >
            <Icone nome="mais" tamanho={16} />
          </button>
        )}
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
  onExcluir,
  podeCriar,
  edicao,
  renderRodape,
  urgente,
}: QuadroProps<T>) {
  const [arrastandoId, setArrastandoId] = useState<string | null>(null)
  // Onde o mouse pegou o card: o card flutuante cresce a partir desse ponto, para não escorregar
  const [pegada, setPegada] = useState({ x: 0, y: 0 })
  // O card solto já aparece no destino, antes de o banco responder: sem isso ele voltava por um
  // instante à coluna de origem e parecia que o arraste não tinha funcionado
  const [pendente, setPendente] = useState<{ id: string; coluna: string } | null>(null)
  // Cards que já foram soltos ficam marcados, para a animação de assentar não repetir a de entrada
  const soltos = useRef(new Set<string>())
  const colunaReal = pendente ? itens.find((item) => item.id === pendente.id) : undefined
  const aplicado = pendente != null && (colunaReal == null || colunaDe(colunaReal) === pendente.coluna)

  useEffect(() => {
    if (!pendente) return
    if (aplicado) {
      setPendente(null)
      return
    }
    // Se o banco recusar, a lista volta ao que era e o card volta junto
    const espera = setTimeout(() => setPendente(null), 2500)
    return () => clearTimeout(espera)
  }, [pendente, aplicado])

  const colunaEfetiva = (item: T) => (pendente && item.id === pendente.id ? pendente.coluna : colunaDe(item))
  const sensores = useSensors(
    // A distância mínima deixa o clique abrir o card sem começar um arraste
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
  )

  const grupos = agrupar(itens, colunas, colunaEfetiva)
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
    if (!destino) return
    soltos.current.add(item.id)
    setPendente({ id: item.id, coluna: destino })
    onMover(item, destino)
  }

  return (
    <DndContext
      sensors={sensores}
      onDragStart={(evento) => {
        setArrastandoId(String(evento.active.id))
        const inicio = evento.active.rect.current.initial
        const ponteiro = evento.activatorEvent as MouseEvent | TouchEvent
        const ponto = 'touches' in ponteiro ? ponteiro.touches[0] : ponteiro
        if (inicio && ponto) setPegada({ x: ponto.clientX - inicio.left, y: ponto.clientY - inicio.top })
      }}
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
              origem={arrastado ? colunaDe(arrastado) : undefined}
              total={daColuna.length}
              onCriar={(podeCriar?.(coluna.id) ?? true) ? () => onCriar(coluna.id) : undefined}
              edicao={edicao}
            >
              <AnimatePresence initial={false} custom={pendente?.id ?? null}>
                {daColuna.map((item) => (
                  <Card
                    key={item.id}
                    id={item.id}
                    titulo={tituloDe(item)}
                    atrasado={atrasado?.(item) ?? false}
                    urgente={urgente?.(item) ?? false}
                    solto={soltos.current.has(item.id)}
                    rodape={renderRodape?.(item)}
                    onAbrir={() => onAbrir(item)}
                    onArquivar={onArquivar ? () => onArquivar(item) : undefined}
                    onExcluir={onExcluir ? () => onExcluir(item) : undefined}
                    destinos={colunas.filter((outra) => outra.id !== coluna.id)}
                    onMoverPara={(destino) => onMover(item, destino)}
                  >
                    {renderCard(item)}
                  </Card>
                ))}
              </AnimatePresence>
            </Coluna>
          )
        })}
        {edicao && <NovaColuna onCriar={edicao.criar} />}
      </div>
      {/* A camada do arraste vai direto para o body: ela é position: fixed, e qualquer ancestral com
          transform (a animação de entrada da página deixa um) a deslocava do cursor */}
      {createPortal(
        <DragOverlay dropAnimation={null}>
          {arrastado && (
            <div
              className={`${styles.card} ${styles.cardFlutuante}`}
              style={{ transformOrigin: `${pegada.x}px ${pegada.y}px` }}
            >
              <div className={styles.cardAbrir}>{renderCard(arrastado)}</div>
            </div>
          )}
          {colunaArrastada && <div className={styles.colunaFlutuante}>{colunaArrastada.titulo}</div>}
        </DragOverlay>,
        document.body,
      )}
    </DndContext>
  )
}
