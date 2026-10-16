-- Verificações da 0011: visitante e usuário logado não chamam mais as funções do convite.
do $$
begin
  if has_function_privilege('anon', 'public.verificar_codigo_convite(text, text)', 'execute')
     or has_function_privilege('authenticated', 'public.verificar_codigo_convite(text, text)', 'execute')
     or has_function_privilege('anon', 'public.usar_codigo_convite(text, text, uuid)', 'execute')
     or has_function_privilege('authenticated', 'public.usar_codigo_convite(text, text, uuid)', 'execute') then
    raise exception 'função do convite ainda aberta';
  end if;
end $$;
