-- ============================================================================
-- VAMOS — 0004 : team americano (paires fixes, round-robin)
--
-- Format à paires fixes (comme l'élimination) mais joué en round-robin (chaque
-- paire affronte les autres), classement cumulé PAR PAIRE. On RÉUTILISE
-- `equipes` (paire fixe, discriminée par `tournois.format`) et la table
-- `matchs` (paire vs paire, structurellement identique à l'élimination) — pas
-- de table de matchs dédiée : ça garde `demarrer_match` et l'écran /tableau
-- génériques élimination + team americano.
--
-- Accommodations sur `matchs` : `tableau` devient nullable (pas de winners/
-- consolante ici), et 2 colonnes int dédiées aux scores en points (cohérent
-- avec matchs_americano qui stocke déjà ses scores en int, pas comme les
-- colonnes texte `score_equipe1/2` prévues pour les scores de sets en élim.).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. tournois.format : ajouter 'team_americano' (les 3 autres inchangées).
--    Les colonnes 0003 sont réutilisées : points_par_match (P), nb_rounds
--    (rounds de round-robin), nb_equipes (nb de paires). nb_participants reste
--    NULL pour ce format.
-- ----------------------------------------------------------------------------

alter table tournois drop constraint if exists tournois_format_check;
alter table tournois add constraint tournois_format_check
  check (format in ('elimination', 'americano', 'mexicano', 'team_americano'));

-- ----------------------------------------------------------------------------
-- 2. matchs : réutilisation pour le team americano.
-- ----------------------------------------------------------------------------

-- `tableau` n'a pas de sens hors élimination → nullable (NULL pour un match
-- team americano). Le CHECK existant (winners/consolante) accepte NULL.
alter table matchs alter column tableau drop not null;

-- Scores en points (int) pour le team americano. NULL pour l'élimination, qui
-- continue d'utiliser les colonnes texte score_equipe1/score_equipe2 (sets).
alter table matchs add column score_equipe1_points int;
alter table matchs add column score_equipe2_points int;

-- ⚠️ IMPORTANT : la colonne `tour` a désormais TROIS significations selon le
-- contexte. Ne JAMAIS lire `tour` sans avoir d'abord discriminé via
-- `tableau` (NULL vs winners/consolante) et/ou `tournois.format` :
--   • élimination winners   (tableau='winners')    → numéro de tour : 1,2,3…
--   • élimination consolante (tableau='consolante') → vague*100 + sous-tour
--   • team americano        (tableau IS NULL,
--                             tournoi.format='team_americano') → numéro de
--                             round de round-robin (1,2,3…)
comment on column matchs.tour is
  'Signification dépendante du contexte — NE PAS lire sans discriminer tableau/format : élimination winners = numéro de tour ; élimination consolante = vague*100 + sous-tour (cf. lib/bracket.ts) ; team americano (tableau IS NULL) = numéro de round de round-robin.';

comment on column matchs.score_equipe1_points is
  'Score en points de equipe1 pour les formats à points cible (team americano). NULL en élimination (qui utilise score_equipe1 en texte pour les sets).';
comment on column matchs.score_equipe2_points is
  'Score en points de equipe2 pour les formats à points cible (team americano). NULL en élimination.';

-- ----------------------------------------------------------------------------
-- 3. RPC `demarrer_match` — démarrage d'un match par un JOUEUR du terrain.
--
--    Le manager écrit déjà via la policy "matchs: manager update". Les joueurs
--    n'ont aucun accès en écriture ; on ne l'ouvre pas largement (dangereux).
--    Même principe que get_equipe_by_code : une fonction SECURITY DEFINER
--    bornée, qui vérifie que le code fourni appartient bien à l'une des DEUX
--    équipes de CE match avant de le passer en cours. Générique : marche pour
--    l'élimination ET le team americano (matchs paire-vs-paire dans `matchs`).
-- ----------------------------------------------------------------------------

create or replace function demarrer_match(p_match_id uuid, p_code_acces text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_autorise boolean;
begin
  -- Le code doit correspondre à l'une des deux équipes engagées dans CE match.
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

  -- Démarrage borné : uniquement si le match n'a pas déjà démarré/terminé.
  update matchs
    set statut = 'en_cours', heure_debut = now()
    where id = p_match_id
      and statut in ('en_attente', 'equipes_presentes');
end;
$$;

-- Exécutable par le rôle anon : les joueurs (espace /t/[code], écran public)
-- n'ont pas de session. La sécurité vient du contrôle du code dans la fonction,
-- pas d'un accès en écriture sur la table.
grant execute on function demarrer_match(uuid, text) to anon;
