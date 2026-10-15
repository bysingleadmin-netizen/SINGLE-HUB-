import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Modal } from '@/components/ui/Modal'
import { StatusSelect } from '@/components/ui/StatusSelect'
import { useColunasOpcionais } from '@/dados/esquema'
import type { Tom } from '@/lib/rotulos'
import ui from '@/components/ui/ui.module.css'
import type { Categoria, PedidoDeCriacao } from './CriacaoContext'
import { FormConteudo } from './FormConteudo'
import { FormDemanda } from './FormDemanda'
import { FormTarefaDeCampanha } from './FormTarefaDeCampanha'

const CATEGORIAS: readonly { valor: Categoria; rotulo: string; tom: Tom; destino: string }[] = [
  { valor: 'tarefa', rotulo: 'Tarefa', tom: 'azul', destino: 'Trabalho interno da agência. Vai para o menu Tarefas.' },
  { valor: 'conteudo', rotulo: 'Conteúdo', tom: 'roxo', destino: 'Vai para o menu Conteúdo.' },
  { valor: 'demanda', rotulo: 'Demanda', tom: 'vermelho', destino: 'Pedido de cliente. Vai para o menu Demandas.' },
  { valor: 'campanha', rotulo: 'Anúncio', tom: 'amarelo', destino: 'Tarefa de um anúncio. Vai para o menu Anúncios.' },
]

/** O tipo que a página atual sugere quando a pessoa clica em Criar. */
export function categoriaDaRota(pathname: string): Categoria {
  if (pathname.startsWith('/app/tarefas')) return 'tarefa'
  if (pathname.startsWith('/app/conteudo')) return 'conteudo'
  if (pathname.startsWith('/app/anuncios')) return 'campanha'
  return 'demanda'
}

interface CriarModalProps {
  pedido: PedidoDeCriacao
  onFechar: () => void
}

/**
 * Formulário único de criação. A categoria decide os campos e em qual menu a tarefa aparece;
 * a pessoa cria uma vez só e não precisa estar na tela de destino.
 */
export function CriarModal({ pedido, onFechar }: CriarModalProps) {
  const { pathname } = useLocation()
  const esquema = useColunasOpcionais()
  const [escolhida, setCategoria] = useState<Categoria>(
    () => pedido.categoria ?? categoriaDaRota(pathname),
  )
  // Sem a coluna de quadro (migration 0004) a tarefa interna não tem onde ficar: o tipo some e
  // quem estava nele passa para Demanda. Enquanto o banco é consultado, o tipo fica visível.
  const semTarefas = esquema.pronto && !esquema.quadroTarefas
  const categorias = semTarefas ? CATEGORIAS.filter((item) => item.valor !== 'tarefa') : CATEGORIAS
  const categoria = semTarefas && escolhida === 'tarefa' ? 'demanda' : escolhida
  const atual = categorias.find((item) => item.valor === categoria) ?? categorias[0]

  return (
    <Modal aberto titulo="Nova tarefa" onFechar={onFechar}>
      <div className={ui.formulario}>
        <StatusSelect
          rotulo="Tipo"
          opcoes={categorias}
          value={categoria}
          onChange={(valor) => setCategoria(valor as Categoria)}
        />
        <p className={ui.mudo}>{atual.destino}</p>

        {(categoria === 'demanda' || categoria === 'tarefa') && (
          <FormDemanda
            key={categoria}
            quadro={categoria === 'tarefa' ? 'tarefas' : 'demandas'}
            statusInicial={pedido.status ?? 'a_fazer'}
            onFechar={onFechar}
          />
        )}
        {categoria === 'conteudo' && (
          <FormConteudo etapaInicial={pedido.etapa ?? 'captar_material'} onFechar={onFechar} />
        )}
        {categoria === 'campanha' && (
          <FormTarefaDeCampanha
            campanhaInicial={pedido.campanhaId ?? ''}
            funcaoInicial={pedido.funcao ?? 'copy'}
            statusInicial={pedido.statusDeAnuncio ?? 'pendente'}
            onFechar={onFechar}
          />
        )}
      </div>
    </Modal>
  )
}
