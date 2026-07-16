-- ============================================================================
-- VAMOS — Schéma initial (6 tables + RLS)
--
-- Modèle de sécurité :
--   - /manager/*  → authentifié, restreint au complexe_id de l'utilisateur
--   - /tableau/[id] et /t/[code] → publics (rôle anon), lecture seule
--
-- IMPORTANT : `equipes.code_acces` est un secret (c'est le seul token qui
-- protège l'espace joueur). On ne l'expose donc JAMAIS via un SELECT public
-- direct sur `equipes` — on passe par la vue `equipes_public` (sans la
-- colonne) pour l'affichage, et par la fonction `get_equipe_by_code()` pour
-- la résolution d'un code précis (pas d'énumération possible).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Tables
-- ----------------------------------------------------------------------------

create table complexes (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  email text not null unique,
  plan text not null default 'trial' check (plan in ('trial', 'per_tournament', 'monthly')),
  tournois_gratuits_restants int not null default 1,
  actif boolean not null default true,
  created_at timestamptz not null default now()
);

create table users (
  id uuid primary key references auth.users (id) on delete cascade,
  complexe_id uuid not null references complexes (id) on delete cascade,
  role text not null default 'manager' check (role in ('admin', 'manager')),
  created_at timestamptz not null default now()
);

create table tournois (
  id uuid primary key default gen_random_uuid(),
  complexe_id uuid not null references complexes (id) on delete cascade,
  nom text not null,
  date date not null,
  categorie_fft text not null check (categorie_fft in ('P25', 'P50', 'P100', 'P250', 'P500', 'P1000', 'P1500')),
  nb_equipes int not null check (nb_equipes >= 2),
  nb_terrains int not null check (nb_terrains >= 1),
  heure_debut timestamptz not null,
  duree_match_minutes int not null default 60,
  statut text not null default 'setup' check (statut in ('setup', 'en_cours', 'termine')),
  created_at timestamptz not null default now()
);

create table equipes (
  id uuid primary key default gen_random_uuid(),
  tournoi_id uuid not null references tournois (id) on delete cascade,
  nom text not null,
  joueur1 text not null,
  joueur2 text not null,
  code_acces text not null unique,
  tete_serie int,
  tableau text check (tableau in ('winners', 'consolante')),
  place_finale int,
  points_fft int,
  created_at timestamptz not null default now()
);

create table matchs (
  id uuid primary key default gen_random_uuid(),
  tournoi_id uuid not null references tournois (id) on delete cascade,
  equipe1_id uuid references equipes (id),
  equipe2_id uuid references equipes (id),
  gagnant_id uuid references equipes (id),
  terrain int,
  tour int not null,
  match_num int not null,
  tableau text not null check (tableau in ('winners', 'consolante')),
  places_en_jeu text,
  statut text not null default 'en_attente' check (
    statut in ('en_attente', 'equipes_presentes', 'en_cours', 'termine')
  ),
  equipe1_presente boolean not null default false,
  equipe2_presente boolean not null default false,
  score_equipe1 text,
  score_equipe2 text,
  est_bye boolean not null default false,
  heure_convocation timestamptz,
  heure_debut timestamptz,
  heure_fin timestamptz,
  score_propose_equipe1 text,
  score_propose_equipe2 text,
  score_propose_par uuid references equipes (id),
  statut_score text check (statut_score in ('propose', 'confirme', 'conteste')),
  created_at timestamptz not null default now()
);

create table notes_joueurs (
  id uuid primary key default gen_random_uuid(),
  code_acces text not null,
  equipe_ciblee_id uuid not null references equipes (id) on delete cascade,
  contenu text not null,
  created_at timestamptz not null default now()
);

-- Index utiles aux requêtes live (filtrage par tournoi + tri par tour)
create index matchs_tournoi_id_idx on matchs (tournoi_id);
create index matchs_tournoi_tour_idx on matchs (tournoi_id, tour, match_num);
create index equipes_tournoi_id_idx on equipes (tournoi_id);
create index equipes_code_acces_idx on equipes (code_acces);

-- ----------------------------------------------------------------------------
-- Vue publique équipes (sans code_acces)
-- ----------------------------------------------------------------------------

create view equipes_public as
  select
    id, tournoi_id, nom, joueur1, joueur2,
    tete_serie, tableau, place_finale, points_fft, created_at
  from equipes;

-- ----------------------------------------------------------------------------
-- Fonction : résoudre un code d'accès joueur sans exposer la table
-- SECURITY DEFINER contourne le RLS de `equipes` pour cette seule requête
-- ciblée (une ligne exacte), sans jamais permettre d'énumérer les codes.
-- ----------------------------------------------------------------------------

create or replace function get_equipe_by_code(p_code text)
returns table (
  id uuid,
  tournoi_id uuid,
  nom text,
  joueur1 text,
  joueur2 text,
  tete_serie int,
  tableau text,
  place_finale int,
  points_fft int
)
language sql
security definer
set search_path = public
as $$
  select id, tournoi_id, nom, joueur1, joueur2, tete_serie, tableau, place_finale, points_fft
  from equipes
  where code_acces = upper(p_code)
  limit 1;
$$;

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------

alter table complexes enable row level security;
alter table users enable row level security;
alter table tournois enable row level security;
alter table equipes enable row level security;
alter table matchs enable row level security;
alter table notes_joueurs enable row level security;

-- Aide : le complexe_id de l'utilisateur connecté
create or replace function auth_complexe_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select complexe_id from users where id = auth.uid();
$$;

-- complexes : un manager ne voit/modifie que son propre complexe
create policy "complexes: select own" on complexes
  for select using (id = auth_complexe_id());
create policy "complexes: update own" on complexes
  for update using (id = auth_complexe_id());

-- users : visible uniquement à l'intérieur du même complexe
create policy "users: select same complexe" on users
  for select using (complexe_id = auth_complexe_id());

-- tournois : lecture publique (nécessaire pour /tableau/[id] et /t/[code]
-- qui n'ont pas de session), écriture réservée au manager du complexe
create policy "tournois: public select" on tournois
  for select using (true);
create policy "tournois: insert own complexe" on tournois
  for insert with check (complexe_id = auth_complexe_id());
create policy "tournois: update own complexe" on tournois
  for update using (complexe_id = auth_complexe_id());
create policy "tournois: delete own complexe" on tournois
  for delete using (complexe_id = auth_complexe_id());

-- equipes : la table brute (avec code_acces) n'est lisible/gérable QUE par
-- le manager du complexe. Le public passe par `equipes_public` ou par
-- `get_equipe_by_code()`, jamais par cette table directement.
create policy "equipes: manager select" on equipes
  for select using (
    tournoi_id in (select id from tournois where complexe_id = auth_complexe_id())
  );
create policy "equipes: manager insert" on equipes
  for insert with check (
    tournoi_id in (select id from tournois where complexe_id = auth_complexe_id())
  );
create policy "equipes: manager update" on equipes
  for update using (
    tournoi_id in (select id from tournois where complexe_id = auth_complexe_id())
  );

-- matchs : lecture publique (tableau + espace joueur), écriture manager.
-- Note : la saisie de score par le joueur (statut_score = 'propose') passe
-- par une fonction dédiée à écrire plus tard (sub-projet espace Joueur),
-- pas par un UPDATE public direct sur la table.
create policy "matchs: public select" on matchs
  for select using (true);
create policy "matchs: manager insert" on matchs
  for insert with check (
    tournoi_id in (select id from tournois where complexe_id = auth_complexe_id())
  );
create policy "matchs: manager update" on matchs
  for update using (
    tournoi_id in (select id from tournois where complexe_id = auth_complexe_id())
  );

-- notes_joueurs : un joueur peut laisser une note (insert public), seul le
-- manager du complexe concerné peut les lire.
create policy "notes_joueurs: public insert" on notes_joueurs
  for insert with check (true);
create policy "notes_joueurs: manager select" on notes_joueurs
  for select using (
    equipe_ciblee_id in (
      select e.id from equipes e
      join tournois t on t.id = e.tournoi_id
      where t.complexe_id = auth_complexe_id()
    )
  );

-- Accès explicite pour le rôle anon (public sans session) sur ce qui doit
-- être lisible sans authentification.
grant select on tournois to anon;
grant select on matchs to anon;
grant select on equipes_public to anon;
grant insert on notes_joueurs to anon;
grant execute on function get_equipe_by_code(text) to anon;
