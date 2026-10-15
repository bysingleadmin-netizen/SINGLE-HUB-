import { useEffect, useRef, useState } from 'react'
import type { SyntheticEvent } from 'react'
import { Icone } from './Icone'
import type { NomeIcone } from './Icone'
import styles from './menuDeAcoes.module.css'

export interface AcaoDoMenu {
  rotulo: string
  icone: NomeIcone
  /** Ação destrutiva: aparece em vermelho */
  perigo?: boolean
  onEscolher: () => void
}

interface MenuDeAcoesProps {
  /** Nome acessível do botão e do menu, como "Ações de Roteiro de reels" */
  rotulo: string
  acoes: AcaoDoMenu[]
  className?: string
}

// Dentro de um card arrastável, apertar o menu não pode começar um arraste
const naoArrastar = (evento: SyntheticEvent) => evento.stopPropagation()

/** Botão ⋯ que abre as ações de um item. Fecha ao escolher, ao clicar fora e com Escape. */
export function MenuDeAcoes({ rotulo, acoes, className }: MenuDeAcoesProps) {
  const [aberto, setAberto] = useState(false)
  const raiz = useRef<HTMLDivElement>(null)
  const botao = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!aberto) return
    function aoClicarFora(evento: MouseEvent) {
      if (!raiz.current?.contains(evento.target as Node)) setAberto(false)
    }
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key !== 'Escape') return
      setAberto(false)
      botao.current?.focus()
    }
    document.addEventListener('mousedown', aoClicarFora)
    document.addEventListener('keydown', aoTeclar)
    return () => {
      document.removeEventListener('mousedown', aoClicarFora)
      document.removeEventListener('keydown', aoTeclar)
    }
  }, [aberto])

  return (
    <div
      ref={raiz}
      className={[styles.menu, className].filter(Boolean).join(' ')}
      data-aberto={aberto || undefined}
      onMouseDown={naoArrastar}
      onTouchStart={naoArrastar}
      onPointerDown={naoArrastar}
    >
      <button
        ref={botao}
        type="button"
        className={styles.gatilho}
        aria-label={rotulo}
        aria-haspopup="menu"
        aria-expanded={aberto}
        title="Ações"
        onClick={() => setAberto((atual) => !atual)}
      >
        <Icone nome="acoes" tamanho={18} />
      </button>
      {aberto && (
        <div className={styles.lista} role="menu" aria-label={rotulo}>
          {acoes.map((acao) => (
            <button
              key={acao.rotulo}
              type="button"
              role="menuitem"
              className={styles.item}
              data-perigo={acao.perigo || undefined}
              onClick={() => {
                setAberto(false)
                acao.onEscolher()
              }}
            >
              <Icone nome={acao.icone} tamanho={16} />
              {acao.rotulo}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

interface ConfirmarExclusaoProps {
  nome: string
  carregando?: boolean
  onCancelar: () => void
  onConfirmar: () => void
}

/** Confirmação no próprio item, no lugar do window.confirm. */
export function ConfirmarExclusao({ nome, carregando, onCancelar, onConfirmar }: ConfirmarExclusaoProps) {
  return (
    <div
      className={styles.confirmar}
      role="group"
      aria-label={`Confirmar exclusão de ${nome}`}
      onMouseDown={naoArrastar}
      onTouchStart={naoArrastar}
      onPointerDown={naoArrastar}
      onKeyDown={(evento) => {
        if (evento.key === 'Escape') onCancelar()
      }}
    >
      <p className={styles.confirmarTexto}>
        {`Excluir ${nome}? Esta ação não pode ser desfeita.`}
      </p>
      <div className={styles.confirmarAcoes}>
        <button type="button" className={styles.cancelar} onClick={onCancelar} autoFocus>
          Cancelar
        </button>
        <button
          type="button"
          className={styles.excluir}
          onClick={onConfirmar}
          disabled={carregando}
          aria-busy={carregando || undefined}
        >
          <Icone nome="lixeira" tamanho={15} />
          Excluir
        </button>
      </div>
    </div>
  )
}
