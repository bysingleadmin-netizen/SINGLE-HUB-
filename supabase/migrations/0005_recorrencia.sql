-- Sistema SINGLE: despesas recorrentes
--
-- Rode este arquivo inteiro no SQL Editor do Supabase, depois da 0004. Pode rodar mais de uma
-- vez. O app funciona sem ele: a despesa recorrente é lançada mês a mês do mesmo jeito, só não
-- fica marcada como parte de um grupo.

begin;

-- Uma despesa recorrente vira uma linha por mês; as linhas do mesmo lançamento dividem o
-- mesmo grupo_recorrencia, para o grupo poder ser editado ou excluído junto no futuro.
alter table public.expenses add column if not exists recorrente boolean not null default false;
alter table public.expenses add column if not exists grupo_recorrencia uuid;
create index if not exists expenses_grupo_recorrencia_idx
  on public.expenses (grupo_recorrencia) where grupo_recorrencia is not null;

commit;
