import { fireEvent, screen, within } from '@testing-library/react'

/** Escolhe uma opção de um StatusSelect pelo valor gravado, como o change de um select nativo. */
export function escolher(campo: HTMLElement, valor: string) {
  fireEvent.click(campo)
  const opcao = screen
    .getByRole('listbox')
    .querySelector<HTMLElement>(`[role="option"][data-valor="${CSS.escape(valor)}"]`)
  if (!opcao) throw new Error(`Opção "${valor}" não existe nesta lista.`)
  fireEvent.click(opcao)
}

/** Escolhe uma pessoa no seletor de responsáveis (digita o nome e clica na sugestão). */
export function escolherPessoa(container: HTMLElement, nome: string, rotulo = 'Responsáveis') {
  const campo = within(container).getByRole('combobox', { name: rotulo })
  fireEvent.change(campo, { target: { value: nome } })
  fireEvent.click(within(container).getByRole('option', { name: new RegExp(nome) }))
}
