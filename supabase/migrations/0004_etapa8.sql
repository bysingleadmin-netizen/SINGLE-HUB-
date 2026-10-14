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

commit;
