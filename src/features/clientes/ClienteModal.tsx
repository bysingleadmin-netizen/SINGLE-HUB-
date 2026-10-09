import { useState } from 'react'
import type { FormEvent } from 'react'
import { AreaTexto } from '@/components/ui/AreaTexto'
import { Button } from '@/components/ui/Button'
import { Campo } from '@/components/ui/Campo'
import { Modal } from '@/components/ui/Modal'
import { Selecao } from '@/components/ui/Selecao'
import { useToast } from '@/components/ui/Toast'
import ui from '@/components/ui/ui.module.css'
import { useRegistrarAtividade } from '@/dados/atividade'
import { useSalvar } from '@/dados/base'
import type { Erros } from '@/lib/formulario'
import { STATUS_CLIENTE } from '@/lib/rotulos'
import type { Client, ClientStatus } from '@/types/database'
import { formDoCliente, formVazio, validarCliente } from './cliente'
import type { FormCliente } from './cliente'

interface ClienteModalProps {
  /** Cliente em edição; sem ele, o modal cadastra um novo */
  cliente?: Client
  onFechar: () => void
}

export function ClienteModal({ cliente, onFechar }: ClienteModalProps) {
  const [form, setForm] = useState<FormCliente>(() =>
    cliente ? formDoCliente(cliente) : formVazio(),
  )
  const [erros, setErros] = useState<Erros<FormCliente>>({})
  const salvar = useSalvar<Client>('clients')
  const registrarAtividade = useRegistrarAtividade()
  const toast = useToast()

  function campo(nome: keyof FormCliente) {
    return {
      value: form[nome],
      erro: erros[nome],
      onChange: (evento: { target: { value: string } }) =>
        setForm((atual) => ({ ...atual, [nome]: evento.target.value })),
    }
  }

  function aoEnviar(evento: FormEvent) {
    evento.preventDefault()
    const resultado = validarCliente(form)
    if ('erros' in resultado) {
      setErros(resultado.erros)
      return
    }
    setErros({})
    salvar.mutate(
      { id: cliente?.id, valores: resultado.valores },
      {
        onSuccess: (salvo) => {
          toast.sucesso(cliente ? 'Cliente atualizado.' : 'Cliente cadastrado.')
          if (!cliente) {
            void registrarAtividade({
              acao: 'cliente_criado',
              descricao: `cadastrou o cliente "${salvo.nome}"`,
              entidade: 'clients',
              entidadeId: salvo.id,
            })
          }
          onFechar()
        },
        onError: () => toast.erro('Não foi possível salvar o cliente.'),
      },
    )
  }

  return (
    <Modal aberto titulo={cliente ? 'Editar cliente' : 'Novo cliente'} onFechar={onFechar}>
      <form className={ui.formulario} onSubmit={aoEnviar} noValidate>
        <Campo rotulo="Nome" autoFocus {...campo('nome')} />
        <div className={ui.duasColunas}>
          <Selecao
            rotulo="Status"
            opcoes={STATUS_CLIENTE}
            value={form.status}
            onChange={(evento) =>
              setForm((atual) => ({ ...atual, status: evento.target.value as ClientStatus }))
            }
          />
          <Campo
            rotulo="Valor mensal (MRR)"
            inputMode="decimal"
            placeholder="1.500,00"
            {...campo('mrr')}
          />
        </div>
        <div className={ui.duasColunas}>
          <Campo rotulo="Início do contrato" type="date" {...campo('data_inicio_contrato')} />
          <Campo rotulo="Instagram" placeholder="@perfil" {...campo('instagram')} />
        </div>
        <Campo
          rotulo="Link da conta de anúncios"
          placeholder="business.facebook.com/..."
          {...campo('link_conta_anuncios')}
        />
        <div className={ui.duasColunas}>
          <Campo rotulo="Nome do contato" {...campo('contato_nome')} />
          <Campo rotulo="Telefone do contato" type="tel" {...campo('contato_telefone')} />
        </div>
        <Campo rotulo="E-mail do contato" type="email" {...campo('contato_email')} />
        <AreaTexto
          rotulo="Observações"
          value={form.observacoes}
          onChange={(evento) => setForm((atual) => ({ ...atual, observacoes: evento.target.value }))}
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
    </Modal>
  )
}
