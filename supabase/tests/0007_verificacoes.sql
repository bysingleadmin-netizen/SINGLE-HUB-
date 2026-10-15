-- Verificações da 0007. Rodam depois de aplicar a migration duas vezes.
do $$
begin
  insert into public.clients (nome, cnpj) values ('Com CNPJ', '12.345.678/0001-90');
  if (select cnpj from public.clients where nome = 'Com CNPJ') <> '12.345.678/0001-90' then
    raise exception 'cnpj não foi guardado como digitado';
  end if;

  insert into public.receitas_asaas (asaas_id, tipo, nome_cliente_asaas) values ('pay_7', 'PIX', 'Com CNPJ');

  if not exists (select 1 from pg_indexes where indexname = 'receitas_asaas_status_idx') then
    raise exception 'índice de status ausente';
  end if;
end $$;
