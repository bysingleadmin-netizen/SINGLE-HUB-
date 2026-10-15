import { fireEvent, screen } from '@testing-library/react'

/** Escolhe uma opção de um StatusSelect pelo valor gravado, como o change de um select nativo. */
export function escolher(campo: HTMLElement, valor: string) {
  fireEvent.click(campo)
  const opcao = screen
    .getByRole('listbox')
    .querySelector<HTMLElement>(`[role="option"][data-valor="${CSS.escape(valor)}"]`)
  if (!opcao) throw new Error(`Opção "${valor}" não existe nesta lista.`)
  fireEvent.click(opcao)
}
