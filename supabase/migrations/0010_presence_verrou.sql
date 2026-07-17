-- ============================================================================
-- VAMOS — 0010 : la présence des deux équipes VERROUILLE le démarrage
--
-- Durcissement métier : lancer un match dont une équipe est absente démarre un
-- chrono dans le vide et fausse toutes les ETA en aval. On exige donc que les
-- DEUX équipes soient marquées présentes (equipe1_presente / equipe2_presente,
-- coché par le manager sur /live) avant tout passage en_cours.
--
-- Deux notions restent SÉPARÉES (cf. lib/demarrage.ts) : « démarrable » (le
-- terrain peut être occupé maintenant) vs « lançable » (démarrable + présences).
-- Ce verrou est le pendant SQL de filtrerLancables : il ne doit pas reposer sur
-- l'interface — un joueur qui déclenche demarrer_match depuis /tableau ou /t ne
-- doit pas pouvoir contourner la présence.
--
-- Ordre des vérifications inchangé (code → tournoi → terrain), on insère la
-- présence juste avant l'écriture. Un bye n'est jamais concerné : il est terminé
-- d'office, jamais 'en_attente', donc le filtre de statut de l'UPDATE l'exclut.
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
  v_tournoi_id uuid;
  v_terrain int;
  v_terrain_occupe boolean;
  v_e1_presente boolean;
  v_e2_presente boolean;
begin
  -- 1. Code valide pour l'une des deux équipes de CE match ?
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

  -- 2. Tournoi lancé + terrain / présences de CE match.
  select t.statut, m.tournoi_id, m.terrain, m.equipe1_presente, m.equipe2_presente
    into v_statut_tournoi, v_tournoi_id, v_terrain, v_e1_presente, v_e2_presente
  from matchs m
  join tournois t on t.id = m.tournoi_id
  where m.id = p_match_id;

  if v_statut_tournoi is distinct from 'en_cours' then
    raise exception 'Le tournoi n''a pas encore démarré';
  end if;

  -- 3. Terrain libre (aucun autre match en_cours dessus).
  select exists (
    select 1 from matchs m2
    where m2.tournoi_id = v_tournoi_id
      and m2.terrain = v_terrain
      and m2.statut = 'en_cours'
      and m2.id <> p_match_id
  ) into v_terrain_occupe;
  if v_terrain_occupe then
    raise exception 'Un match est déjà en cours sur ce terrain';
  end if;

  -- 4. VERROU présence : les deux équipes doivent être là.
  if v_e1_presente is not true or v_e2_presente is not true then
    raise exception 'Les deux équipes doivent être marquées présentes pour lancer le match';
  end if;

  -- 5. Démarrage borné.
  update matchs
    set statut = 'en_cours', heure_debut = now()
    where id = p_match_id
      and statut in ('en_attente', 'equipes_presentes');
end;
$$;

grant execute on function demarrer_match(uuid, text) to anon;
