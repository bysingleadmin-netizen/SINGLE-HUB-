import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent, SyntheticEvent } from 'react'
import { createPortal } from 'react-dom'
import { COR_DO_TOM } from '@/lib/rotulos'
import type { Tom } from '@/lib/rotulos'
import { Icone } from './Icone'
import styles from './statusSelect.module.css'
import ui from './ui.module.css'

export interface OpcaoSelect {
  valor: string
  rotulo: string
  /** Tom de fábrica da opção */
  tom?: Tom
  /** Cor escolhida pela equipe; vale mais que o tom */
  cor?: string
  /** Aparece, mas não pode ser escolhida */
  desabilitada?: boolean
}

interface StatusSelectProps {
  rotulo: string
  opcoes: readonly OpcaoSelect[]
  value: string
  onChange: (valor: string) => void
  /** Texto da opção sem valor, como "Sem status" ou "Todas as áreas". Sem isso, não há opção vazia */
  vazio?: string
  erro?: string
  /** Mantém o rótulo só para leitores de tela, para seleções dentro de listas */
  ocultarRotulo?: boolean
  /** Versão em pílula, tingida com a cor da opção, para o rodapé dos cards */
  pilula?: boolean
  className?: string
}

const COR_NEUTRA = 'var(--text-fraco)'

function corDaOpcao(opcao: OpcaoSelect | undefined): string {
  if (!opcao) return COR_NEUTRA
  return opcao.cor ?? (opcao.tom ? COR_DO_TOM[opcao.tom] : COR_NEUTRA)
}

// Dentro de um card arrastável, abrir a lista não pode começar um arraste
const naoArrastar = (evento: SyntheticEvent) => evento.stopPropagation()

/**
 * Seleção com a cor de cada opção: bolinha, nome e um check na escolhida. A lista é desenhada
 * fora do painel (portal), para a rolagem de modais e do painel lateral não cortá-la.
 */
export function StatusSelect({
  rotulo,
  opcoes,
  value,
  onChange,
  vazio,
  erro,
  ocultarRotulo = false,
  pilula = false,
  className,
}: StatusSelectProps) {
  const id = useId()
  const [aberto, setAberto] = useState(false)
  const [ativo, setAtivo] = useState(0)
  const [posicao, setPosicao] = useState<CSSProperties>({})
  const gatilho = useRef<HTMLButtonElement>(null)
  const lista = useRef<HTMLDivElement>(null)

  const todas: OpcaoSelect[] = vazio != null ? [{ valor: '', rotulo: vazio }, ...opcoes] : [...opcoes]
  const atual = todas.find((opcao) => opcao.valor === value)
  const cor = value === '' ? COR_NEUTRA : corDaOpcao(atual)

  function abrir() {
    setAtivo(Math.max(0, todas.findIndex((opcao) => opcao.valor === value)))
    setAberto(true)
  }

  function fechar(devolverFoco = true) {
    setAberto(false)
    if (devolverFoco) gatilho.current?.focus()
  }

  function escolher(valor: string) {
    fechar()
    if (valor !== value) onChange(valor)
  }

  // Abaixo do campo; sem espaço embaixo, acima dele
  useLayoutEffect(() => {
    if (!aberto) return
    function posicionar() {
      const caixa = gatilho.current?.getBoundingClientRect()
      if (!caixa) return
      const largura = Math.max(caixa.width, 200)
      const esquerda = Math.max(8, Math.min(caixa.left, window.innerWidth - largura - 8))
      const embaixo = window.innerHeight - caixa.bottom
      setPosicao(
        embaixo < 260 && caixa.top > embaixo
          ? { left: esquerda, bottom: window.innerHeight - caixa.top + 6, minWidth: largura }
          : { left: esquerda, top: caixa.bottom + 6, minWidth: largura },
      )
    }
    posicionar()
    window.addEventListener('resize', posicionar)
    window.addEventListener('scroll', posicionar, true)
    return () => {
      window.removeEventListener('resize', posicionar)
      window.removeEventListener('scroll', posicionar, true)
    }
  }, [aberto])

  useEffect(() => {
    if (!aberto) return
    lista.current?.focus()
    function aoClicarFora(evento: MouseEvent) {
      const alvo = evento.target as Node
      if (!lista.current?.contains(alvo) && !gatilho.current?.contains(alvo)) setAberto(false)
    }
    document.addEventListener('mousedown', aoClicarFora)
    return () => document.removeEventListener('mousedown', aoClicarFora)
  }, [aberto])

  function aoTeclarNoGatilho(evento: KeyboardEvent) {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(evento.key)) {
      evento.preventDefault()
      abrir()
    }
  }

  function aoTeclarNaLista(evento: KeyboardEvent) {
    // Parar aqui impede que o Escape chegue ao modal em volta e o feche junto
    evento.stopPropagation()
    if (evento.key === 'Escape' || evento.key === 'Tab') {
      evento.preventDefault()
      fechar()
    } else if (evento.key === 'ArrowDown') {
      evento.preventDefault()
      setAtivo((i) => Math.min(todas.length - 1, i + 1))
    } else if (evento.key === 'ArrowUp') {
      evento.preventDefault()
      setAtivo((i) => Math.max(0, i - 1))
    } else if (evento.key === 'Home') {
      evento.preventDefault()
      setAtivo(0)
    } else if (evento.key === 'End') {
      evento.preventDefault()
      setAtivo(todas.length - 1)
    } else if (evento.key === 'Enter' || evento.key === ' ') {
      evento.preventDefault()
      const opcao = todas[ativo]
      if (opcao && !opcao.desabilitada) escolher(opcao.valor)
    }
  }

  return (
    <div
      className={[ui.campo, className].filter(Boolean).join(' ')}
      onMouseDown={naoArrastar}
      onTouchStart={naoArrastar}
      onPointerDown={naoArrastar}
      // Numa linha que abre o item ao clicar, escolher aqui não abre a linha
      onClick={naoArrastar}
    >
      <span id={`${id}-rotulo`} className={ocultarRotulo ? ui.somenteLeitor : ui.campoRotulo}>
        {rotulo}
      </span>
      <button
        ref={gatilho}
        type="button"
        className={pilula ? styles.pilula : styles.gatilho}
        style={{ '--cor': cor } as CSSProperties}
        // Combobox só de escolha: o nome vem do rótulo e o valor, do texto do próprio campo
        role="combobox"
        aria-labelledby={`${id}-rotulo`}
        aria-haspopup="listbox"
        aria-expanded={aberto}
        aria-controls={aberto ? `${id}-lista` : undefined}
        aria-invalid={erro ? true : undefined}
        aria-describedby={erro ? `${id}-erro` : undefined}
        data-valor={value}
        data-aberto={aberto || undefined}
        onClick={() => (aberto ? fechar() : abrir())}
        onKeyDown={aoTeclarNoGatilho}
      >
        <span className={styles.cor} data-cor style={{ background: cor }} aria-hidden="true" />
        <span className={styles.texto}>
          {atual?.rotulo ?? vazio ?? ''}
        </span>
        <span className={styles.seta} aria-hidden="true">
          <Icone nome="setaBaixo" tamanho={pilula ? 13 : 16} />
        </span>
      </button>
      {erro && (
        <p id={`${id}-erro`} className={ui.campoErro}>
          {erro}
        </p>
      )}
      {aberto &&
        createPortal(
          <div
            ref={lista}
            id={`${id}-lista`}
            role="listbox"
            aria-labelledby={`${id}-rotulo`}
            aria-activedescendant={`${id}-opcao-${ativo}`}
            tabIndex={-1}
            className={styles.lista}
            style={posicao}
            onKeyDown={aoTeclarNaLista}
            onMouseDown={naoArrastar}
            onPointerDown={naoArrastar}
            onTouchStart={naoArrastar}
          >
            {todas.map((opcao, i) => {
              const selecionada = opcao.valor === value
              return (
                <div
                  key={opcao.valor || 'vazio'}
                  id={`${id}-opcao-${i}`}
                  role="option"
                  aria-selected={selecionada}
                  aria-disabled={opcao.desabilitada || undefined}
                  data-valor={opcao.valor}
                  data-ativo={i === ativo || undefined}
                  className={styles.opcao}
                  style={{ '--cor': opcao.valor === '' ? COR_NEUTRA : corDaOpcao(opcao) } as CSSProperties}
                  onMouseEnter={() => setAtivo(i)}
                  onClick={() => {
                    if (!opcao.desabilitada) escolher(opcao.valor)
                  }}
                >
                  <span className={styles.cor} aria-hidden="true" />
                  <span className={styles.texto}>{opcao.rotulo}</span>
                  {selecionada && (
                    <span className={styles.check} aria-hidden="true">
                      <Icone nome="confirmar" tamanho={15} />
                    </span>
                  )}
                </div>
              )
            })}
          </div>,
          document.body,
        )}
    </div>
  )
}
