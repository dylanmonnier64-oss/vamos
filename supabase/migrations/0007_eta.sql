-- ============================================================================
-- VAMOS — 0007 : ETA live + verrou « terrain libre » au démarrage
--
-- Le plan (terrain, creneau, moitie) est IMMUABLE. Seule l'ETA bouge. On ajoute
-- la colonne d'ETA recalculée en continu, on documente qui écrit chaque colonne
-- de planification/temps (pour que la lecture du schéma seul suffise), et on
-- durcit demarrer_match : un match ne peut partir que si son terrain est libre.
-- ============================================================================

alter table matchs add column heure_convocation_estimee timestamptz;

-- ── Documentation des colonnes de planification / temps ─────────────────────
comment on column matchs.terrain is
  'Terrain assigne. ECRIT UNIQUEMENT par l''ordonnanceur de initialiserTournoi (lib/bracket.ts) a la creation du tournoi (format elimination). IMMUABLE ensuite : jamais reassigne en cours de tournoi. C''est ce qui rend valides les libelles « Vainqueur T1 vs Vainqueur T2 » affiches avant que les vainqueurs soient connus.';

comment on column matchs.creneau is
  'Ordre de planification (format elimination — NULL sinon). ECRIT par l''ordonnanceur a la creation, IMMUABLE. DISTINCT de `tour` (3 sens : tour winners / vague*100+sous-tour consolante / round round-robin). N''est PAS une barriere : un match demarre des que son terrain est libre et ses 2 equipes connues, meme si un creneau anterieur sur ce terrain n''est pas pret.';

comment on column matchs.moitie is
  'Moitie du tableau (gauche/droite). A UN SENS UNIQUEMENT pour les matchs tableau=''winners'' HORS finale : c''est le decoupage de l''arbre principal qui permet l''alternance des convocations (gauche joue, droite joue, gauche joue...). TOUJOURS NULL pour : la finale winners (elle reunit les deux moities, aucune ne lui appartient), toute la consolante (empilement de mini-poules independantes, pas de structure gauche/droite), et les formats non-elimination. On ne lui donne PAS un second sens selon le contexte (ne pas reproduire le probleme de `tour`).';

comment on column matchs.heure_convocation is
  'Heure de convocation INITIALE, figee a la creation : heure_debut + (creneau-1) * duree_match_minutes. Reference, ne bouge jamais. Pour l''heure reelle affichee au joueur, voir heure_convocation_estimee.';

comment on column matchs.heure_convocation_estimee is
  'ETA de demarrage RECALCULEE EN LIVE (lib/eta.ts recalculerETA), a partir de l''avancement reel : appelee apres chaque score valide et apres chaque demarrage effectif. SEULE colonne temporelle qui bouge. N''ecrit jamais terrain/creneau/moitie.';

-- ── demarrer_match : + verrou « aucun match en_cours sur ce terrain » ───────
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
begin
  -- 1. Code valide pour ce match ?
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

  -- 2. Tournoi lancé + on récupère terrain/tournoi de CE match.
  select t.statut, m.tournoi_id, m.terrain
    into v_statut_tournoi, v_tournoi_id, v_terrain
  from matchs m
  join tournois t on t.id = m.tournoi_id
  where m.id = p_match_id;

  if v_statut_tournoi is distinct from 'en_cours' then
    raise exception 'Le tournoi n''a pas encore démarré';
  end if;

  -- 3. Le terrain de ce match doit être libre (aucun autre match en_cours dessus).
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

  -- 4. Démarrage borné.
  update matchs
    set statut = 'en_cours', heure_debut = now()
    where id = p_match_id
      and statut in ('en_attente', 'equipes_presentes');
end;
$$;

grant execute on function demarrer_match(uuid, text) to anon;
