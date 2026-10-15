-- Sistema SINGLE: vários responsáveis por card, recorrência das despesas e meta anual
--
-- Rode este arquivo inteiro no SQL Editor do Supabase, depois da 0008. Pode rodar mais de uma
-- vez. Nada é apagado.

begin;

-- 1. Vários responsáveis em Demandas e Conteúdo. responsavel_id continua sendo o primeiro da
-- lista (avisos, carga da equipe e filtros leem dele); a lista guarda todos.
alter table public.tasks add column if not exists responsaveis uuid[] not null default '{}';
alter table public.content_cards add column if not exists responsaveis uuid[] not null default '{}';
update public.tasks set responsaveis = array[responsavel_id]
where responsavel_id is not null and responsaveis = '{}';
update public.content_cards set responsaveis = array[responsavel_id]
where responsavel_id is not null and responsaveis = '{}';
create index if not exists tasks_responsaveis_idx on public.tasks using gin (responsaveis);
create index if not exists content_cards_responsaveis_idx on public.content_cards using gin (responsaveis);

-- 2. Recorrência das despesas: de quanto em quanto tempo e se tem fim. Sem fim, o app mantém
-- os lançamentos criados até um ano à frente.
alter table public.expenses add column if not exists frequencia text not null default 'mensal';
alter table public.expenses drop constraint if exists expenses_frequencia_check;
alter table public.expenses add constraint expenses_frequencia_check
  check (frequencia in ('semanal', 'quinzenal', 'mensal', 'trimestral', 'anual'));
alter table public.expenses add column if not exists sem_fim boolean not null default false;

-- 3. Meta anual ao lado da mensal. A anual fica no primeiro dia do ano.
alter table public.monthly_goals add column if not exists tipo text not null default 'mensal';
alter table public.monthly_goals drop constraint if exists monthly_goals_tipo_check;
alter table public.monthly_goals add constraint monthly_goals_tipo_check check (tipo in ('mensal', 'anual'));
alter table public.monthly_goals drop constraint if exists monthly_goals_mes_key;
drop index if exists public.monthly_goals_mes_tipo_key;
create unique index monthly_goals_mes_tipo_key on public.monthly_goals (mes, tipo);

commit;
