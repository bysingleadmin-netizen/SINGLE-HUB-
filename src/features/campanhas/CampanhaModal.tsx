import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Campo } from '@/components/ui/Campo'
import { Modal } from '@/components/ui/Modal'
import { Selecao } from '@/components/ui/Selecao'
import { useToast } from '@/components/ui/Toast'
import ui from '@/components/ui/ui.module.css'
import { useRegistrarAtividade } from '@/dados/atividade'
import { useSalvar } from '@/dados/base'
import type { Erros } from '@/lib/formulario'
import { STATUS_CAMPANHA } from '@/lib/rotulos'
import type { Campaign, CampaignStatus, Client } from '@/types/database'
import { formDaCampanha, formNovaCampanha, validarCampanha } from './campanha'
import type { FormCampanha } from './campanha'

interface CampanhaModalProps {
  /** Campanha em edição; sem ela, o modal cria uma nova */
  campanha?: Campaign
  clientes: Client[]
  onFechar: () => void
}

export function CampanhaModal({ campanha, clientes, onFechar }: CampanhaModalProps) {
  const [form, setForm] = useState<FormCampanha>(() =>
    campanha ? formDaCampanha(campanha) : formNovaCampanha(),
  )
  const [erros, setErros] = useState<Erros<FormCampanha>>({})
  const salvar = useSalvar<Campaign>('campaigns')
  const registrarAtividade = useRegistrarAtividade()
  const toast = useToast()
  const titulo = campanha ? 'Editar anúncio' : 'Novo anúncio'

  function campo(nome: keyof FormCampanha) {
    return {
      value: form[nome],
      erro: erros[nome],
      onChange: (evento: { target: { value: string } }) =>
        setForm((atual) => ({ ...atual, [nome]: evento.target.value })),
    }
  }

  function aoEnviar(evento: FormEvent) {
    evento.preventDefault()
    const resultado = validarCampanha(form)
    if ('erros' in resultado) {
      setErros(resultado.erros)
      return
    }
    setErros({})
    salvar.mutate(
      { id: campanha?.id, valores: resultado.valores },
      {
        onSuccess: (salva) => {
          toast.sucesso(campanha ? 'Anúncio atualizado.' : 'Anúncio criado.')
          if (!campanha) {
            void registrarAtividade({
              acao: 'campanha_criada',
              descricao: `criou o anúncio "${salva.nome}"`,
              entidade: 'campaigns',
              entidadeId: salva.id,
            })
          }
          onFechar()
        },
        onError: () => toast.erro('Não foi possível salvar o anúncio.'),
      },
    )
  }

  if (clientes.length === 0) {
    return (
      <Modal aberto titulo={titulo} onFechar={onFechar}>
        <div className={ui.formulario}>
          <p>Cadastre um cliente antes de criar um anúncio.</p>
          <Link to="/app/clientes" className={ui.linkAcao}>
            Ir para Clientes
          </Link>
        </div>
      </Modal>
    )
  }

  return (
    <Modal aberto titulo={titulo} onFechar={onFechar}>
      <form className={ui.formulario} onSubmit={aoEnviar} noValidate>
        <Campo rotulo="Nome" autoFocus {...campo('nome')} />
        <div className={ui.duasColunas}>
          <Selecao
            rotulo="Cliente"
            vazio="Escolha o cliente"
            opcoes={clientes.map((c) => ({ valor: c.id, rotulo: c.nome }))}
            {...campo('client_id')}
          />
          <Selecao
            rotulo="Status"
            opcoes={STATUS_CAMPANHA}
            value={form.status}
            onChange={(evento) =>
              setForm((atual) => ({ ...atual, status: evento.target.value as CampaignStatus }))
            }
          />
        </div>
        <div className={ui.duasColunas}>
          <Campo rotulo="Início" type="date" {...campo('data_inicio')} />
          <Campo rotulo="Fim" type="date" {...campo('data_fim')} />
        </div>
        <div className={ui.duasColunas}>
          <Campo
            rotulo="Orçamento"
            inputMode="decimal"
            placeholder="3.000,00"
            {...campo('orcamento')}
          />
          <Campo rotulo="Próxima otimização" type="date" {...campo('proxima_otimizacao')} />
        </div>
        <div className={ui.acoes}>
          <Button variante="fantasma" onClick={onFechar}>
            Cancelar
          </Button>
          <Button type="submit" carregando={salvar.isPending}>
            Salvar
          </Button>
        </div>
      </form>
    </Modal>
  )
}
