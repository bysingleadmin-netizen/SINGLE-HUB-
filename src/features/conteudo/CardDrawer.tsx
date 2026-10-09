import { useState } from 'react'
import { useEdicaoInline } from '@/components/quadro/useEdicaoInline'
import { AreaTexto } from '@/components/ui/AreaTexto'
import { Campo } from '@/components/ui/Campo'
import { Drawer } from '@/components/ui/Drawer'
import { Selecao } from '@/components/ui/Selecao'
import ui from '@/components/ui/ui.module.css'
import { textoOuNull } from '@/lib/formulario'
import { COLUNAS_CONTEUDO, TIPOS_CONTEUDO } from '@/lib/rotulos'
import type { Client, ContentCard, ContentEtapa, Profile, TipoConteudo } from '@/types/database'

const OPCOES_ETAPA = COLUNAS_CONTEUDO.map((coluna) => ({ valor: coluna.id, rotulo: coluna.titulo }))

interface CardDrawerProps {
  card: ContentCard
  clientes: Client[]
  perfis: Profile[]
  /** Trocar a etapa é mover o card: quem sabe a posição e registra a atividade é a página */
  onMover: (destino: ContentEtapa) => void
  onFechar: () => void
}

/** Painel lateral do conteúdo. Cada campo salva sozinho: textos ao sair, seleções ao escolher. */
export function CardDrawer({ card, clientes, perfis, onMover, onFechar }: CardDrawerProps) {
  const [titulo, setTitulo] = useState(card.titulo)
  const [observacoes, setObservacoes] = useState(card.observacoes ?? '')
  const [erroTitulo, setErroTitulo] = useState<string>()
  const salvar = useEdicaoInline<ContentCard>('content_cards', card.id, {
    sucesso: 'Conteúdo atualizado.',
    erro: 'Não foi possível salvar o conteúdo.',
  })

  function salvarTitulo() {
    const limpo = titulo.trim()
    if (limpo === '') {
      setErroTitulo('Informe o título do conteúdo.')
      setTitulo(card.titulo)
      return
    }
    setErroTitulo(undefined)
    if (limpo !== card.titulo) salvar({ titulo: limpo })
  }

  function salvarObservacoes() {
    const novas = textoOuNull(observacoes)
    if (novas !== (card.observacoes ?? null)) salvar({ observacoes: novas })
  }

  return (
    <Drawer aberto titulo={card.titulo} onFechar={onFechar}>
      <div className={ui.formulario}>
        <Campo
          rotulo="Título"
          value={titulo}
          erro={erroTitulo}
          onChange={(evento) => setTitulo(evento.target.value)}
          onBlur={salvarTitulo}
        />
        <div className={ui.duasColunas}>
          <Selecao
            rotulo="Etapa"
            opcoes={OPCOES_ETAPA}
            value={card.etapa}
            onChange={(evento) => onMover(evento.target.value as ContentEtapa)}
          />
          <Selecao
            rotulo="Tipo de conteúdo"
            opcoes={TIPOS_CONTEUDO}
            value={card.tipo_conteudo}
            onChange={(evento) => salvar({ tipo_conteudo: evento.target.value as TipoConteudo })}
          />
        </div>
        <div className={ui.duasColunas}>
          <Selecao
            rotulo="Cliente"
            vazio="Sem cliente"
            opcoes={clientes.map((c) => ({ valor: c.id, rotulo: c.nome }))}
            value={card.client_id ?? ''}
            onChange={(evento) => salvar({ client_id: evento.target.value || null })}
          />
          <Selecao
            rotulo="Responsável"
            vazio="Sem responsável"
            opcoes={perfis.map((p) => ({ valor: p.id, rotulo: p.nome }))}
            value={card.responsavel_id ?? ''}
            onChange={(evento) => salvar({ responsavel_id: evento.target.value || null })}
          />
        </div>
        <Campo
          rotulo="Data de entrega"
          type="date"
          value={card.data_entrega ?? ''}
          onChange={(evento) => salvar({ data_entrega: evento.target.value || null })}
        />
        <AreaTexto
          rotulo="Observações"
          placeholder="Salva ao sair do campo."
          value={observacoes}
          onChange={(evento) => setObservacoes(evento.target.value)}
          onBlur={salvarObservacoes}
        />
      </div>
    </Drawer>
  )
}
