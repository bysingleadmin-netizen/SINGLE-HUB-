import { useState } from 'react'
import type { FormEvent } from 'react'
import { proximaPosicao } from '@/components/quadro/colunas'
import { AreaTexto } from '@/components/ui/AreaTexto'
import { Button } from '@/components/ui/Button'
import { Campo } from '@/components/ui/Campo'
import { Selecao } from '@/components/ui/Selecao'
import { useToast } from '@/components/ui/Toast'
import ui from '@/components/ui/ui.module.css'
import { useRegistrarAtividade } from '@/dados/atividade'
import { useSalvar } from '@/dados/base'
import { useColunasDoQuadro } from '@/dados/colunas'
import { useColunasOpcionais } from '@/dados/esquema'
import { useCards, useClientes, usePerfis } from '@/dados/tabelas'
import { formNovoCard, validarCard } from '@/features/conteudo/card'
import type { FormCard } from '@/features/conteudo/card'
import type { Erros } from '@/lib/formulario'
import { opcoesDePessoas } from '@/lib/pessoas'
import { COLUNAS_CONTEUDO, PRIORIDADES, TIPOS_CONTEUDO } from '@/lib/rotulos'
import type { ContentCard, ContentEtapa, Prioridade, TipoConteudo } from '@/types/database'

interface FormConteudoProps {
  /** Etapa em que o conteúdo nasce */
  etapaInicial: ContentEtapa
  onFechar: () => void
}

/** Campos e gravação de um conteúdo novo. Para editar, o quadro abre o CardDrawer. */
export function FormConteudo({ etapaInicial, onFechar }: FormConteudoProps) {
  const cards = useCards()
  const clientes = useClientes()
  const perfis = usePerfis()
  const [form, setForm] = useState<FormCard>(() => formNovoCard(etapaInicial))
  const [erros, setErros] = useState<Erros<FormCard>>({})
  const [prioridade, setPrioridade] = useState<Prioridade>('media')
  const esquema = useColunasOpcionais()
  const { colunas } = useColunasDoQuadro('conteudo', COLUNAS_CONTEUDO)
  const salvar = useSalvar<ContentCard>('content_cards')
  const registrarAtividade = useRegistrarAtividade()
  const toast = useToast()

  function mudar<C extends keyof FormCard>(campo: C, valor: FormCard[C]) {
    setForm((atual) => ({ ...atual, [campo]: valor }))
  }

  function aoEnviar(evento: FormEvent) {
    evento.preventDefault()
    const resultado = validarCard(form)
    if ('erros' in resultado) {
      setErros(resultado.erros)
      return
    }
    setErros({})
    const { valores } = resultado
    // O conteúdo novo entra no fim da etapa
    const posicao = proximaPosicao((cards.data ?? []).filter((c) => c.etapa === valores.etapa))

    salvar.mutate(
      {
        valores: {
          ...valores,
          posicao,
          // A média é o padrão do banco; só vai junto quando a pessoa escolhe outra
          ...(esquema.prioridadeConteudo && prioridade !== 'media' ? { prioridade } : {}),
        },
      },
      {
        onSuccess: (salvo) => {
          toast.sucesso('Conteúdo criado.')
          void registrarAtividade({
            acao: 'conteudo_criado',
            descricao: `criou o conteúdo "${salvo.titulo}"`,
            entidade: 'content_cards',
            entidadeId: salvo.id,
          })
          onFechar()
        },
        onError: () => toast.erro('Não foi possível salvar o conteúdo.'),
      },
    )
  }

  return (
    <form className={ui.formulario} onSubmit={aoEnviar} noValidate>
      <Campo
        rotulo="Título"
        autoFocus
        value={form.titulo}
        erro={erros.titulo}
        onChange={(evento) => mudar('titulo', evento.target.value)}
      />
      <div className={ui.duasColunas}>
        <Selecao
          rotulo="Tipo de conteúdo"
          opcoes={TIPOS_CONTEUDO}
          value={form.tipo_conteudo}
          onChange={(evento) => mudar('tipo_conteudo', evento.target.value as TipoConteudo)}
        />
        <Selecao
          rotulo="Etapa"
          opcoes={colunas.map((coluna) => ({ valor: coluna.id, rotulo: coluna.titulo }))}
          value={form.etapa}
          onChange={(evento) => mudar('etapa', evento.target.value as ContentEtapa)}
        />
      </div>
      <div className={ui.duasColunas}>
        <Selecao
          rotulo="Cliente"
          vazio="Sem cliente"
          opcoes={(clientes.data ?? []).map((c) => ({ valor: c.id, rotulo: c.nome }))}
          value={form.client_id}
          onChange={(evento) => mudar('client_id', evento.target.value)}
        />
        <Selecao
          rotulo="Responsável"
          vazio="Sem responsável"
          opcoes={opcoesDePessoas(perfis.data ?? [])}
          value={form.responsavel_id}
          onChange={(evento) => mudar('responsavel_id', evento.target.value)}
        />
      </div>
      <div className={ui.duasColunas}>
        <Campo
          rotulo="Data de entrega"
          type="date"
          value={form.data_entrega}
          onChange={(evento) => mudar('data_entrega', evento.target.value)}
        />
        {esquema.prioridadeConteudo && (
          <Selecao
            rotulo="Prioridade"
            opcoes={PRIORIDADES}
            value={prioridade}
            onChange={(evento) => setPrioridade(evento.target.value as Prioridade)}
          />
        )}
      </div>
      <AreaTexto
        rotulo="Observações"
        rows={3}
        value={form.observacoes}
        onChange={(evento) => mudar('observacoes', evento.target.value)}
      />
      <div className={ui.acoes}>
        <Button variante="fantasma" onClick={onFechar}>
          Cancelar
        </Button>
        <Button type="submit" carregando={salvar.isPending}>
          Salvar
        </Button>
      </div>
    </form>
  )
}
