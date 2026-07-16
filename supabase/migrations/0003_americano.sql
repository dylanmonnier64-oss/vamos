-- ============================================================================
-- VAMOS — 0003 : format americano / mexicano
--
-- Nouveau format de tournoi à inscription INDIVIDUELLE (les paires se reforment
-- à chaque round), distinct du format élimination (paires fixes via `equipes` +
-- `matchs`, moteur `lib/bracket.ts`). On n'étend pas `equipes`/`matchs` : deux
-- tables dédiées `participants` et `matchs_americano`, pour ne pas mélanger deux
-- formats aux contraintes opposées.
--
-- Sécurité : même modèle que `equipes` (0001) — table brute réservée au manager
-- de l'organisation, accès public UNIQUEMENT via une vue sans code + une
-- fonction RPC SECURITY DEFINER (pas d'énumération). On réutilise
-- `auth_organisation_id()` (renommée en 0002), on ne recrée pas d'équivalent.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. tournois : colonnes de format
--    `format` discrimine les deux moteurs. `categorie_fft` et `nb_equipes` (sans
--    objet pour americano/mexicano) passent nullable — les tournois
--    `format = 'elimination'` existants ne sont pas touchés (leurs valeurs
--    restent, les CHECK acceptent NULL par sémantique SQL).
-- ----------------------------------------------------------------------------

alter table tournois
  add column format text not null default 'elimination'
    check (format in ('elimination', 'americano', 'mexicano')),
  add column points_par_match int check (points_par_match in (16, 20, 24, 32)),
  add column nb_rounds int check (nb_rounds >= 1),
  add column nb_participants int check (nb_participants >= 4);

alter table tournois alter column categorie_fft drop not null;
alter table tournois alter column nb_equipes drop not null;

-- ----------------------------------------------------------------------------
-- 2. participants : un joueur individuel inscrit à un tournoi americano/mexicano
--    `code_acces` unique (6 car.) = son lien /t/[code] personnel (pas la paire).
--    `niveau` (optionnel) sert au seeding du round 1 mexicano par niveau.
--    `statut` : 'actif' (dans la rotation) / 'abandon' (sorti, points figés).
-- ----------------------------------------------------------------------------

create table participants (
  id uuid primary key default gen_random_uuid(),
  tournoi_id uuid not null references tournois (id) on delete cascade,
  nom text not null,
  code_acces text not null unique,
  niveau int,
  statut text not null default 'actif' check (statut in ('actif', 'abandon')),
  created_at timestamptz not null default now()
);

create index participants_tournoi_id_idx on participants (tournoi_id);
create index participants_code_acces_idx on participants (code_acces);

-- ----------------------------------------------------------------------------
-- 3. matchs_americano : un match = toujours exactement 4 participants (2 v 2),
--    donc les 4 FK sont NOT NULL. Les byes ne sont PAS stockés ici : ils se
--    déduisent (participants actifs absents des matchs du round). Horaires sur
--    le même modèle que `matchs`. Scores en int (points cible, pas de sets).
-- ----------------------------------------------------------------------------

create table matchs_americano (
  id uuid primary key default gen_random_uuid(),
  tournoi_id uuid not null references tournois (id) on delete cascade,
  round int not null,
  terrain int,
  equipe_a_j1 uuid not null references participants (id),
  equipe_a_j2 uuid not null references participants (id),
  equipe_b_j1 uuid not null references participants (id),
  equipe_b_j2 uuid not null references participants (id),
  score_a int,
  score_b int,
  statut text not null default 'en_attente' check (
    statut in ('en_attente', 'equipes_presentes', 'en_cours', 'termine')
  ),
  heure_convocation timestamptz,
  heure_debut timestamptz,
  heure_fin timestamptz,
  created_at timestamptz not null default now()
);

create index matchs_americano_tournoi_id_idx on matchs_americano (tournoi_id);
create index matchs_americano_tournoi_round_idx on matchs_americano (tournoi_id, round);

-- ----------------------------------------------------------------------------
-- 4. Vue publique participants (sans code_acces) + RPC de résolution du code
--    Même principe que equipes_public / get_equipe_by_code (0001).
-- ----------------------------------------------------------------------------

create view participants_public as
  select id, tournoi_id, nom, niveau, statut, created_at
  from participants;

create or replace function get_participant_by_code(p_code text)
returns table (
  id uuid,
  tournoi_id uuid,
  nom text,
  niveau int,
  statut text
)
language sql
security definer
set search_path = public
as $$
  select id, tournoi_id, nom, niveau, statut
  from participants
  where code_acces = upper(p_code)
  limit 1;
$$;

-- ----------------------------------------------------------------------------
-- 5. RLS — même modèle que equipes / matchs (0001), via auth_organisation_id()
-- ----------------------------------------------------------------------------

alter table participants enable row level security;
alter table matchs_americano enable row level security;

-- participants : table brute réservée au manager de l'organisation (le public
-- passe par participants_public / get_participant_by_code, jamais par la table).
create policy "participants: manager select" on participants
  for select using (
    tournoi_id in (select id from tournois where organisation_id = auth_organisation_id())
  );
create policy "participants: manager insert" on participants
  for insert with check (
    tournoi_id in (select id from tournois where organisation_id = auth_organisation_id())
  );
create policy "participants: manager update" on participants
  for update using (
    tournoi_id in (select id from tournois where organisation_id = auth_organisation_id())
  );

-- matchs_americano : lecture publique (/tableau/[id] + /t/[code]), écriture manager.
create policy "matchs_americano: public select" on matchs_americano
  for select using (true);
create policy "matchs_americano: manager insert" on matchs_americano
  for insert with check (
    tournoi_id in (select id from tournois where organisation_id = auth_organisation_id())
  );
create policy "matchs_americano: manager update" on matchs_americano
  for update using (
    tournoi_id in (select id from tournois where organisation_id = auth_organisation_id())
  );

-- ----------------------------------------------------------------------------
-- 6. Accès rôle anon (public sans session)
-- ----------------------------------------------------------------------------

grant select on matchs_americano to anon;
grant select on participants_public to anon;
grant execute on function get_participant_by_code(text) to anon;
