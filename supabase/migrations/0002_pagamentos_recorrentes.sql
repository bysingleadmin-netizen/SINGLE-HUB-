-- Sistema SINGLE: pagamentos recorrentes
-- Rode este arquivo inteiro no SQL Editor do Supabase. Pode rodar mais de uma vez sem problema.
--
-- O app funciona sem estas colunas. Com elas:
--   * o cadastro do cliente ganha o campo "Dia do vencimento" (sem ele, o vencimento
--     cai no mesmo dia do mês em que o contrato começou);
--   * a confirmação de pagamento passa a guardar se foi por Pix ou em dinheiro.

alter table public.clients
  add column if not exists dia_vencimento smallint
  check (dia_vencimento between 1 and 31);

alter table public.client_payments
  add column if not exists forma_pagamento text
  check (forma_pagamento in ('pix', 'dinheiro'));
