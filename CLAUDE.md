# VAMOS

SaaS de gestion de tournois de padel (France). 3 espaces : `/manager/*` (organisateur, authentifié), `/tableau/[id]` (écran public TV, lecture seule), `/t/[code]` (joueur, lien sans login, mobile-first).

## Stack

Next.js 14 (App Router) · Supabase (DB + Auth + Realtime) · TypeScript · Vercel. **Jamais Tailwind** — CSS vanilla / CSS Modules uniquement (OKLCH + `backdrop-filter` custom passent mal en utilitaires).

## Contexte complet

Lire `HANDOFF.md` à la racine avant toute modification substantielle — il couvre l'état exact de chaque fichier, un bug de bracket déjà rencontré et corrigé (ne pas le réintroduire), le barème FFT et ses limites connues, et l'ordre de construction recommandé.

## Design — une seule source de vérité

`design_handoff_vamos/` (HTML/CSS/JSX de référence, hi-fi) fait foi, **pas** le violet mentionné ailleurs dans l'historique du projet. Accent = cuivre `oklch(0.72 0.16 55)`, fond = photo `assets/da-background.png` (pas de CSS généré). En cas de doute sur une couleur ou une animation, se référer à `design_handoff_vamos/styles.css` et son `README.md`, jamais à une autre source.

## Règles non négociables

- Jamais de valeurs `oklch()` converties en hex.
- Box-shadow des `.liquid-btn` : reproduire exactement, ne jamais approximer.
- `equipes.code_acces` ne doit jamais être exposé via un SELECT public direct — passer par la vue `equipes_public` ou la fonction `get_equipe_by_code()` (déjà en place dans la migration).
- Toujours gérer `est_bye === true` (match déjà terminé, pas de score à saisir).
- `ChronoLive` : `useRef` + manipulation DOM directe, pas `useState` (évite un re-render/seconde par terrain sur les pages avec plusieurs chronos simultanés).
- Après toute modification de `lib/bracket.ts` : revérifier avec une simulation de tournoi jouée jusqu'au bout (8, 16 équipes minimum) avant de considérer que c'est correct — un bug de collision silencieuse y a déjà été trouvé une fois de cette façon, pas en relisant le code.

## Commandes

```
npm run dev
npx tsc --noEmit          # vérifier avant de considérer une tâche terminée
```
