-- ============================================================================
-- VAMOS — 0005 : verrou de lancement dans demarrer_match()
--
-- On durcit la RPC demarrer_match : en plus de vérifier le code d'accès, elle
-- exige désormais que le tournoi soit RÉELLEMENT lancé (tournois.statut =
-- 'en_cours'). Sinon → exception, même principe que le rejet d'un mauvais code.
--
-- Pourquoi DANS la fonction et pas juste dans l'UI : la garantie doit tenir
-- même si quelqu'un appelle la RPC directement (le bouton caché côté interface
-- ne protège rien). Même raisonnement de sécurité que la vérif du code.
--
-- Ordre : on vérifie le CODE d'abord, puis le statut du tournoi — ainsi un
-- appelant sans code valide reçoit toujours « code invalide » et n'apprend
-- rien de l'état du tournoi.
-- ============================================================================

create or replace function demarrer_match(p_match_id uuid, p_code_acces text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_autorise boolean;
  v_statut_tournoi text;
begin
  -- 1. Le code doit correspondre à l'une des deux équipes de CE match.
  select exists (
    select 1
    from matchs m
    join equipes e on e.id in (m.equipe1_id, m.equipe2_id)
    where m.id = p_match_id
      and e.code_acces = upper(p_code_acces)
  ) into v_autorise;

  if not v_autorise then
    raise exception 'Code d''accès invalide pour ce match';
  end if;

  -- 2. Le tournoi doit être lancé par le manager (statut 'en_cours').
  --    Un tournoi encore en 'setup' (créé à l'avance) refuse tout démarrage,
  --    même avec un code parfaitement valide.
  select t.statut
    into v_statut_tournoi
  from matchs m
  join tournois t on t.id = m.tournoi_id
  where m.id = p_match_id;

  if v_statut_tournoi is distinct from 'en_cours' then
    raise exception 'Le tournoi n''a pas encore démarré';
  end if;

  -- 3. Démarrage borné : uniquement si le match n'a pas déjà démarré/terminé.
  update matchs
    set statut = 'en_cours', heure_debut = now()
    where id = p_match_id
      and statut in ('en_attente', 'equipes_presentes');
end;
$$;

-- Grant conservé après create or replace, réappliqué par sécurité (idempotent).
grant execute on function demarrer_match(uuid, text) to anon;
