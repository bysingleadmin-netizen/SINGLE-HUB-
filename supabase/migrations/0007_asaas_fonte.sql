-- Sistema SINGLE: o Asaas como fonte das receitas dos clientes
--
-- Rode este arquivo inteiro no SQL Editor do Supabase, depois da 0006. Pode rodar mais de uma
-- vez. Nada aqui apaga dados: as cobranças manuais antigas (client_payments) continuam lá.

begin;

-- CNPJ (ou CPF) do cliente, para a sincronização achar o cliente do Asaas pelo documento.
-- Guardado como digitado; a comparação usa só os dígitos.
alter table public.clients add column if not exists cnpj text;

-- Já criadas pela 0006; repetidas para bancos em que a tabela nasceu antes delas
alter table public.receitas_asaas
  add column if not exists tipo text,
  add column if not exists nome_cliente_asaas text;

-- Os totais do Financeiro filtram por status e pela data do pagamento
create index if not exists receitas_asaas_status_idx on public.receitas_asaas (status);
create index if not exists receitas_asaas_pagamento_idx on public.receitas_asaas (data_pagamento);

commit;
