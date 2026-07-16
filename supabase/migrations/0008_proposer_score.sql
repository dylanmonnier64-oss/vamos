-- ============================================================================
-- VAMOS — 0008 : saisie de score joueur + persistance de la progression
--
-- Trois RPC SECURITY DEFINER, dans le prolongement de demarrer_match (un joueur
-- anon ne peut pas écrire dans matchs/equipes/tournois — RLS lecture seule).
--
--   proposer_score      : un joueur propose un score ; confirmation à deux ;
--                         NE FAIT PAS avancer le bracket (voir contrat plus bas).
--   progresser_bracket  : persiste les diffs de progression CALCULÉS EN TS
--                         (onScoreSaisi) — dumb writer, aucune logique bracket.
--   maj_eta             : écrit UNIQUEMENT heure_convocation_estimee.
--
-- CONTRAT DE SÉPARATION (à ne jamais violer) : toute la logique de progression
-- (qui avance dans le tableau, qui est placé, byes/vagues) vit dans
-- lib/bracket.ts (TypeScript), source de vérité UNIQUE. Ces RPC ne calculent
-- rien : proposer_score se contente d'enregistrer l'état d'un score, et
-- progresser_bracket applique un diff déjà calculé. Si un jour quelqu'un ajoute
-- la progression du bracket ICI, en SQL, il y aura DEUX sources de vérité qui
-- divergeront → interdit.
-- ============================================================================

-- Deux propositions divergentes doivent pouvoir coexister (le manager tranche).
-- Les 3 colonnes score_propose_* de 0001 n'en stockent qu'une → on ajoute une
-- map { equipe_id: {e1, e2} } qui garde les DEUX propositions.
alter table matchs
  add column propositions_score jsonb not null default '{}'::jsonb;

comment on column matchs.propositions_score is
  'Propositions de score en cours, par equipe : { equipe_id: {"e1": jeux_equipe1, "e2": jeux_equipe2} }. Ecrit par proposer_score. statut_score en derive : 1 entree = propose, 2 entrees egales = confirme, 2 differentes = conteste. Permet au manager d''afficher et de departager les deux propositions d''un conteste. Vide ({}) une fois le match arbitre/termine cote applicatif si besoin.';

-- ── proposer_score ──────────────────────────────────────────────────────────
create or replace function proposer_score(
  p_match_id uuid,
  p_code_acces text,
  p_score_equipe1 text,
  p_score_equipe2 text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match matchs%rowtype;
  v_proposant uuid;
  v_statut_tournoi text;
  v_props jsonb;
  v_ma jsonb;
  v_autre_id text;
  v_autre jsonb;
  v_statut_score text;
  v_s1 text;
  v_s2 text;
begin
  -- Normalisation légère : on compare des chaînes, on collapse les espaces.
  v_s1 := trim(regexp_replace(coalesce(p_score_equipe1, ''), '\s+', ' ', 'g'));
  v_s2 := trim(regexp_replace(coalesce(p_score_equipe2, ''), '\s+', ' ', 'g'));

  select m.* into v_match from matchs m where m.id = p_match_id;
  if not found then
    raise exception 'Match introuvable';
  end if;

  -- 1. Le code doit appartenir à l'une des DEUX équipes de CE match précis
  --    (un code valide pour un AUTRE match est rejeté).
  select e.id into v_proposant
  from equipes e
  where e.id in (v_match.equipe1_id, v_match.equipe2_id)
    and e.code_acces = upper(p_code_acces);
  if v_proposant is null then
    raise exception 'Code d''accès invalide pour ce match';
  end if;

  -- 2. Tournoi en cours.
  select t.statut into v_statut_tournoi from tournois t where t.id = v_match.tournoi_id;
  if v_statut_tournoi is distinct from 'en_cours' then
    raise exception 'Le tournoi n''a pas encore démarré';
  end if;

  -- 3. Match en cours.
  if v_match.statut is distinct from 'en_cours' then
    raise exception 'Le match n''est pas en cours';
  end if;

  -- 4. Pas un bye (un bye ne se joue pas).
  if v_match.est_bye then
    raise exception 'Un bye ne peut pas recevoir de score';
  end if;

  -- Upsert la proposition de l'équipe qui propose (elle peut se corriger).
  v_ma := jsonb_build_object('e1', v_s1, 'e2', v_s2);
  v_props := coalesce(v_match.propositions_score, '{}'::jsonb)
             || jsonb_build_object(v_proposant::text, v_ma);

  v_autre_id := case
                  when v_proposant = v_match.equipe1_id then v_match.equipe2_id::text
                  else v_match.equipe1_id::text
                end;
  v_autre := v_props -> v_autre_id;

  if v_autre is null then
    v_statut_score := 'propose';               -- une seule proposition
  elsif v_autre = v_ma then
    v_statut_score := 'confirme';              -- les deux équipes, même score
  else
    v_statut_score := 'conteste';              -- les deux équipes, scores différents
  end if;

  if v_statut_score = 'confirme' then
    -- Score entériné : on fige le score et on termine le match. On NE pose PAS
    -- gagnant_id ici (déterminé par parseScoreSets en TS) et on NE fait PAS
    -- avancer le bracket : c'est l'appelant applicatif qui, en voyant confirme,
    -- appelle onScoreSaisi puis progresser_bracket.
    update matchs set
      propositions_score = v_props,
      score_propose_equipe1 = v_s1,
      score_propose_equipe2 = v_s2,
      score_propose_par = v_proposant,
      statut_score = 'confirme',
      score_equipe1 = v_s1,
      score_equipe2 = v_s2,
      statut = 'termine',
      heure_fin = now()
    where id = p_match_id;
  else
    update matchs set
      propositions_score = v_props,
      score_propose_equipe1 = v_s1,
      score_propose_equipe2 = v_s2,
      score_propose_par = v_proposant,
      statut_score = v_statut_score
    where id = p_match_id;
  end if;

  return jsonb_build_object(
    'statut_score', v_statut_score,
    'confirme', v_statut_score = 'confirme',
    'match_id', p_match_id
  );
end;
$$;

grant execute on function proposer_score(uuid, text, text, text) to anon;

-- ── progresser_bracket ──────────────────────────────────────────────────────
-- Persiste un diff de progression calculé par onScoreSaisi (TS). Gardé :
--   • code d'accès valide pour CE match ;
--   • score de ce match confirmé (proposer_score l'a entériné : termine + confirme) ;
--   • toutes les écritures scopées au tournoi de ce match.
-- Modèle « confiance + préconditions » : la RPC fait confiance au diff TS, mais
-- ne peut être déclenchée que par une équipe du match sur un score confirmé, et
-- ne peut toucher que le tournoi concerné (pas de portée cross-tenant).
create or replace function progresser_bracket(
  p_match_id uuid,
  p_code_acces text,
  p_maj jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match matchs%rowtype;
  v_ok boolean;
  v_tournoi_id uuid;
  r jsonb;
begin
  select m.* into v_match from matchs m where m.id = p_match_id;
  if not found then
    raise exception 'Match introuvable';
  end if;

  select exists (
    select 1 from equipes e
    where e.id in (v_match.equipe1_id, v_match.equipe2_id)
      and e.code_acces = upper(p_code_acces)
  ) into v_ok;
  if not v_ok then
    raise exception 'Code d''accès invalide pour ce match';
  end if;

  if v_match.statut_score is distinct from 'confirme' or v_match.statut is distinct from 'termine' then
    raise exception 'Le score de ce match n''est pas confirmé';
  end if;

  v_tournoi_id := v_match.tournoi_id;

  -- Matchs : remplissage de slots / gagnant / statut / scores (jamais le terrain).
  for r in select value from jsonb_array_elements(coalesce(p_maj->'matchs', '[]'::jsonb)) as t(value)
  loop
    update matchs set
      equipe1_id = coalesce((r->>'equipe1_id')::uuid, equipe1_id),
      equipe2_id = coalesce((r->>'equipe2_id')::uuid, equipe2_id),
      gagnant_id = coalesce((r->>'gagnant_id')::uuid, gagnant_id),
      statut = coalesce(r->>'statut', statut),
      est_bye = coalesce((r->>'est_bye')::boolean, est_bye),
      score_equipe1 = coalesce(r->>'score_equipe1', score_equipe1),
      score_equipe2 = coalesce(r->>'score_equipe2', score_equipe2),
      heure_fin = coalesce((r->>'heure_fin')::timestamptz, heure_fin)
    where id = (r->>'id')::uuid and tournoi_id = v_tournoi_id;
  end loop;

  -- Placements finaux.
  for r in select value from jsonb_array_elements(coalesce(p_maj->'equipes', '[]'::jsonb)) as t(value)
  loop
    update equipes set
      place_finale = (r->>'place_finale')::int,
      points_fft = case when r ? 'points_fft' and r->>'points_fft' is not null
                        then (r->>'points_fft')::int else points_fft end
    where id = (r->>'id')::uuid and tournoi_id = v_tournoi_id;
  end loop;

  -- Fin de tournoi.
  if coalesce((p_maj->>'tournoi_termine')::boolean, false) then
    update tournois set statut = 'termine' where id = v_tournoi_id and statut = 'en_cours';
  end if;

  -- NB : l'ETA n'est PAS écrite ici. Un seul chemin ETA (recalculerETA → maj_eta),
  -- appelé juste après cette RPC, qui relit l'état réel persisté.
end;
$$;

grant execute on function progresser_bracket(uuid, text, jsonb) to anon;

-- ── maj_eta ─────────────────────────────────────────────────────────────────
-- Écrit UNIQUEMENT heure_convocation_estimee, scopé au tournoi. Utilisable par
-- l'anon (après un démarrage joueur) comme par le manager — recalculerETA passe
-- toujours par ici, un seul chemin d'écriture pour l'ETA.
create or replace function maj_eta(p_tournoi_id uuid, p_etas jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r jsonb;
begin
  for r in select value from jsonb_array_elements(coalesce(p_etas, '[]'::jsonb)) as t(value)
  loop
    update matchs set heure_convocation_estimee = (r->>'eta')::timestamptz
    where id = (r->>'id')::uuid and tournoi_id = p_tournoi_id;
  end loop;
end;
$$;

grant execute on function maj_eta(uuid, jsonb) to anon;
