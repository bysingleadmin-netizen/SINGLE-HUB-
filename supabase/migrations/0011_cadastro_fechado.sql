-- Sistema SINGLE: cadastro só por convite, conferido no servidor
--
-- Rode este arquivo inteiro no SQL Editor do Supabase, depois da 0010. Pode rodar mais de uma
-- vez. Nada é apagado.
--
-- A conta agora é criada pela Edge Function criar-conta, que confere o código com a chave de
-- serviço. As duas funções do convite, criadas pelo painel, ficavam abertas a qualquer visitante:
-- verificar_codigo_convite deixava testar códigos sem limite. O app não as usa mais; ficam no
-- banco, mas só a chave de serviço chama.
--
-- Junto com esta migration, o cadastro público do Supabase fica desligado
-- (Authentication > Sign In / Providers > "Allow new users to sign up").

begin;

do $$
begin
  if to_regprocedure('public.verificar_codigo_convite(text, text)') is not null then
    revoke execute on function public.verificar_codigo_convite(text, text) from public, anon, authenticated;
  end if;
  if to_regprocedure('public.usar_codigo_convite(text, text, uuid)') is not null then
    revoke execute on function public.usar_codigo_convite(text, text, uuid) from public, anon, authenticated;
  end if;
end $$;

commit;
