import { useState } from 'react'
import type { FormEvent } from 'react'
import { AreaTexto } from '@/components/ui/AreaTexto'
import { Button } from '@/components/ui/Button'
import { Campo } from '@/components/ui/Campo'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import ui from '@/components/ui/ui.module.css'
import { useEditarPagamento } from '@/dados/pagamentos'
import { formatarMoeda } from '@/lib/formato'
import type { Erros } from '@/lib/formulario'
import { parseMoeda } from '@/lib/regras'
import { restante } from './cartoes'
import type { CartaoDePagamento } from './cartoes'
import { formatarMes } from './cliente'
import { formDoCartao, validarEdicaoDePagamento } from './edicaoDePagamento'
import type { FormEdicaoDePagamento } from './edicaoDePagamento'

interface EditarPagamentoModalProps {
  cartao: CartaoDePagamento
  /** "de Scofield" quando a lista mistura clientes */
  deQuem?: string
  onFechar: () => void
}

export function EditarPagamentoModal({ cartao, deQuem, onFechar }: EditarPagamentoModalProps) {
  const [form, setForm] = useState<FormEdicaoDePagamento>(() => formDoCartao(cartao))
  const [erros, setErros] = useState<Erros<FormEdicaoDePagamento>>({})
  const editar = useEditarPagamento()
  const toast = useToast()

  const campo = (nome: keyof FormEdicaoDePagamento) => ({
    value: form[nome],
    erro: erros[nome],
    onChange: (evento: { target: { value: string } }) =>
      setForm((atual) => ({ ...atual, [nome]: evento.target.value })),
  })
  // O restante acompanha a digitação; enquanto um campo não é número, vale o da cobrança
  const total = parseMoeda(form.valor) ?? cartao.valor
  const pago = form.valorPago.trim() === '' ? 0 : (parseMoeda(form.valorPago) ?? cartao.valorPago)

  function aoEnviar(evento: FormEvent) {
    evento.preventDefault()
    const resultado = validarEdicaoDePagamento(form)
    if ('erros' in resultado) {
      setErros(resultado.erros)
      return
    }
    editar.mutate(
      { cartao, valores: resultado.valores },
      {
        onSuccess: () => {
          toast.sucesso('Cobrança atualizada.')
          onFechar()
        },
        onError: () => toast.erro('Não foi possível salvar a cobrança.'),
      },
    )
  }

  return (
    <Modal
      aberto
      titulo={`Editar cobrança de ${formatarMes(cartao.mes)}${deQuem ? ` ${deQuem}` : ''}`}
      onFechar={onFechar}
    >
      <form className={ui.formulario} onSubmit={aoEnviar} noValidate>
        <div className={ui.duasColunas}>
          <Campo rotulo="Valor total da cobrança" inputMode="decimal" {...campo('valor')} />
          <Campo rotulo="Valor já pago" inputMode="decimal" placeholder="0,00" {...campo('valorPago')} />
        </div>
        <Campo rotulo="Data do pagamento" type="date" {...campo('pagoEm')} />
        <p aria-live="polite">
          Restante: <strong>{formatarMoeda(restante(total, pago))}</strong>
        </p>
        <AreaTexto
          rotulo="Observação"
          value={form.observacao}
          onChange={(evento) => setForm((atual) => ({ ...atual, observacao: evento.target.value }))}
        />
        <div className={ui.acoes}>
          <Button variante="fantasma" onClick={onFechar}>
            Cancelar
          </Button>
          <Button type="submit" carregando={editar.isPending}>
            Salvar
          </Button>
        </div>
      </form>
    </Modal>
  )
}
