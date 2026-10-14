import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Icone } from '@/components/ui/Icone'
import { Modal } from '@/components/ui/Modal'
import ui from '@/components/ui/ui.module.css'
import type { EdicaoDeOpcoes, OpcaoDeCampo } from '@/dados/opcoes'
import { corDe } from '@/lib/rotulos'
import styles from './opcoes.module.css'

interface ConfigurarOpcoesProps {
  /** Nome do campo no plural, como "status" ou "prioridades" */
  campo: string
  opcoes: OpcaoDeCampo[]
  /** Sem a tabela de opções no banco, a engrenagem não aparece */
  edicao: EdicaoDeOpcoes | undefined
}

/**
 * O seletor nativo dispara a cada movimento enquanto a pessoa arrasta; grava só quando ela
 * para por um instante, para não mandar dezenas de gravações.
 */
function SeletorDeCor({ opcao, onEscolher }: { opcao: OpcaoDeCampo; onEscolher: (cor: string) => void }) {
  const [cor, setCor] = useState(corDe(opcao))
  const espera = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(espera.current), [])

  return (
    <input
      type="color"
      className={styles.seletorDeCor}
      aria-label={`Cor de ${opcao.rotulo}`}
      value={cor}
      onChange={(evento) => {
        const nova = evento.target.value
        setCor(nova)
        clearTimeout(espera.current)
        espera.current = setTimeout(() => onEscolher(nova), 400)
      }}
    />
  )
}

function Linha({ opcao, edicao }: { opcao: OpcaoDeCampo; edicao: EdicaoDeOpcoes }) {
  const [nome, setNome] = useState(opcao.rotulo)

  function salvar() {
    const limpo = nome.trim()
    if (limpo === '') setNome(opcao.rotulo)
    else if (limpo !== opcao.rotulo) edicao.renomear(opcao.valor, limpo)
  }

  return (
    <li className={styles.linha}>
      {edicao.colorir ? (
        <SeletorDeCor opcao={opcao} onEscolher={(cor) => edicao.colorir?.(opcao.valor, cor)} />
      ) : (
        <span className={styles.cor} data-tom={opcao.tom} aria-hidden="true" />
      )}
      <input
        className={ui.campoInput}
        aria-label={`Nome de ${opcao.rotulo}`}
        value={nome}
        onChange={(evento) => setNome(evento.target.value)}
        onBlur={salvar}
        onKeyDown={(evento) => evento.key === 'Enter' && evento.currentTarget.blur()}
      />
      {opcao.personalizada ? (
        <button
          type="button"
          className={ui.botaoIcone}
          aria-label={`Remover ${opcao.rotulo}`}
          title="Remover"
          onClick={() => edicao.remover(opcao.valor)}
        >
          <Icone nome="lixeira" tamanho={16} />
        </button>
      ) : (
        // As opções de fábrica só mudam de nome: o sistema usa a chave delas
        <span className={styles.fixa} title="Opção do sistema: pode ser renomeada, não removida">
          padrão
        </span>
      )}
    </li>
  )
}

/**
 * Engrenagem ao lado de um seletor e o modal que ela abre: renomear as opções do campo
 * (salva ao sair do campo) e criar novas.
 */
export function ConfigurarOpcoes({ campo, opcoes, edicao }: ConfigurarOpcoesProps) {
  const [aberto, setAberto] = useState(false)
  const [nova, setNova] = useState('')

  if (!edicao) return null

  function criar(evento: FormEvent) {
    evento.preventDefault()
    const limpo = nova.trim()
    if (limpo === '') return
    edicao?.criar(limpo)
    setNova('')
  }

  return (
    <>
      <button
        type="button"
        className={`${ui.botaoIcone} ${styles.engrenagem}`}
        aria-label={`Configurar ${campo}`}
        title={`Configurar ${campo}`}
        onClick={() => setAberto(true)}
      >
        <Icone nome="configuracoes" tamanho={16} />
      </button>

      {aberto && (
        <Modal aberto titulo={`Configurar ${campo}`} onFechar={() => setAberto(false)}>
          <div className={ui.formulario}>
            <p className={ui.mudo}>
              Mude o nome ou a cor de qualquer opção, ou crie novas. Vale para toda a equipe e não altera os
              cards que já usam a opção.
            </p>
            <ul className={styles.lista}>
              {opcoes.map((opcao) => (
                <Linha key={opcao.valor} opcao={opcao} edicao={edicao} />
              ))}
            </ul>
            <form className={styles.nova} onSubmit={criar}>
              <input
                className={ui.campoInput}
                aria-label="Nome da nova opção"
                placeholder="Nova opção"
                value={nova}
                onChange={(evento) => setNova(evento.target.value)}
              />
              <Button type="submit" variante="secundario">
                Criar
              </Button>
            </form>
          </div>
        </Modal>
      )}
    </>
  )
}
