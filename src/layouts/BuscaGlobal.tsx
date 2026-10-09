import { useEffect, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { EstadoVazio } from '@/components/ui/Estado'
import { Icone } from '@/components/ui/Icone'
import type { NomeIcone } from '@/components/ui/Icone'
import { Modal } from '@/components/ui/Modal'
import ui from '@/components/ui/ui.module.css'
import { juntarConsultas } from '@/dados/base'
import { useCampanhas, useCards, useClientes, useTarefas } from '@/dados/tabelas'
import { buscar } from './busca'
import type { Resultado, TipoDeResultado } from './busca'
import styles from './layout.module.css'

const TIPOS: Record<TipoDeResultado, { rotulo: string; icone: NomeIcone }> = {
  cliente: { rotulo: 'Cliente', icone: 'clientes' },
  demanda: { rotulo: 'Demanda', icone: 'demandas' },
  conteudo: { rotulo: 'Conteúdo', icone: 'conteudo' },
  campanha: { rotulo: 'Anúncio', icone: 'campanhas' },
}

function Paleta({ onFechar }: { onFechar: () => void }) {
  const clientes = useClientes()
  const tarefas = useTarefas()
  const cards = useCards()
  const campanhas = useCampanhas()
  const navigate = useNavigate()
  const [termo, setTermo] = useState('')
  const [escolhido, setEscolhido] = useState(0)

  const consultas = juntarConsultas(clientes, tarefas, cards, campanhas)
  const resultados = buscar(termo, {
    clientes: clientes.data ?? [],
    tarefas: tarefas.data ?? [],
    cards: cards.data ?? [],
    campanhas: campanhas.data ?? [],
  })
  const indice = Math.min(escolhido, Math.max(resultados.length - 1, 0))

  function ir(resultado: Resultado) {
    onFechar()
    navigate(resultado.rota)
  }

  function aoTeclar(evento: KeyboardEvent) {
    if (evento.key === 'ArrowDown' || evento.key === 'ArrowUp') {
      evento.preventDefault()
      if (resultados.length === 0) return
      const passo = evento.key === 'ArrowDown' ? 1 : -1
      setEscolhido((indice + passo + resultados.length) % resultados.length)
    } else if (evento.key === 'Enter' && resultados[indice]) {
      evento.preventDefault()
      ir(resultados[indice])
    }
  }

  return (
    <div className={styles.busca}>
      <input
        className={ui.campoInput}
        role="combobox"
        aria-label="Buscar"
        aria-expanded={resultados.length > 0}
        aria-controls="busca-resultados"
        aria-autocomplete="list"
        autoComplete="off"
        autoFocus
        placeholder="Cliente, demanda, conteúdo ou anúncio"
        value={termo}
        onChange={(evento) => {
          setTermo(evento.target.value)
          setEscolhido(0)
        }}
        onKeyDown={aoTeclar}
      />

      {consultas.erro ? (
        <p className={ui.mudo}>Não foi possível carregar os dados para a busca.</p>
      ) : consultas.carregando ? (
        <p className={ui.mudo}>Carregando…</p>
      ) : termo.trim() === '' ? (
        <p className={ui.mudo}>Digite para procurar em clientes, demandas, conteúdos e anúncios.</p>
      ) : resultados.length === 0 ? (
        <EstadoVazio ilustracao="busca" titulo={`Nada encontrado para "${termo.trim()}".`} />
      ) : (
        <ul id="busca-resultados" role="listbox" aria-label="Resultados" className={styles.buscaLista}>
          {resultados.map((resultado, i) => {
            const tipo = TIPOS[resultado.tipo]
            return (
              <li
                key={`${resultado.tipo}-${resultado.id}`}
                role="option"
                aria-selected={i === indice}
                className={styles.buscaItem}
                onMouseEnter={() => setEscolhido(i)}
                onClick={() => ir(resultado)}
              >
                <Icone nome={tipo.icone} tamanho={18} />
                <span className={styles.buscaNome}>{resultado.nome}</span>
                <span className={ui.mudo}>{tipo.rotulo}</span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

/** Botão de busca do cabeçalho e a paleta que ele abre. Ctrl+K (ou Cmd+K) também abre. */
export function BuscaGlobal() {
  const [aberta, setAberta] = useState(false)

  useEffect(() => {
    function aoTeclar(evento: globalThis.KeyboardEvent) {
      if ((evento.ctrlKey || evento.metaKey) && evento.key.toLowerCase() === 'k') {
        evento.preventDefault()
        setAberta(true)
      }
    }
    document.addEventListener('keydown', aoTeclar)
    return () => document.removeEventListener('keydown', aoTeclar)
  }, [])

  return (
    <>
      <button
        type="button"
        className={styles.buscaBotao}
        aria-label="Buscar"
        onClick={() => setAberta(true)}
      >
        <Icone nome="busca" tamanho={18} />
        <span className={styles.buscaTexto}>Buscar</span>
        <kbd className={styles.buscaAtalho}>Ctrl K</kbd>
      </button>
      {aberta && (
        <Modal aberto titulo="Buscar" onFechar={() => setAberta(false)}>
          <Paleta onFechar={() => setAberta(false)} />
        </Modal>
      )}
    </>
  )
}
