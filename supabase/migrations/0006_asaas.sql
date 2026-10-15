-- Sistema SINGLE: cobranças do Asaas
--
-- Rode este arquivo inteiro no SQL Editor do Supabase, depois da 0005. Pode rodar mais de uma
-- vez. Quem grava nesta tabela é a Edge Function asaas-webhook (com a chave de serviço); o app
-- só lê e vincula cobranças a clientes.

begin;

-- Cliente do sistema ligado ao cliente do Asaas. Um cliente do Asaas pertence a um só cliente
-- daqui; o vazio (null) pode se repetir.
alter table public.clients add column if not exists asaas_customer_id text;
create unique index if not exists clients_asaas_customer_id_key
  on public.clients (asaas_customer_id) where asaas_customer_id is not null;

-- Uma linha por cobrança do Asaas, atualizada a cada evento dela
create table if not exists public.receitas_asaas (
  id uuid primary key default gen_random_uuid(),
  asaas_id text unique not null,
  cliente_id uuid references public.clients (id) on delete set null,
  asaas_customer_id text,
  nome_cliente_asaas text,
  descricao text,
  valor numeric(12, 2),
  data_vencimento date,
  data_pagamento date,
  -- Status do Asaas como veio: PENDING, RECEIVED, CONFIRMED, OVERDUE, REFUNDED, DELETED...
  status text,
  -- BOLETO, PIX ou CREDIT_CARD
  forma_pagamento text,
  -- A forma, ou SUBSCRIPTION quando a cobrança é de uma assinatura
  tipo text,
  vinculado boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists receitas_asaas_customer_idx on public.receitas_asaas (asaas_customer_id);
create index if not exists receitas_asaas_vencimento_idx on public.receitas_asaas (data_vencimento);

-- Dinheiro, como as cobranças dos clientes: só a liderança lê e vincula. A função do webhook
-- usa a chave de serviço, que não passa pela RLS.
grant select, update on public.receitas_asaas to authenticated;
alter table public.receitas_asaas enable row level security;

drop policy if exists "receitas asaas: lideranca" on public.receitas_asaas;
create policy "receitas asaas: lideranca" on public.receitas_asaas
  for all to authenticated
  using ((select private.is_lideranca())) with check ((select private.is_lideranca()));

-- A aba de cobranças do Asaas atualiza sozinha quando chega um evento
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'receitas_asaas'
     ) then
    alter publication supabase_realtime add table public.receitas_asaas;
  end if;
end $$;

commit;
