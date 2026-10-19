import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as EventoDePonteiro } from 'react'
import { createPortal } from 'react-dom'
import { Icone } from '@/components/ui/Icone'
import styles from './portal.module.css'

interface Imagem {
  url: string
  rotulo: string
}

interface LightboxProps {
  imagens: Imagem[]
  inicial: number
  onFechar: () => void
}

const ZOOM_MAXIMO = 4
/** Quanto o dedo precisa andar na horizontal para trocar de imagem */
const ARRASTE_PARA_TROCAR = 60
const TOQUE_DUPLO_MS = 280

type Ponto = { x: number; y: number }

const distancia = (a: Ponto, b: Ponto) => Math.hypot(a.x - b.x, a.y - b.y)

/**
 * Imagem em tela cheia. No celular: pinça para ampliar, arrastar para mover a imagem ampliada,
 * arrastar para o lado (sem zoom) para a próxima e toque duplo para ampliar ou voltar.
 * No computador: setas do teclado, botões laterais e Esc.
 */
export function Lightbox({ imagens, inicial, onFechar }: LightboxProps) {
  const [indice, setIndice] = useState(inicial)
  const [zoom, setZoom] = useState(1)
  const [deslocamento, setDeslocamento] = useState<Ponto>({ x: 0, y: 0 })
  const [arraste, setArraste] = useState(0)
  const ponteiros = useRef(new Map<number, Ponto>())
  const gesto = useRef<{ distancia: number; zoom: number; inicio: Ponto; deslocamento: Ponto } | null>(null)
  const ultimoToque = useRef(0)
  const fechar = useRef(onFechar)
  fechar.current = onFechar

  const total = imagens.length
  const atual = imagens[indice]

  function irPara(novo: number) {
    if (novo < 0 || novo >= total) return
    setIndice(novo)
    setZoom(1)
    setDeslocamento({ x: 0, y: 0 })
  }
  const ir = useRef(irPara)
  ir.current = irPara
  const indiceAtual = useRef(indice)
  indiceAtual.current = indice

  useEffect(() => {
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === 'Escape') fechar.current()
      if (evento.key === 'ArrowRight') ir.current(indiceAtual.current + 1)
      if (evento.key === 'ArrowLeft') ir.current(indiceAtual.current - 1)
    }
    document.addEventListener('keydown', aoTeclar)
    // A página por trás não rola enquanto a imagem está aberta
    const rolagem = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', aoTeclar)
      document.body.style.overflow = rolagem
    }
  }, [])

  function aoApertar(evento: EventoDePonteiro<HTMLDivElement>) {
    ponteiros.current.set(evento.pointerId, { x: evento.clientX, y: evento.clientY })
    try {
      // O dedo continua sendo seguido mesmo se sair de cima da imagem
      evento.currentTarget.setPointerCapture(evento.pointerId)
    } catch {
      // Ponteiro que o navegador já soltou: o gesto segue sem a captura
    }
    const pontos = [...ponteiros.current.values()]
    gesto.current = {
      distancia: pontos.length === 2 ? distancia(pontos[0], pontos[1]) : 0,
      zoom,
      inicio: pontos[0],
      deslocamento,
    }
  }

  function aoMover(evento: EventoDePonteiro<HTMLDivElement>) {
    if (!ponteiros.current.has(evento.pointerId) || !gesto.current) return
    ponteiros.current.set(evento.pointerId, { x: evento.clientX, y: evento.clientY })
    const pontos = [...ponteiros.current.values()]
    const g = gesto.current
    if (pontos.length === 2 && g.distancia > 0) {
      setZoom(Math.min(ZOOM_MAXIMO, Math.max(1, (g.zoom * distancia(pontos[0], pontos[1])) / g.distancia)))
      return
    }
    const dx = pontos[0].x - g.inicio.x
    const dy = pontos[0].y - g.inicio.y
    if (zoom > 1) setDeslocamento({ x: g.deslocamento.x + dx, y: g.deslocamento.y + dy })
    else setArraste(dx)
  }

  function aoSoltar(evento: EventoDePonteiro<HTMLDivElement>) {
    const eraUmDedo = ponteiros.current.size === 1
    ponteiros.current.delete(evento.pointerId)
    if (ponteiros.current.size > 0) {
      // Saiu um dedo da pinça: o que ficou continua o gesto a partir de onde está
      const [resto] = ponteiros.current.values()
      gesto.current = { distancia: 0, zoom, inicio: resto, deslocamento }
      return
    }
    gesto.current = null
    if (zoom <= 1) setDeslocamento({ x: 0, y: 0 })
    if (eraUmDedo && zoom === 1 && Math.abs(arraste) > ARRASTE_PARA_TROCAR) {
      irPara(indice + (arraste < 0 ? 1 : -1))
    } else if (eraUmDedo && Math.abs(arraste) < 8) {
      const agora = Date.now()
      if (agora - ultimoToque.current < TOQUE_DUPLO_MS) {
        setZoom((z) => (z > 1 ? 1 : 2.5))
        setDeslocamento({ x: 0, y: 0 })
        ultimoToque.current = 0
      } else {
        ultimoToque.current = agora
      }
    }
    setArraste(0)
  }

  if (!atual) return null

  // Direto no body: fica por cima de tudo, inclusive do rodapé fixo com as ações
  return createPortal(
    <div className={styles.lightbox} role="dialog" aria-modal="true" aria-label={`Imagem: ${atual.rotulo}`}>
      <div className={styles.lightboxTopo}>
        <span className={styles.lightboxContagem}>
          {indice + 1} de {total}
        </span>
        <button type="button" className={styles.lightboxBotao} aria-label="Fechar imagem" onClick={onFechar}>
          <Icone nome="fechar" tamanho={22} />
        </button>
      </div>
      <div
        className={styles.lightboxPalco}
        onPointerDown={aoApertar}
        onPointerMove={aoMover}
        onPointerUp={aoSoltar}
        onPointerCancel={aoSoltar}
      >
        <img
          key={atual.url}
          src={atual.url}
          alt={atual.rotulo}
          draggable={false}
          className={styles.lightboxImagem}
          data-solta={gesto.current == null || undefined}
          style={{
            transform: `translate(${deslocamento.x + arraste}px, ${deslocamento.y}px) scale(${zoom})`,
          }}
        />
      </div>
      {indice > 0 && (
        <button
          type="button"
          className={`${styles.lightboxBotao} ${styles.lightboxAnterior}`}
          aria-label="Imagem anterior"
          onClick={() => irPara(indice - 1)}
        >
          <Icone nome="setaEsquerda" tamanho={22} />
        </button>
      )}
      {indice < total - 1 && (
        <button
          type="button"
          className={`${styles.lightboxBotao} ${styles.lightboxProxima}`}
          aria-label="Próxima imagem"
          onClick={() => irPara(indice + 1)}
        >
          <Icone nome="seta" tamanho={22} />
        </button>
      )}
      <p className={styles.lightboxLegenda}>{atual.rotulo}</p>
    </div>,
    document.body,
  )
}
