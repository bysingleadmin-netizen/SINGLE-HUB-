import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Campo } from '@/components/ui/Campo'
import { Modal } from '@/components/ui/Modal'
import { Selecao } from '@/components/ui/Selecao'
import { useToast } from '@/components/ui/Toast'
import ui from '@/components/ui/ui.module.css'
import { useRegistrarAtividade } from '@/dados/atividade'
import { useConverterLead } from '@/dados/leads'
import { DURACOES } from '@/features/clientes/contrato'
import { hojeISO } from '@/lib/datas'
import type { Erros } from '@/lib/formulario'
import type { Lead } from '@/types/database'
import { validarConversao } from './crm'
import type { FormConversao } from './crm'

/** Obrigatório para o lead chegar a Cliente: sem estes dados, o card não sai do lugar. */
export function ConverterLeadModal({ lead, onFechar }: { lead: Lead; onFechar: () => void }) {
  const [form, setForm] = useState<FormConversao>({ nome: lead.empresa ?? lead.nome, mrr: '', meses: '', inicio: hojeISO() })
  const [erros, setErros] = useState<Erros<FormConversao>>({})
  const converter = useConverterLead()
  const registrarAtividade = useRegistrarAtividade()
  const toast = useToast()

  const campo = (nome: keyof FormConversao) => ({
    value: form[nome],
    erro: erros[nome],
    onChange: (evento: { target: { value: string } }) => setForm((atual) => ({ ...atual, [nome]: evento.target.value })),
  })

  async function aoEnviar(evento: FormEvent) {
    evento.preventDefault()
    const resultado = validarConversao(form)
    if ('erros' in resultado) {
      setErros(resultado.erros)
      return
    }
    try {
      const clienteId = await converter.mutateAsync({ lead, valores: resultado.valores })
      toast.sucesso('Lead convertido em cliente.')
      void registrarAtividade({
        acao: 'lead_convertido',
        descricao: `converteu o lead "${lead.nome}" em cliente`,
        entidade: 'clients',
        entidadeId: clienteId,
      })
      onFechar()
    } catch {
      toast.erro('Não foi possível converter o lead.')
    }
  }

  return (
    <Modal aberto titulo="Converter em cliente" onFechar={onFechar}>
      <form className={ui.formulario} onSubmit={aoEnviar} noValidate>
        <p className={ui.mudo}>O cliente é criado como ativo e o lead sai do CRM.</p>
        <Campo rotulo="Nome do cliente" autoFocus {...campo('nome')} />
        <div className={ui.duasColunas}>
          <Campo rotulo="Valor mensal (MRR)" inputMode="decimal" placeholder="1.500,00" {...campo('mrr')} />
          <Selecao
            rotulo="Duração do contrato"
            vazio="Escolha"
            opcoes={DURACOES.map((meses) => ({ valor: String(meses), rotulo: `${meses} meses` }))}
            erro={erros.meses}
            value={form.meses}
            onChange={(evento) => setForm((atual) => ({ ...atual, meses: evento.target.value }))}
          />
        </div>
        <Campo rotulo="Data de início do contrato" type="date" {...campo('inicio')} />
        <div className={ui.acoes}>
          <Button variante="fantasma" onClick={onFechar}>
            Cancelar
          </Button>
          <Button type="submit" carregando={converter.isPending}>
            Converter
          </Button>
        </div>
      </form>
    </Modal>
  )
}
