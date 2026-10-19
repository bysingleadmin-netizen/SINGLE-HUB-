-- Verificações da 0014. Rodam depois de aplicar a migration duas vezes, dentro de uma
-- transação que termina em rollback.
do $$
declare
  card uuid;
  cliente uuid;
  valido public.aprovacoes;
  vencido public.aprovacoes;
  resposta jsonb;
begin
  select id into card from public.content_cards limit 1;
  select id into cliente from public.clients limit 1;

  insert into public.aprovacoes (card_id, client_id, titulo, conteudo)
  values (card, cliente, 'Válido 0014', '[{"tipo": "copy", "valor": "Texto"}]')
  returning * into valido;
  insert into public.aprovacoes (card_id, client_id, titulo, conteudo, link_expira_em)
  values (card, cliente, 'Vencido 0014', '[{"tipo": "copy", "valor": "Texto"}]', now() - interval '1 minute')
  returning * into vencido;

  -- Link novo vale cerca de 24 horas
  if valido.link_expira_em not between now() + interval '23 hours' and now() + interval '25 hours' then
    raise exception 'link não nasceu com 24 horas';
  end if;

  -- Válido: vem o material e o nome do cliente, sem ids
  resposta := public.aprovacao_por_token(valido.token);
  if (resposta ->> 'expirado')::boolean or jsonb_array_length(resposta -> 'conteudo') <> 1
     or resposta ->> 'cliente' is distinct from (select nome from public.clients where id = cliente)
     or resposta ? 'card_id' or resposta ? 'client_id' or resposta ? 'id' then
    raise exception 'pedido válido veio errado: %', resposta;
  end if;

  -- Vencido: diz que expirou, sem o material, e não aceita resposta
  resposta := public.aprovacao_por_token(vencido.token);
  if not (resposta ->> 'expirado')::boolean or jsonb_array_length(resposta -> 'conteudo') <> 0 then
    raise exception 'pedido vencido veio errado: %', resposta;
  end if;
  if public.responder_aprovacao(vencido.token, 'aprovado', null) <> 'expirado' then
    raise exception 'link vencido aceitou resposta';
  end if;

  -- Token desconhecido continua null
  if public.aprovacao_por_token(gen_random_uuid()) is not null
     or public.responder_aprovacao(gen_random_uuid(), 'aprovado', null) <> 'invalido' then
    raise exception 'token desconhecido foi aceito';
  end if;

  -- Respondido: diz que respondeu e não manda mais o material
  if public.responder_aprovacao(valido.token, 'aprovado', null) <> 'ok' then
    raise exception 'resposta válida recusada';
  end if;
  resposta := public.aprovacao_por_token(valido.token);
  if not (resposta ->> 'respondido')::boolean or resposta ->> 'status' <> 'aprovado'
     or jsonb_array_length(resposta -> 'conteudo') <> 0 then
    raise exception 'pedido respondido veio errado: %', resposta;
  end if;
  if public.responder_aprovacao(valido.token, 'reprovado', null) <> 'ja_respondido' then
    raise exception 'respondeu duas vezes';
  end if;
end $$;

-- Visitante continua sem ler a tabela
set local role anon;
do $$
begin
  if (select count(*) from public.aprovacoes) > 0 then
    raise exception 'visitante lê a tabela de aprovações';
  end if;
end $$;
reset role;
