-- Verificações da 0009. Rodam depois de aplicar a migration duas vezes.
do $$
begin
  -- A demanda que já tinha responsável ganhou a lista com ele
  if (select responsaveis from public.tasks where titulo = 'Com responsável 0009') <> array['00000000-0000-0000-0000-0000000000c1'::uuid] then
    raise exception 'responsável antigo não entrou na lista';
  end if;
  if (select responsaveis from public.tasks where titulo = 'Sem responsável 0009') <> '{}' then
    raise exception 'lista de quem não tinha responsável não ficou vazia';
  end if;

  -- Despesa nasce mensal, com fim; frequência fora da lista é recusada
  insert into public.expenses (descricao, categoria, valor, data, forma_pagamento) values ('Teste 0009', 'Outros', 10, '2026-10-01', 'Pix');
  if (select frequencia || sem_fim::text from public.expenses where descricao = 'Teste 0009') <> 'mensalfalse' then
    raise exception 'padrão da recorrência errado';
  end if;
  begin
    update public.expenses set frequencia = 'diaria' where descricao = 'Teste 0009';
    raise exception 'frequência inválida foi aceita';
  exception when check_violation then null;
  end;

  -- Meta mensal e anual do mesmo mês convivem; duas mensais iguais, não
  insert into public.monthly_goals (mes, meta) values ('2031-01-01', 10000);
  insert into public.monthly_goals (mes, meta, tipo) values ('2031-01-01', 150000, 'anual');
  begin
    insert into public.monthly_goals (mes, meta) values ('2031-01-01', 1);
    raise exception 'meta mensal repetida foi aceita';
  exception when unique_violation then null;
  end;
end $$;
