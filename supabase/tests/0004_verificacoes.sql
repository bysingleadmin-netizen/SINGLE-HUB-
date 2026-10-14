-- Verificações da migration 0004, rodadas pelo validador local depois de aplicá-la duas vezes.
-- Cada bloco lança exceção se o banco não estiver como a migration promete.

-- 1. Contrato
do $$
begin
  insert into public.clients (nome, contrato_meses) values ('Contrato ok', 12);
  begin
    insert into public.clients (nome, contrato_meses) values ('Contrato inválido', 7);
    raise exception 'contrato_meses aceitou 7';
  exception when check_violation then null;
  end;
end $$;
