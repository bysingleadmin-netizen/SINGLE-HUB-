import { useRef, useState } from 'react'
import type { SyntheticEvent } from 'react'
import { Flutuante } from './Flutuante'
import { Icone } from './Icone'
import type { NomeIcone } from './Icone'
import styles from './menuDeAcoes.module.css'

export interface AcaoDoMenu {
  rotulo: string
  icone: NomeIcone
  /** Ação destrutiva: aparece em vermelho */
  perigo?: boolean
  /** Sem subações, executa ao escolher */
  onEscolher?: () => void
  /** Abre uma segunda lista no lugar da primeira, como "Mover para…" com as colunas */
  subacoes?: { rotulo: string; onEscolher: () => void }[]
}

interface MenuDeAcoesProps {
  /** Nome acessível do botão e do menu, como "Ações de Roteiro de reels" */
  rotulo: string
  acoes: AcaoDoMenu[]
  className?: string
}

// Dentro de um card arrastável ou de uma linha que abre algo, o menu não pode disparar isso
const parar = (evento: SyntheticEvent) => evento.stopPropagation()

/** Botão ⋯ que abre as ações de um item. Fecha ao escolher, ao clicar fora e com Escape. */
export function MenuDeAcoes({ rotulo, acoes, className }: MenuDeAcoesProps) {
  const [aberto, setAberto] = useState(false)
  const [sub, setSub] = useState<AcaoDoMenu>()
  const raiz = useRef<HTMLDivElement>(null)
  const botao = useRef<HTMLButtonElement>(null)

  function fechar() {
    setAberto(false)
    setSub(undefined)
  }

  return (
    <div
      ref={raiz}
      className={[styles.menu, className].filter(Boolean).join(' ')}
      data-aberto={aberto || undefined}
      onMouseDown={parar}
      onTouchStart={parar}
      onPointerDown={parar}
      onClick={parar}
    >
      <button
        ref={botao}
        type="button"
        className={styles.gatilho}
        aria-label={rotulo}
        aria-haspopup="menu"
        aria-expanded={aberto}
        title="Ações"
        onClick={() => (aberto ? fechar() : setAberto(true))}
      >
        <Icone nome="acoes" tamanho={18} />
      </button>
      {aberto && (
        <Flutuante
          ancora={raiz}
          onFechar={() => {
            fechar()
            botao.current?.focus()
          }}
        >
          <div className={styles.lista} role="menu" aria-label={sub ? sub.rotulo : rotulo}>
            {sub ? (
              <>
                <button type="button" role="menuitem" className={styles.item} onClick={() => setSub(undefined)}>
                  <Icone nome="setaEsquerda" tamanho={16} />
                  Voltar
                </button>
                {sub.subacoes?.map((subacao) => (
                  <button
                    key={subacao.rotulo}
                    type="button"
                    role="menuitem"
                    className={styles.item}
                    onClick={() => {
                      fechar()
                      subacao.onEscolher()
                    }}
                  >
                    <span className={styles.recuo} aria-hidden="true" />
                    {subacao.rotulo}
                  </button>
                ))}
              </>
            ) : (
              acoes.map((acao) => (
                <button
                  key={acao.rotulo}
                  type="button"
                  role="menuitem"
                  aria-haspopup={acao.subacoes ? 'menu' : undefined}
                  className={styles.item}
                  data-perigo={acao.perigo || undefined}
                  onClick={() => {
                    if (acao.subacoes) {
                      setSub(acao)
                      return
                    }
                    fechar()
                    acao.onEscolher?.()
                  }}
                >
                  <Icone nome={acao.icone} tamanho={16} />
                  {acao.rotulo}
                  {acao.subacoes && (
                    <span className={styles.seta} aria-hidden="true">
                      <Icone nome="seta" tamanho={14} />
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </Flutuante>
      )}
    </div>
  )
}

interface ConfirmarExclusaoProps {
  nome: string
  /** O que mais sai junto, dito antes do "não pode ser desfeita" */
  aviso?: string
  carregando?: boolean
  onCancelar: () => void
  onConfirmar: () => void
}

/** Confirmação no próprio item, no lugar do window.confirm. */
export function ConfirmarExclusao({ nome, aviso, carregando, onCancelar, onConfirmar }: ConfirmarExclusaoProps) {
  return (
    <div
      className={styles.confirmar}
      role="group"
      aria-label={`Confirmar exclusão de ${nome}`}
      onMouseDown={parar}
      onTouchStart={parar}
      onPointerDown={parar}
      onClick={parar}
      onKeyDown={(evento) => {
        if (evento.key === 'Escape') onCancelar()
      }}
    >
      <p className={styles.confirmarTexto}>
        {`Excluir ${nome}? ${aviso ? `${aviso} ` : ''}Esta ação não pode ser desfeita.`}
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

interface MenuAcoesProps {
  /** Nome do item, usado no botão ("Ações de …") e na confirmação */
  nome: string
  /** Abre o mesmo formulário da criação, preenchido. Sem ele, o menu não tem Editar */
  onEditar?: () => void
  /** Exclusão definitiva, depois da confirmação. Sem ele, o menu não tem Excluir */
  onExcluir?: () => void
  /** O que mais sai junto com o item, mostrado na confirmação */
  aviso?: string
  className?: string
}

/**
 * Padrão de todo item do sistema: ⋯ com Editar e Excluir. A exclusão pede confirmação numa
 * caixa presa ao próprio item.
 */
export function MenuAcoes({ nome, onEditar, onExcluir, aviso, className }: MenuAcoesProps) {
  const [confirmando, setConfirmando] = useState(false)
  const raiz = useRef<HTMLDivElement>(null)
  const acoes: AcaoDoMenu[] = [
    ...(onEditar ? [{ rotulo: 'Editar', icone: 'editar' as const, onEscolher: onEditar }] : []),
    ...(onExcluir
      ? [{ rotulo: 'Excluir', icone: 'lixeira' as const, perigo: true, onEscolher: () => setConfirmando(true) }]
      : []),
  ]
  if (acoes.length === 0) return null

  return (
    <div ref={raiz} className={[styles.menuAcoes, className].filter(Boolean).join(' ')} data-aberto={confirmando || undefined}>
      <MenuDeAcoes rotulo={`Ações de ${nome}`} acoes={acoes} />
      {confirmando && onExcluir && (
        <Flutuante ancora={raiz} onFechar={() => setConfirmando(false)} className={styles.confirmarFlutuante}>
          <ConfirmarExclusao
            nome={nome}
            aviso={aviso}
            onCancelar={() => setConfirmando(false)}
            onConfirmar={() => {
              setConfirmando(false)
              onExcluir()
            }}
          />
        </Flutuante>
      )}
    </div>
  )
}
