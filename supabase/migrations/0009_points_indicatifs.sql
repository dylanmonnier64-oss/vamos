-- ============================================================================
-- VAMOS — 0009 : toggle d'affichage des points indicatifs (espace joueur /t)
--
-- L'espace joueur affiche une fourchette de points FFT « pour information »
-- (« Tu joues pour entre X et Y points — indicatif, non transmis à la FFT »).
-- Certains clubs ne veulent pas exposer cette info. Ce flag permet à
-- l'organisateur de masquer entièrement le bloc, partout (/t et fin de tournoi).
-- Défaut true : comportement inchangé pour les tournois existants.
-- ============================================================================

alter table tournois
  add column afficher_points_indicatifs boolean not null default true;

comment on column tournois.afficher_points_indicatifs is
  'Si false, l''espace joueur /t/[code] masque ENTIEREMENT le bloc « points indicatifs » (fourchette FFT + place finale chiffree). Defaut true. Purement cosmetique cote joueur — n''affecte ni le calcul des places (bracket.ts) ni les points reels stockes (equipes.points_fft).';
