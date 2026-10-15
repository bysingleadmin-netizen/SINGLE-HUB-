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

commit;
