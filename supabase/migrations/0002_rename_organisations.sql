-- ============================================================================
-- VAMOS — 0002 : renommage complexes → organisations
--
-- "Un complexe = un club de padel" est trop spécifique. On généralise le
-- concept en "organisation" tant que le schéma est petit (seuls `users` et
-- `tournois` référencent la colonne aujourd'hui). Le mot "club" ne subsiste
-- que dans les libellés UI (français), jamais dans les noms SQL.
--
-- Ordre imposé par les dépendances : on retire d'abord les policies qui
-- dépendent de auth_complexe_id(), puis la fonction, puis on renomme table +
-- colonnes, on recrée la fonction sur la nouvelle colonne, et enfin on recrée
-- les policies avec des noms et des références propres. Les policies purement
-- publiques (public select / public insert) ne référencent pas complexe_id et
-- restent intactes. La donnée est préservée (rename ≠ recréation).
-- ============================================================================

-- 1. Retirer les policies dépendant de auth_complexe_id() / complexe_id.
drop policy if exists "complexes: select own" on complexes;
drop policy if exists "complexes: update own" on complexes;
drop policy if exists "users: select same complexe" on users;
drop policy if exists "tournois: insert own complexe" on tournois;
drop policy if exists "tournois: update own complexe" on tournois;
drop policy if exists "tournois: delete own complexe" on tournois;
drop policy if exists "equipes: manager select" on equipes;
drop policy if exists "equipes: manager insert" on equipes;
drop policy if exists "equipes: manager update" on equipes;
drop policy if exists "matchs: manager insert" on matchs;
drop policy if exists "matchs: manager update" on matchs;
drop policy if exists "notes_joueurs: manager select" on notes_joueurs;

-- 2. Supprimer la fonction d'aide (plus aucune policy n'en dépend).
drop function if exists auth_complexe_id();

-- 3. Renommer la table et les colonnes. Les FK, index et l'état RLS activé
--    sont conservés automatiquement par le rename.
alter table complexes rename to organisations;
alter table users rename column complexe_id to organisation_id;
alter table tournois rename column complexe_id to organisation_id;

-- 4. Recréer la fonction d'aide sur la nouvelle colonne.
create or replace function auth_organisation_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organisation_id from users where id = auth.uid();
$$;

-- 5. Recréer les policies avec des noms et des références propres.

-- organisations : un manager ne voit/modifie que sa propre organisation
create policy "organisations: select own" on organisations
  for select using (id = auth_organisation_id());
create policy "organisations: update own" on organisations
  for update using (id = auth_organisation_id());

-- users : visible uniquement à l'intérieur de la même organisation
create policy "users: select same organisation" on users
  for select using (organisation_id = auth_organisation_id());

-- tournois : lecture publique déjà gérée par "tournois: public select"
-- (intacte) ; écriture réservée au manager de l'organisation.
create policy "tournois: insert own organisation" on tournois
  for insert with check (organisation_id = auth_organisation_id());
create policy "tournois: update own organisation" on tournois
  for update using (organisation_id = auth_organisation_id());
create policy "tournois: delete own organisation" on tournois
  for delete using (organisation_id = auth_organisation_id());

-- equipes : table brute (avec code_acces) réservée au manager de l'organisation
create policy "equipes: manager select" on equipes
  for select using (
    tournoi_id in (select id from tournois where organisation_id = auth_organisation_id())
  );
create policy "equipes: manager insert" on equipes
  for insert with check (
    tournoi_id in (select id from tournois where organisation_id = auth_organisation_id())
  );
create policy "equipes: manager update" on equipes
  for update using (
    tournoi_id in (select id from tournois where organisation_id = auth_organisation_id())
  );

-- matchs : lecture publique déjà gérée par "matchs: public select" (intacte) ;
-- écriture réservée au manager.
create policy "matchs: manager insert" on matchs
  for insert with check (
    tournoi_id in (select id from tournois where organisation_id = auth_organisation_id())
  );
create policy "matchs: manager update" on matchs
  for update using (
    tournoi_id in (select id from tournois where organisation_id = auth_organisation_id())
  );

-- notes_joueurs : insert public déjà géré par "notes_joueurs: public insert"
-- (intacte) ; lecture réservée au manager de l'organisation concernée.
create policy "notes_joueurs: manager select" on notes_joueurs
  for select using (
    equipe_ciblee_id in (
      select e.id from equipes e
      join tournois t on t.id = e.tournoi_id
      where t.organisation_id = auth_organisation_id()
    )
  );
