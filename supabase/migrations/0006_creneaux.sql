-- ============================================================================
-- VAMOS — 0006 : créneaux de planification (format ÉLIMINATION uniquement)
--
-- Nouveau modèle : tout le tableau (winners + consolante) est généré d'un coup,
-- chaque match ayant son terrain + créneau + moitié calculés d'avance, pour
-- pouvoir afficher « Terrain 1 : Vainqueur T1 vs Vainqueur T2 » AVANT que les
-- vainqueurs soient connus. Deux colonnes dédiées, NULL pour les autres formats.
-- ============================================================================

alter table matchs add column creneau int;
alter table matchs add column moitie text check (moitie in ('gauche', 'droite'));

comment on column matchs.creneau is
  'Slot temporel de planification (format elimination uniquement — NULL pour americano/team americano). DISTINCT de `tour` (qui a 3 sens : tour winners / vague*100+sous-tour consolante / round round-robin team americano — cf. son propre COMMENT). Formule : heure_convocation = heure_debut + (creneau-1) * duree_match_minutes. C''est une ESTIMATION d''affichage et de convocation, PAS une barriere : un match peut demarrer des que son terrain est libre et ses deux equipes connues.';

comment on column matchs.moitie is
  'Moitie du tableau a elimination (NULL pour la finale, et pour les formats non-elimination) : gauche (haut du tableau) / droite (bas). Sert a l''alternance des convocations (gauche sur creneaux impairs, droite sur pairs, hors cas de debordement d''une phase sur plusieurs creneaux).';
