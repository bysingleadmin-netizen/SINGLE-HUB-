-- Sistema SINGLE: Etapa 8 (contrato de fidelidade, pagamentos parciais, quadros por tipo,
-- cores dos status e CRM de leads)
--
-- Rode este arquivo inteiro no SQL Editor do Supabase, depois da 0003. Pode rodar mais de uma
-- vez: cada passo confere antes se já foi feito. Se algum passo falhar, nada é aplicado.
-- O app funciona sem esta migration, com menos recursos (veja docs/INTEGRACOES.md).

begin;

-- ---------------------------------------------------------------------------
-- 1. Contrato de fidelidade
-- ---------------------------------------------------------------------------
-- O início do contrato é a data_inicio_contrato que já existe (e já define as cobranças);
-- aqui entra só a duração.
alter table public.clients add column if not exists contrato_meses smallint;
alter table public.clients drop constraint if exists clients_contrato_meses_check;
alter table public.clients
  add constraint clients_contrato_meses_check check (contrato_meses in (3, 6, 12, 15));

-- ---------------------------------------------------------------------------
-- 2. Pagamentos parciais
-- ---------------------------------------------------------------------------
-- valor_pago: quanto da cobrança já entrou (0 a valor). pago_em: data do último recebimento.
-- valor_manual: o valor total foi editado à mão, então a sincronização com o cadastro do
-- cliente deixa de reescrevê-lo.
alter table public.client_payments add column if not exists valor_pago numeric(12, 2) not null default 0;
alter table public.client_payments add column if not exists pago_em date;
alter table public.client_payments add column if not exists observacao_pagamento text;
alter table public.client_payments add column if not exists valor_manual boolean not null default false;
alter table public.client_payments drop constraint if exists client_payments_valor_pago_check;
alter table public.client_payments
  add constraint client_payments_valor_pago_check check (valor_pago >= 0);

-- O que já foi pago antes desta migration foi pago inteiro
update public.client_payments
set valor_pago = valor, pago_em = coalesce(pago_em, data_pagamento)
where status = 'pago' and valor_pago = 0;

-- ---------------------------------------------------------------------------
-- 3. Quadros por tipo e cores dos status
-- ---------------------------------------------------------------------------
-- Cor de cada opção configurável (status, prioridade, tipo de conteúdo), em #rrggbb.
-- Sem cor gravada, o app usa a cor padrão da opção.
alter table public.card_options add column if not exists cor text;
alter table public.card_options drop constraint if exists card_options_cor_check;
alter table public.card_options
  add constraint card_options_cor_check check (cor is null or cor ~ '^#[0-9a-fA-F]{6}$');

-- Tarefas internas usam a mesma tabela das demandas, marcadas pelo quadro. Tarefa interna
-- não tem área (conteúdo, tráfego...), então `tipo` deixa de ser obrigatório.
alter table public.tasks add column if not exists quadro text not null default 'demandas';
alter table public.tasks drop constraint if exists tasks_quadro_check;
alter table public.tasks add constraint tasks_quadro_check check (quadro in ('demandas', 'tarefas'));
alter table public.tasks alter column tipo drop not null;
create index if not exists tasks_quadro_idx on public.tasks (quadro);

-- Colunas, anexos e subtarefas passam a aceitar os quadros novos
do $$
declare
  restricao record;
begin
  for restricao in
    select conrelid::regclass as tabela, conname
    from pg_constraint
    where contype = 'c'
      and conrelid in ('public.board_columns'::regclass, 'public.card_attachments'::regclass,
                       'public.card_subtarefas'::regclass)
      and pg_get_constraintdef(oid) ilike '%quadro%'
  loop
    execute format('alter table %s drop constraint %I', restricao.tabela, restricao.conname);
  end loop;
end $$;

alter table public.board_columns add constraint board_columns_quadro_check
  check (quadro in ('demandas', 'conteudo', 'tarefas', 'anuncios'));
alter table public.card_attachments add constraint card_attachments_quadro_check
  check (quadro in ('demandas', 'conteudo', 'tarefas', 'anuncios'));
alter table public.card_subtarefas add constraint card_subtarefas_quadro_check
  check (quadro in ('demandas', 'conteudo', 'tarefas', 'anuncios'));

-- Tarefas de anúncio viram quadro: ganham posição na coluna, e a lista fechada de status sai
-- para a equipe poder criar colunas.
alter table public.campaign_tasks add column if not exists posicao double precision not null default 0;

do $$
declare
  restricao record;
begin
  for restricao in
    select conname from pg_constraint
    where conrelid = 'public.campaign_tasks'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.campaign_tasks drop constraint %I', restricao.conname);
  end loop;
end $$;

alter table public.campaign_tasks add constraint campaign_tasks_status_check check (status <> '');

-- ---------------------------------------------------------------------------
-- 4. CRM de leads (só liderança)
-- ---------------------------------------------------------------------------
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (nome <> ''),
  empresa text,
  telefone text,
  origem text,
  etapa text not null default 'leads' check (etapa in ('leads', 'reuniao', 'fechamento')),
  -- Quando o lead entrou na etapa atual
  etapa_desde timestamptz not null default now(),
  posicao double precision not null default 0,
  -- Convertido em cliente: sai do quadro, mas fica para a taxa de conversão
  convertido_em timestamptz,
  client_id uuid references public.clients (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- Cada mudança de etapa, inclusive a conversão ('cliente')
create table if not exists public.lead_historico (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  etapa_de text,
  etapa_para text not null,
  user_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists leads_etapa_idx on public.leads (etapa, posicao);
create index if not exists leads_created_at_idx on public.leads (created_at);
create index if not exists lead_historico_lead_idx on public.lead_historico (lead_id, created_at);

grant select, insert, update, delete on public.leads, public.lead_historico to authenticated;
alter table public.leads enable row level security;
alter table public.lead_historico enable row level security;

drop policy if exists "leads: lideranca" on public.leads;
create policy "leads: lideranca" on public.leads
  for all to authenticated
  using ((select private.is_lideranca())) with check ((select private.is_lideranca()));

drop policy if exists "historico de leads: lideranca" on public.lead_historico;
create policy "historico de leads: lideranca" on public.lead_historico
  for all to authenticated
  using ((select private.is_lideranca())) with check ((select private.is_lideranca()));

-- Conversão: cria o cliente e tira o lead do quadro numa operação só. Se algo falhar, nada muda.
create or replace function public.converter_lead(
  p_lead_id uuid, p_nome text, p_mrr numeric, p_meses integer, p_inicio date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lead public.leads;
  v_cliente uuid;
begin
  if not private.is_lideranca() then
    raise exception 'Só a liderança converte leads.' using errcode = '42501';
  end if;
  if p_nome is null or trim(p_nome) = '' or p_mrr is null or p_mrr < 0
     or p_meses not in (3, 6, 12, 15) or p_inicio is null then
    raise exception 'Dados da conversão incompletos.' using errcode = '22023';
  end if;

  select * into v_lead from public.leads
  where id = p_lead_id and convertido_em is null
  for update;
  if not found then
    raise exception 'Lead não encontrado ou já convertido.' using errcode = 'P0002';
  end if;

  insert into public.clients (nome, status, mrr, data_inicio_contrato, contrato_meses, contato_nome, contato_telefone)
  values (trim(p_nome), 'ativo', p_mrr, p_inicio, p_meses, v_lead.nome, v_lead.telefone)
  returning id into v_cliente;

  update public.leads set convertido_em = now(), client_id = v_cliente where id = p_lead_id;
  insert into public.lead_historico (lead_id, etapa_de, etapa_para, user_id)
  values (p_lead_id, v_lead.etapa, 'cliente', auth.uid());
  return v_cliente;
end $$;

revoke all on function public.converter_lead(uuid, text, numeric, integer, date) from public, anon;
grant execute on function public.converter_lead(uuid, text, numeric, integer, date) to authenticated;

-- O Dashboard da liderança acompanha clientes e leads em tempo real
do $$
declare
  tabela text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach tabela in array array['clients', 'leads'] loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = tabela
      ) then
        execute format('alter publication supabase_realtime add table public.%I', tabela);
      end if;
    end loop;
  end if;
end $$;

commit;
