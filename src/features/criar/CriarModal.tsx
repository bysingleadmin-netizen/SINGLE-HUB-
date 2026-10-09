import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Selecao } from '@/components/ui/Selecao'
import ui from '@/components/ui/ui.module.css'
import type { Categoria, PedidoDeCriacao } from './CriacaoContext'
import { FormConteudo } from './FormConteudo'
import { FormDemanda } from './FormDemanda'
import { FormTarefaDeCampanha } from './FormTarefaDeCampanha'

const CATEGORIAS: readonly { valor: Categoria; rotulo: string; destino: string }[] = [
  { valor: 'demanda', rotulo: 'Demanda', destino: 'Vai para o menu Demandas.' },
  { valor: 'conteudo', rotulo: 'Conteúdo', destino: 'Vai para o menu Conteúdo.' },
  {
    valor: 'campanha',
    rotulo: 'Tarefa de anúncio',
    destino: 'Vai para o anúncio escolhido, no menu Anúncios.',
  },
]

interface CriarModalProps {
  pedido: PedidoDeCriacao
  onFechar: () => void
}

/**
 * Formulário único de criação. A categoria decide os campos e em qual menu a tarefa aparece;
 * a pessoa cria uma vez só e não precisa estar na tela de destino.
 */
export function CriarModal({ pedido, onFechar }: CriarModalProps) {
  const [categoria, setCategoria] = useState<Categoria>(pedido.categoria ?? 'demanda')
  const atual = CATEGORIAS.find((item) => item.valor === categoria) ?? CATEGORIAS[0]

  return (
    <Modal aberto titulo="Nova tarefa" onFechar={onFechar}>
      <div className={ui.formulario}>
        <Selecao
          rotulo="Categoria"
          opcoes={CATEGORIAS}
          value={categoria}
          onChange={(evento) => setCategoria(evento.target.value as Categoria)}
        />
        <p className={ui.mudo}>{atual.destino}</p>

        {categoria === 'demanda' && (
          <FormDemanda statusInicial={pedido.status ?? 'a_fazer'} onFechar={onFechar} />
        )}
        {categoria === 'conteudo' && (
          <FormConteudo etapaInicial={pedido.etapa ?? 'captar_material'} onFechar={onFechar} />
        )}
        {categoria === 'campanha' && (
          <FormTarefaDeCampanha
            campanhaInicial={pedido.campanhaId ?? ''}
            funcaoInicial={pedido.funcao ?? 'copy'}
            onFechar={onFechar}
          />
        )}
      </div>
    </Modal>
  )
}
