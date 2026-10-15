import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Campo } from '@/components/ui/Campo'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import ui from '@/components/ui/ui.module.css'
import { useRegistrarAtividade } from '@/dados/atividade'
import { useRemoverLead, useSalvarLead } from '@/dados/leads'
import type { Erros } from '@/lib/formulario'
import type { EtapaDoLead, Lead } from '@/types/database'
import { validarLead } from './crm'
import type { FormLead } from './crm'

interface LeadModalProps {
  /** Lead em edição; sem ele, cria um novo na etapa indicada */
  lead?: Lead
  etapa: EtapaDoLead
  posicao: number
  onFechar: () => void
}

export function LeadModal({ lead, etapa, posicao, onFechar }: LeadModalProps) {
  const [form, setForm] = useState<FormLead>({
    nome: lead?.nome ?? '',
    empresa: lead?.empresa ?? '',
    telefone: lead?.telefone ?? '',
    origem: lead?.origem ?? '',
  })
  const [erros, setErros] = useState<Erros<FormLead>>({})
  const salvar = useSalvarLead()
  const remover = useRemoverLead()
  const registrarAtividade = useRegistrarAtividade()
  const toast = useToast()

  const campo = (nome: keyof FormLead) => ({
    value: form[nome],
    erro: erros[nome],
    onChange: (evento: { target: { value: string } }) => setForm((atual) => ({ ...atual, [nome]: evento.target.value })),
  })

  async function aoEnviar(evento: FormEvent) {
    evento.preventDefault()
    const resultado = validarLead(form)
    if ('erros' in resultado) {
      setErros(resultado.erros)
      return
    }
    try {
      const id = await salvar.mutateAsync({ id: lead?.id, valores: resultado.valores, etapa, posicao })
      toast.sucesso(lead ? 'Lead atualizado.' : 'Lead criado.')
      if (!lead) {
        void registrarAtividade({ acao: 'lead_criado', descricao: `criou o lead "${resultado.valores.nome}"`, entidade: 'leads', entidadeId: id })
      }
      onFechar()
    } catch {
      toast.erro('Não foi possível salvar o lead.')
    }
  }

  async function excluir() {
    if (!lead) return
    try {
      await remover.mutateAsync(lead.id)
      toast.sucesso('Lead excluído.')
      onFechar()
    } catch {
      toast.erro('Não foi possível excluir o lead.')
    }
  }

  return (
    <Modal aberto titulo={lead ? 'Editar lead' : 'Novo lead'} onFechar={onFechar}>
      <form className={ui.formulario} onSubmit={aoEnviar} noValidate>
        <Campo rotulo="Nome" autoFocus {...campo('nome')} />
        <Campo rotulo="Empresa" {...campo('empresa')} />
        <div className={ui.duasColunas}>
          <Campo rotulo="Telefone" type="tel" placeholder="(27) 99999-0000" {...campo('telefone')} />
          <Campo rotulo="Origem" placeholder="Instagram, indicação..." {...campo('origem')} />
        </div>
        <div className={ui.acoes}>
          {lead && (
            <Button variante="fantasma" carregando={remover.isPending} onClick={() => void excluir()}>
              Excluir
            </Button>
          )}
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
