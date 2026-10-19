import { useState } from 'react'
import type { FormEvent } from 'react'
import { AreaTexto } from '@/components/ui/AreaTexto'
import { Button } from '@/components/ui/Button'
import { Campo } from '@/components/ui/Campo'
import { Icone } from '@/components/ui/Icone'
import { Modal } from '@/components/ui/Modal'
import { Selecao } from '@/components/ui/Selecao'
import { SeletorDePessoas } from '@/components/ui/SeletorDePessoas'
import { StatusSelect } from '@/components/ui/StatusSelect'
import { useToast } from '@/components/ui/Toast'
import ui from '@/components/ui/ui.module.css'
import { useRegistrarAtividade } from '@/dados/atividade'
import { useSalvar } from '@/dados/base'
import { useColunasOpcionais } from '@/dados/esquema'
import { usePerfis } from '@/dados/tabelas'
import type { Erros } from '@/lib/formulario'
import { STATUS_CLIENTE } from '@/lib/rotulos'
import type { Client, ClientStatus } from '@/types/database'
import { contatoVazio, formDoCliente, formVazio, validarCliente } from './cliente'
import { DURACOES } from './contrato'
import type { FormCliente, FormContato } from './cliente'
import styles from './clientes.module.css'

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
  const colunas = useColunasOpcionais()
  const perfis = usePerfis()
  const registrarAtividade = useRegistrarAtividade()
  const toast = useToast()

  function campo(nome: Exclude<keyof FormCliente, 'responsaveis' | 'contatos'>) {
    return {
      value: form[nome],
      erro: erros[nome],
      onChange: (evento: { target: { value: string } }) =>
        setForm((atual) => ({ ...atual, [nome]: evento.target.value })),
    }
  }

  function aoEnviar(evento: FormEvent) {
    evento.preventDefault()
    const resultado = validarCliente(form, {
      comVencimento: colunas.diaVencimento,
      comContrato: colunas.contratoMeses,
      comCnpj: colunas.cnpj,
      comBase: colunas.baseDeClientes,
    })
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
        {colunas.cnpj && (
          <Campo rotulo="CNPJ ou CPF" inputMode="numeric" placeholder="00.000.000/0000-00" {...campo('cnpj')} />
        )}
        {colunas.baseDeClientes && (
          <>
            <Campo rotulo="Área de atuação" placeholder="Odontologia, varejo..." {...campo('area_atuacao')} />
            <SeletorDePessoas
              rotulo="Responsáveis da SINGLE"
              pessoas={perfis.data ?? []}
              escolhidas={form.responsaveis}
              onMudar={(responsaveis) => setForm((atual) => ({ ...atual, responsaveis }))}
            />
          </>
        )}
        <div className={ui.duasColunas}>
          <StatusSelect
            rotulo="Status"
            opcoes={STATUS_CLIENTE}
            value={form.status}
            onChange={(valor) =>
              setForm((atual) => ({ ...atual, status: valor as ClientStatus }))
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
          <Campo rotulo="Data de início do contrato" type="date" {...campo('data_inicio_contrato')} />
          {colunas.diaVencimento ? (
            <Campo
              rotulo="Dia do vencimento"
              inputMode="numeric"
              placeholder="1 a 31"
              {...campo('dia_vencimento')}
            />
          ) : (
            <Campo rotulo="Instagram" placeholder="@perfil" {...campo('instagram')} />
          )}
        </div>
        {colunas.contratoMeses && (
          <Selecao
            rotulo="Duração do contrato"
            vazio="Sem fidelidade"
            opcoes={DURACOES.map((meses) => ({ valor: String(meses), rotulo: `${meses} meses` }))}
            value={form.contrato_meses}
            onChange={(evento) =>
              setForm((atual) => ({ ...atual, contrato_meses: evento.target.value }))
            }
          />
        )}
        {colunas.diaVencimento && (
          <Campo rotulo="Instagram" placeholder="@perfil" {...campo('instagram')} />
        )}
        <p className={ui.mudo}>
          {colunas.cnpj
            ? 'As cobranças vêm do Asaas. O CNPJ (ou CPF) liga este cliente ao cadastro dele no Asaas.'
            : 'As cobranças vêm do Asaas e são ligadas a este cliente pelo nome.'}
        </p>
        <Campo
          rotulo="Link da conta de anúncios"
          placeholder="business.facebook.com/..."
          {...campo('link_conta_anuncios')}
        />
        <CamposDeContatos
          contatos={form.contatos}
          varios={colunas.baseDeClientes}
          erro={erros.contatos}
          onMudar={(contatos) => setForm((atual) => ({ ...atual, contatos }))}
        />
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

interface CamposDeContatosProps {
  contatos: FormContato[]
  /** O banco guarda a lista (migration 0012); sem ela, um contato só, sem função */
  varios: boolean
  erro?: string
  onMudar: (contatos: FormContato[]) => void
}

function CamposDeContatos({ contatos, varios, erro, onMudar }: CamposDeContatosProps) {
  const lista = varios ? contatos : contatos.slice(0, 1)

  function mudar(indice: number, campo: keyof FormContato, valor: string) {
    onMudar(contatos.map((c, i) => (i === indice ? { ...c, [campo]: valor } : c)))
  }

  return (
    <div className={styles.contatosForm}>
      {lista.map((contato, i) => (
        <fieldset key={i} className={styles.contatoForm}>
          <legend className={styles.contatoLegenda}>
            {varios ? `Contato ${i + 1}` : 'Contato'}
          </legend>
          {varios && lista.length > 1 && (
            <button
              type="button"
              className={styles.contatoRemover}
              aria-label={`Remover contato ${i + 1}`}
              onClick={() => onMudar(contatos.filter((_, j) => j !== i))}
            >
              <Icone nome="lixeira" tamanho={15} />
            </button>
          )}
          <div className={ui.duasColunas}>
            <Campo
              rotulo="Nome do contato"
              value={contato.nome}
              onChange={(evento) => mudar(i, 'nome', evento.target.value)}
            />
            {varios ? (
              <Campo
                rotulo="Função"
                placeholder="Co-Founder, gerente..."
                value={contato.funcao}
                onChange={(evento) => mudar(i, 'funcao', evento.target.value)}
              />
            ) : (
              <Campo
                rotulo="Telefone do contato"
                type="tel"
                value={contato.telefone}
                onChange={(evento) => mudar(i, 'telefone', evento.target.value)}
              />
            )}
          </div>
          {varios ? (
            <div className={ui.duasColunas}>
              <Campo
                rotulo="Telefone do contato"
                type="tel"
                value={contato.telefone}
                onChange={(evento) => mudar(i, 'telefone', evento.target.value)}
              />
              <Campo
                rotulo="E-mail do contato"
                type="email"
                value={contato.email}
                onChange={(evento) => mudar(i, 'email', evento.target.value)}
              />
            </div>
          ) : (
            <Campo
              rotulo="E-mail do contato"
              type="email"
              value={contato.email}
              onChange={(evento) => mudar(i, 'email', evento.target.value)}
            />
          )}
        </fieldset>
      ))}
      {erro && <p className={ui.campoErro}>{erro}</p>}
      {varios && (
        <Button variante="fantasma" onClick={() => onMudar([...contatos, contatoVazio()])}>
          <Icone nome="mais" tamanho={16} />
          Adicionar contato
        </Button>
      )}
    </div>
  )
}
