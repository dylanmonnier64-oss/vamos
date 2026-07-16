# VAMOS — Handoff pour Claude Code

Ce document résume tout ce qui a été conçu et construit jusqu'ici, pour éviter d'avoir à
redécouvrir le contexte depuis zéro. À donner en premier message à Claude Code.

---

## ⚠️ À lire en premier : conflit de source sur la DA

Deux sources de vérité existent sur ce projet, et elles **se contredisent sur les couleurs** :

1. **Le brief texte original** (violet `#2D0D4E`, fond généré en CSS avec orbes + bruit SVG)
2. **Le handoff de design `design_handoff_vamos/`** (zip fourni par Dylan, exporté de Claude
   Design) — DA **cuivre**, fond en **photo fournie**, animations différentes

**Dylan a confirmé explicitement que le zip est la version actuelle et fait foi.** Le brief
texte ci-dessous garde son intérêt pour tout le reste (architecture, DB, logique métier,
flux) mais **sa section Design System (couleurs, fond atmosphérique) est obsolète**.

### Ce qui change concrètement

| | Brief texte (obsolète) | `design_handoff_vamos/` (actuel) |
|---|---|---|
| Accent principal | Violet `#2D0D4E` | **Cuivre** `oklch(0.72 0.16 55)` / `#a85a1e → #7a4318 → #3d1508` |
| Fond atmosphérique | Généré en CSS (`.bg-stage` + 3 orbes + bruit SVG en data-URI) | **Photo fournie** `assets/da-background.png` (dégradé prune/ardoise/olive/cuivre), `background-size: cover` |
| `vamosFloat` (ScatteredWord) | `translateY(0 → -6px)` | `filter: brightness(1 → 1.15)` — **différent, pas juste une couleur** |
| Rotation par lettre | ±8° | ±40°×chaos |
| Scale par lettre | 0.94–1.08 | 0.91–1.09×chaos |

Les composants déjà livrés (`BgAtmo.tsx`, `LiquidButton.tsx` variante primary, `ScatteredWord.tsx`)
ont été construits sur le brief texte (violet, fond généré) **avant** que ce conflit soit
identifié. Ils sont fonctionnellement corrects (structure, logique, perf) mais leurs valeurs de
couleur et l'animation de `ScatteredWord` sont à corriger pour matcher `design_handoff_vamos/`.

**Recommandation** : reconstruire `BgAtmo`, la variante `liquid-btn-primary`, et `ScatteredWord`
directement depuis `design_handoff_vamos/styles.css` + `login-variations.jsx` (source de
vérité pixel-perfect), plutôt que de patcher les fichiers existants à l'aveugle.

### Écarts connus à corriger, même dans le handoff design (notés dans son propre README)
- Le focus-ring des `.field-input` référence encore du violet (`rgba(170,110,255,...)`) → à
  recolorer en cuivre pour rester cohérent.
- `vamosBlink` est défini inline dans `Vamos Login.html` plutôt que dans `styles.css` → à
  centraliser dans le fichier de styles global côté prod.

---

## C'est quoi VAMOS

SaaS de gestion de tournois de padel, vendu en abonnement à des complexes français. Résout le
chaos organisationnel pendant un tournoi (qui joue où, quand, contre qui) via 3 espaces :

1. **Club / organisateur** (`/manager/*`) — crée et pilote le tournoi, authentifié
2. **Écran public** (`/tableau/[id]`) — affiché sur TV dans le complexe, lecture seule, public
3. **Joueur** (`/t/[code]`) — lien SMS/email sans login, mobile-first

## Stack

Next.js 14 (App Router) · Supabase (DB + Auth + Realtime) · CSS vanilla / CSS Modules
(**jamais Tailwind** — les valeurs OKLCH et le SVG turbulence passent mal en utilitaires) ·
TypeScript · Vercel · Polices Boldonse / Geist / Geist Mono.

---

## État actuel du code — fichier par fichier

Tout ce qui suit est **écrit, vérifié par `tsc --noEmit`**, et pour `lib/bracket.ts` et
`lib/fft.ts` **testé par simulation complète** (voir plus bas). Rien de tout ça n'a tourné
contre un vrai projet Supabase (pas d'instance disponible pendant sa construction) — la
vérification s'est faite en isolant chaque module.

### Fondations
- `app/globals.css` — tokens, fond atmosphérique, boutons liquid glass (3 variantes),
  cards verre, primitives de formulaire, animations. **Couleurs à corriger, cf. section DA ci-dessus.**
- `app/layout.tsx` — police via `<link>` (pas next/font, pour ne rien reformater), `BgAtmo`
  + `LiquidGlassFilter` posés une fois pour toute l'app.
- `middleware.ts` — protège `/manager/*` sauf `/manager/login`.
- `lib/supabase/client.ts` / `server.ts` — clients Supabase via `@supabase/ssr`.

### Composants UI (`components/ui/`)
`BgAtmo.tsx`, `LiquidGlassFilter.tsx`, `LiquidButton.tsx`, `GlassCard.tsx`, `ScatteredWord.tsx`,
`ChronoLive.tsx`, `LiveDot.tsx`. Détails d'implémentation notables :
- `ScatteredWord` : deux `<span>` imbriqués par lettre (transform statique du seed sur l'outer,
  animation de flottement sur l'inner) — nécessaire car une animation CSS sur `transform`
  écrase le `transform` inline pendant son exécution ; sans ça la rotation/scale du seed
  disparaît dès que la lettre flotte.
- `ChronoLive` : `useRef` + manipulation DOM directe (pas `useState`) pour éviter un
  re-render par seconde par terrain sur les pages avec plusieurs chronos simultanés.

### Base de données — `supabase/migrations/0001_init.sql`
Les 6 tables du brief + RLS complète. Point de sécurité important : `equipes.code_acces` (le
seul secret qui protège l'espace joueur) n'est **jamais** exposé via SELECT public direct — une
vue `equipes_public` (sans la colonne) et une fonction `get_equipe_by_code()` (SECURITY DEFINER,
pas d'énumération possible) gèrent l'accès public à la place.

### `lib/bracket.ts` — logique de bracket, pure et testée

**Modèle retenu (important, a changé en cours de route)** : chaque tour winners (hors la
finale) produit une **vague de perdants qui joue sa propre mini-poule indépendante**, plutôt
qu'une échelle de consolante continue où tout le monde fusionne. C'est Dylan qui a proposé
l'intuition de départ (un vrai match de 3e place entre les deux perdants de demi-finale) — la
généralisation à toutes les vagues résout un bug réel rencontré en cours de route :

> Une première version faisait fusionner les perdants de chaque tour winners dans une seule
> échelle de consolante continue. Testé sur un tournoi à 8 équipes joué jusqu'au bout : les
> deux perdants de demi-finale **disparaissaient silencieusement** du tournoi (aucune place,
> aucun point, aucune erreur levée) — deux routages différents visaient la même case
> `(tour, match_num)` par coïncidence arithmétique. Le modèle en vagues indépendantes élimine
> cette collision par construction : deux vagues n'ont jamais le même tour encodé, et une
> vague ne reçoit jamais de nouveaux arrivants après son premier sous-tour.

**Validé par simulation complète** (tournoi joué du tour 1 jusqu'à la fin, tous les gagnants
déterminés dynamiquement) sur 8, 16 et 32 équipes : toutes les équipes reçoivent une place,
places 1/2/3/4 toujours uniques, ex-æquo corrects sur les bandes plus larges, aucune boucle
infinie. Le script de simulation n'est pas livré dans le repo (c'était un scratch de
vérification) — si un doute survient sur une taille de tableau non testée, le plus sûr est de
rejouer le même genre de simulation avant de faire confiance au résultat.

**Règle ex-æquo FFT** (confirmée par le document officiel FFT, cf. `lib/fft.ts`) : si un match
de classement n'a pas lieu, les équipes concernées partagent la même place, la moins favorable
du groupe. C'est exactement ce que le modèle en vagues implémente nativement.

**Fonctions clés** : `initialiserTournoi()` (tour 1 uniquement, byes, têtes de série aux
positions 0/total÷2/total÷4/3×total÷4), `onScoreSaisi()` (toute la progression + placements
définitifs), `generateCodeAcces()`, `nextPowerOfTwo()`.

**Limite connue non résolue** : le seeding ne gère que 4 têtes de série max (positions
canoniques du brief). Un tableau avec 8+ têtes de série nécessiterait une vraie table de
seeding étendue — pas construite, pas demandée jusqu'ici.

### `lib/fft.ts` — barème officiel FFT

Grille **complète et vérifiée** pour P25, P50, P100, P250, P500 — barème en vigueur **depuis
le 1er mars 2026** (Chapitre II FFT, MAJ février 2026). L'ancien barème (juillet 2024) trouvé
en premier lieu est obsolète, non utilisé.

**P1000 volontairement absent.** Dans le PDF officiel FFT, les valeurs qui suivent l'intitulé
"P1000" sont en réalité celles du P1500 (vérifié : correspondance exacte avec l'ancien barème
P1500, sur deux hébergements indépendants du même document). C'est une erreur dans le document
source, pas une limite d'extraction. `getPoints('P1000', ...)` renvoie `null` plutôt qu'un
chiffre inventé — **ne pas combler cette valeur sans une vraie source vérifiée**.

P1500, P2000, P3000 inclus en bonus (non demandés, non touchés par la réforme de mars 2026).

**Règles FFT à respecter partout où des places sont calculées :**
- Ex-æquo : même rang le moins favorable, mêmes points, si le match de classement n'a pas lieu.
- Match gagné : un WO *donné* ne compte pas comme victoire pour dépasser le plancher de la
  dernière place ; un WO *reçu* (adversaire forfait) compte.

### `lib/equipes.ts`
`parseEquipes()` — parse le textarea de saisie (stepper), tolère `/`, `-`, `&` comme séparateur.

### Stepper de création — `app/manager/tournoi/new/`
`page.tsx` (3 étapes : Infos → Équipes → Récap, client component, pas de `<form>` HTML — juste
des handlers `onClick`), `actions.ts` (Server Action `creerTournoi` : crée tournoi → équipes
avec codes d'accès → appelle `initialiserTournoi` → insère le tour 1 → redirige vers la page
bracket), `stepper.module.css`.

Choix fait pendant la construction : `nb_equipes` n'est **pas** demandé comme champ séparé en
étape 1 — il est dérivé du nombre de lignes réellement parsées en étape 2, pour éviter une
incohérence entre un chiffre annoncé et la liste réelle.

Sélection des têtes de série : UI ajoutée pendant la construction (pas explicitement dans le
brief), un select par équipe parsée, 4 rangs max, un rang = une équipe.

### Pas encore construit
- `/manager/login`, `/manager/dashboard` — Dylan les a créés dans Claude Design
  (`design_handoff_vamos/Vamos Login.html`) : à recréer fidèlement en Next.js, pas à
  redemander à Claude de les inventer.
- `/manager/tournoi/[id]/bracket` — visualisation + bouton "Lancer le tournoi"
- `/manager/tournoi/[id]/live` — **la page la plus complexe** : split 50/50, terrains actifs +
  saisie score à gauche, prochains matchs avec mise à jour realtime à droite
- `/manager/tournoi/[id]/matchs` — vue liste (En cours / File d'attente / Terminés)
- `/tableau/[id]` — écran public, référence pixel-perfect dans `design_handoff_vamos/Tableau Tournoi.html`
- `/t/[code]` — espace joueur, mobile-first, y compris la saisie de score joueur
  (`statut_score`: propose/confirme/conteste)
- `components/layout/NavManager.tsx`
- Espace admin (Dylan) : gestion complexes/abonnements/facturation — basse priorité, pas
  bloquant pour un MVP fonctionnel
- Envoi effectif des liens SMS/email aux équipes au lancement du tournoi — aucun fournisseur
  n'a été choisi ni intégré, c'est un vrai trou à combler (Twilio ? Resend ? à décider)

---

## Base de données — schéma (résumé, détail complet dans la migration SQL)

```
complexes (id, nom, email, plan, tournois_gratuits_restants, actif, created_at)
users (id, complexe_id, role)
tournois (id, complexe_id, nom, date, categorie_fft, nb_equipes, nb_terrains,
          heure_debut, duree_match_minutes, statut, created_at)
equipes (id, tournoi_id, nom, joueur1, joueur2, code_acces, tete_serie,
         tableau, place_finale, points_fft, created_at)
matchs (id, tournoi_id, equipe1_id, equipe2_id, gagnant_id, terrain, tour,
        match_num, tableau, places_en_jeu, statut, equipe1_presente,
        equipe2_presente, score_equipe1, score_equipe2, est_bye,
        heure_convocation, heure_debut, heure_fin, score_propose_equipe1,
        score_propose_equipe2, score_propose_par, statut_score, created_at)
notes_joueurs (id, code_acces, equipe_ciblee_id, contenu, created_at)
```

RLS : `/manager/*` restreint au `complexe_id` de l'utilisateur connecté (via `auth_complexe_id()`).
`tournois` et `matchs` en lecture publique (nécessaire pour `/tableau` et `/t/[code]`, aucune
donnée sensible dedans). `equipes` brute réservée au manager — le public passe par
`equipes_public` (vue sans `code_acces`) ou `get_equipe_by_code()`.

---

## Flux complet d'un tournoi

```
1. Club crée le tournoi → saisit les équipes → tour 1 généré automatiquement
2. Bracket visualisé → bouton "Lancer le tournoi" (statut 'setup' → 'en_cours')
3. Chaque équipe reçoit son lien /t/[code] (SMS/email — fournisseur non choisi, cf. trous ci-dessus)
4. Joueurs arrivent → manager coche la présence sur /manager/.../live (colonne gauche)
5. 2 équipes présentes → match lancé → chrono démarre
6. /tableau/[id] et /t/[code] reflètent le match en live via Realtime
7. Score saisi (manager ou joueur) → onScoreSaisi() → gagnant avance, perdant tombe en
   consolante (ou est éliminé avec place_finale + points_fft si déjà en consolante)
8. Colonne droite du split manager + tableau public se mettent à jour automatiquement
9. Tournoi 'termine' quand plus aucun match n'est en cours
10. Chaque joueur voit sa place finale + points FFT sur /t/[code]
```

---

## Realtime — pattern à réutiliser partout

```ts
supabase.channel(`tournoi-${id}`)
  .on('postgres_changes', { event: '*', table: 'matchs', filter: `tournoi_id=eq.${id}` }, () => loadMatchs())
  .subscribe()
```

Indicateur visuel : `LiveDot` (déjà construit) sur chaque match en cours + dans une topbar.

---

## Recommandation d'ordre de construction

1. **Login + Tableau public** en premier — seul contenu pixel-perfect spécifié
   (`design_handoff_vamos/`), le moins ambigu. Devient la nouvelle référence de tokens
   (remplace le violet des composants déjà livrés).
2. **Dashboard + stepper** — reprendre `app/manager/tournoi/new/` déjà livré, juste retoucher
   aux nouveaux tokens cuivre.
3. **Page live** (`/manager/tournoi/[id]/live`) — la plus complexe, à faire fraîche plutôt
   qu'en fin de session. Bon candidat pour un modèle plus capable (raisonnement sur l'état +
   le realtime).
4. **Bracket viz + vue matchs**
5. **Espace joueur** `/t/[code]` — mobile-first, réutilise les mêmes patterns realtime
6. **Admin/facturation** — dernier, non bloquant pour un MVP

---

## Modèle économique (contexte, pas prioritaire pour le MVP)

Plans `trial` / `per_tournament` / `monthly`. Espace super admin (Dylan) séparé pour gérer
complexes, abonnements, facturation — route à part, accès restreint.
