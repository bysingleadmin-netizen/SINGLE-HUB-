-- Verificações da 0005. Rodam depois de aplicar a migration duas vezes.
do $$
declare
  grupo uuid := gen_random_uuid();
begin
  -- Despesa de antes da 0005 continua valendo, como não recorrente
  if exists (select 1 from public.expenses where descricao = 'Despesa antiga' and recorrente) then
    raise exception 'despesa antiga virou recorrente';
  end if;

  insert into public.expenses (descricao, categoria, valor, data, forma_pagamento, recorrente, grupo_recorrencia)
  values ('Assinatura', 'Ferramentas', 200, '2026-10-14', 'Pix', true, grupo),
         ('Assinatura', 'Ferramentas', 200, '2026-11-14', 'Pix', true, grupo);
  if (select count(*) from public.expenses where grupo_recorrencia = grupo) <> 2 then
    raise exception 'grupo de recorrência não foi gravado';
  end if;
end $$;
