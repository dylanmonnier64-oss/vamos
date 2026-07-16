# Handoff: Vamos — Login + Tableau Tournoi

## Overview
Deux écrans pour Vamos, un site de tournois de padel : une page de connexion et un tableau d'affichage live des matchs (écran TV type tournoi). DA noire/photo, wordmark dispersé animé, boutons "liquid glass" façon iOS.

## About the design files
Les fichiers HTML/CSS/JSX de ce dossier sont des **références de design** faites en HTML+React (via Babel standalone, pas de build step) — ce sont des prototypes qui montrent le rendu et le comportement voulus, **pas du code à copier tel quel en prod**. La tâche : recréer fidèlement ces designs dans l'environnement du codebase cible (React/Next, Vue, etc., ou le framework déjà en place), avec ses propres conventions de composants — sans réécrire l'app autour de ce HTML.

## Fidelity
**Haute-fidélité (hifi)**. Toutes les couleurs, tailles, ombres, polices, et animations ci-dessous sont finales. Reproduire pixel-perfect, y compris les micro-animations (elles font partie de l'identité de marque, pas des à-côtés).

## Fichiers
- `Vamos Login.html` — page de connexion, monte `<LoginPistaFR>` (dans `login-variations.jsx`)
- `Tableau Tournoi.html` — tableau live des matchs, monte `<TournoiBoard>` (dans `tournoi-board.jsx`)
- `styles.css` — tokens globaux + tout le CSS partagé (glass, wordmark, atmosphère, form fields, scatter letters)
- `tournoi-board.css` — CSS spécifique au tableau tournoi (grid des créneaux, pills, match rows)
- `login-variations.jsx` — composants React de la page login (Babel JSX, pas de JSX précompilé)
- `tournoi-board.jsx` — composants React du tableau tournoi
- `assets/da-background.png` — photo de fond utilisée telle quelle (dégradé prune → ardoise → olive → cuivre), appliquée en `background-image` sur `.bg-stage` / `.pista-stage` / `.board-stage`. **Ne pas régénérer en CSS — utiliser ce fichier tel quel.**

Polices (Google Fonts, à charger via `<link>`, poids exacts) :
```
Boldonse (400) — wordmark display ("vamos", "ALLEZ, ON JOUE.", horloge)
Geist (300,400,500,600,700) — UI / texte courant
Geist Mono (400,500) — labels, eyebrows, pills, mono
```

## Design tokens

Couleurs (voir `:root` dans `styles.css`) :
- `--ink-0: #f5f0ff` texte principal
- `--ink-1: #d8cee6` texte secondaire
- `--ink-2: #9a8db0` texte tertiaire / labels
- `--ink-3: #5e5470` texte le plus discret
- `--rule: rgba(255,255,255,0.08)` séparateurs
- Fond de scène : image `assets/da-background.png` en `background-size: cover; background-position: center`
- Accent principal (boutons primaires, pills actifs, glow) — dégradé cuivre :
  `linear-gradient(180deg, #a85a1e 0%, #7a4318 55%, #3d1508 100%)` (et variante pill `#c76b28 → #7a4318 → #3d1508`)
- Accent texte (wordmark "tournoi", liens hover, checkbox coché, focus ring) : `oklch(0.72 0.16 55)`
- 3 orbes atmosphériques violet/vert/cuivre en overlay doux (`mix-blend-mode: screen`, `filter: blur(60px)`, opacités ~0.12–0.22× une intensité réglable) — voir composant `Atmosphere` dans `login-variations.jsx` et le bloc équivalent dans `tournoi-board.jsx` pour les valeurs exactes (tailles vw/vh, positions, couleurs oklch).

Rayons : cards/glass = 22px ; boutons = 999px (pill) ; inputs = 12px ; slot tournoi = 22px ; match row = 12px.

## Écran 1 — Login (`Vamos Login.html` / `LoginPistaFR`)

**Layout** : `display: grid; grid-template-columns: 1.1fr 1fr;` plein viewport (`.pista-stage`), stack en 1 colonne sous 960px (media query dans `styles.css`).

### Colonne gauche (`.pista-left`)
- Header : wordmark "vamos" (Boldonse 16px) + eyebrow "· Bon retour sur le terrain ·" (Geist Mono, 11px, letter-spacing 0.18em, uppercase, `--ink-2`), alignés sur une ligne, `align-items: baseline`, `gap: 18px`.
- Hero centré verticalement (`.pista-hero`, `align-self: center`) : wordmark géant composé de deux mots empilés en `<h1 class="pista-hero-title">` (Boldonse, `clamp(96px, 13vw, 192px)`, line-height 0.85, uppercase, letter-spacing -0.02em) :
  - Ligne 1 : "ALLEZ," — chaque lettre dispersée avec rotation/translation/scale aléatoire (voir Animations). Seed=7 par défaut, la virgule/lettre à l'index 5 est accentuée en couleur cuivre.
  - Ligne 2 : "ON JOUE." — seed=11, chaos ×1.1, couleur de base `--ink-2` (plus discret que la ligne 1), lettre à l'index 7 accentuée cuivre.
- Pas de sous-titre / paragraphe sous le hero (retiré intentionnellement suite à itération).

### Colonne droite (`.pista-right`)
Card glass centrée (`.pista-card`, max-width 440px) :
- Eyebrow "CONNEXION" (mono, 11px)
- H2 "Ton terrain, ton match." (Geist, `clamp(24px,2.2vw,30px)`, weight 500, letter-spacing -0.025em)
- Sous-titre "Entre tes identifiants ou continue avec un fournisseur." (`--ink-2`, 14px)
- Formulaire (`<LoginForm>`) :
  - Champ **E-mail** (label mono uppercase 10.5px, input `.field-input` h=50px, radius 12px, fond `rgba(8,4,18,0.6)` + gradient blanc très léger, border `rgba(255,255,255,0.08)`, focus → border `rgba(170,110,255,.55)` + halo — **⚠️ le focus ring est resté violet dans le code actuel, à recolorer en cuivre `rgba(200,110,50,...)` pour cohérence avec le reste — voir section Écarts connus**)
  - Champ **Mot de passe** avec lien "Oublié ?" aligné à droite du label, et bouton toggle œil (SVG inline `EyeIcon`) positionné en absolu à droite du champ
  - Checkbox "Se souvenir de moi" (`.check`, 18×18px, radius 5px, coché = dégradé cuivre + glow)
  - **Bouton primaire liquid glass** "Entrer sur le terrain →" pleine largeur, h=54px (voir section Liquid Glass)
  - Divider "Ou continue avec" (ligne + texte mono centré, pseudo-elements `::before/::after` en dégradé)
  - 2 boutons liquid glass secondaires (Google, Apple) en grid 2 colonnes, icônes SVG inline
- Pas de lien "créer un compte" (retiré suite à itération)

### États du bouton principal (JS dans `LoginForm`)
1. Repos → "Entrer sur le terrain →"
2. Submit avec email+mdp remplis → `loading = true` pendant 1100ms → 3 points qui clignotent en cascade (`Dot`, animation `vamosBlink`, delays 0/120/240ms)
3. Puis → "¡Vamos! ✓" pendant 1800ms → retour à l'état repos

## Écran 2 — Tableau Tournoi (`Tableau Tournoi.html` / `TournoiBoard`)

**Layout** : `.board-stage`, grid `grid-template-rows: auto 1fr`, padding responsive `clamp(24px,2.6vw,40px)`.

- Header (`.board-header`) : à gauche wordmark "vamos" + "tournoi" (Boldonse, ~24-28px, lowercase, "tournoi" en couleur accent cuivre `oklch(0.72 0.16 55)` + text-shadow glow) ; à droite horloge live (`<BoardClock>`, Boldonse `clamp(44px,5vw,68px)`, met à jour l'heure toutes les 20s via `setInterval`, format HH:MM). Pas de date ni de sous-titre sous l'horloge. Pas de badge HDMI, pas de footer.
- Grille de 4 cartes "créneaux" (`.board-grid`, `grid-template-columns: repeat(2,1fr)`, 1 colonne sous 760px) : 10h00 (live), 11h15 (à suivre), 12h30, 14h00.
- Chaque carte (`.slot`) = panel glass (voir Liquid Glass), radius 22px, padding 28px. Contient :
  - Header du slot : heure (Boldonse ~30px) + label mono ("4 terrains") ; si live → pill "● EN DIRECT" (glow cuivre + `live-dot` pulsé) ; si next → pill discret "À SUIVRE"
  - 4 lignes "match" (`.match`) : `Terrain N` (Geist 13px) + pill de statut liquid glass (En cours / Fin de poule / Quart de finale / Demi-finale…). Les champs équipes/scores sont **volontairement vides** (juste un trait dégradé `.team-empty`) — à remplir avec les vraies données de match.
  - Le créneau live a un rim + glow cuivre plus marqué (`.slot-live`) et ses match rows sont teintées (`.match-live`).

## Animations — liste exhaustive (ne pas en oublier une seule)

1. **`vamosFloat`** (`styles.css`, appliqué à chaque `.scatter-letter`) :
   ```css
   @keyframes vamosFloat { 0% { filter: brightness(1); } 100% { filter: brightness(1.15); } }
   ```
   Chaque lettre du wordmark scatter tourne en boucle `ease-in-out alternate infinite`, durée `4 + (i % 5) * 0.4`s, delay `i * 0.08`s (i = index de la lettre) → effet de scintillement décalé lettre par lettre, jamais synchrone.

2. **Position statique par lettre** (pas une keyframe, mais fait partie du "look animé") : chaque lettre a un `transform: translate(dx,dy) rotate(rot) scale(scale)` calculé par un PRNG déterministe seedé (`mulberry32`, voir composant `ScatteredWord` dans `login-variations.jsx`) : rot ±40°×chaos, dy ±12px×chaos, dx ±7px×chaos, scale 0.91–1.09×chaos. `transform-origin: 50% 70%`.

3. **Hover sur une lettre** (`.scatter-letter:hover`) : `transition: transform 280ms cubic-bezier(.2,.7,.3,1)` → la lettre revient à `translate(0,0) rotate(0) scale(1.06)` et passe en couleur accent cuivre, `z-index: 5`.

4. **`vamosBlink`** (inline `<style>` dans `Vamos Login.html`, PAS dans styles.css — bien la reporter) :
   ```css
   @keyframes vamosBlink { 0%,80%,100% { opacity:.3; transform: scale(.8); } 40% { opacity:1; transform: scale(1); } }
   ```
   Utilisé par les 3 `<Dot>` du bouton en état loading, delays 0/120/240ms, durée 900ms infinite.

5. **`vamosPulse`** (`tournoi-board.css`) :
   ```css
   @keyframes vamosPulse { 0%,100% { transform: scale(1); opacity:1; } 50% { transform: scale(1.45); opacity:.65; } }
   ```
   Sur `.live-dot` (point rouge/cuivre en haut à droite de chaque match row du créneau live) — 1.4s infinite ease-in-out.

6. **Hover boutons liquid glass** (`.liquid-btn:hover`) : `transform: scale(1.04)` + `filter: brightness(1.08)`, transition `300ms cubic-bezier(.2,.7,.3,1)` (transform) / `200ms ease` (filter). `:active` → `scale(0.97)`.

7. **Focus des inputs** (`.field-input:focus`) : transition `border-color 180ms ease, box-shadow 180ms ease` vers halo violet (à recolorer, voir Écarts connus).

8. **Horloge live** : pas une animation CSS, mais un `setInterval` JS (20000ms) qui remonte l'heure système — à reproduire côté état (ex. `useEffect` + `setInterval`, cleanup au unmount).

## Liquid Glass — technique exacte (bouton et pills)

Ce n'est PAS un simple `backdrop-filter: blur()`. La technique combine un filtre SVG de distorsion + 3 calques :

```html
<svg width="0" height="0" style="position:absolute">
  <filter id="liquid-glass-filter" x="0%" y="0%" width="100%" height="100%" colorInterpolationFilters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency="0.05 0.05" numOctaves="1" seed="1" result="turbulence" />
    <feGaussianBlur in="turbulence" stdDeviation="2" result="blurredNoise" />
    <feDisplacementMap in="SourceGraphic" in2="blurredNoise" scale="70" xChannelSelector="R" yChannelSelector="B" result="displaced" />
    <feGaussianBlur in="displaced" stdDeviation="4" result="finalBlur" />
  </filter>
</svg>
```

Markup bouton (3 spans empilés dans un seul `<button>`) :
```jsx
<button className="liquid-btn liquid-btn-primary">
  <span className="lb-bg" />      {/* backdrop-filter: url(#liquid-glass-filter) blur(2px) saturate(160%) */}
  <span className="lb-shadow" />  {/* box-shadow en couches = rim de highlights blancs iOS */}
  <span className="liquid-btn-content">Entrer sur le terrain →</span>
</button>
```
Toutes les valeurs de `box-shadow` (rim highlights insets, glow externe) sont dans `styles.css` sous `.liquid-btn`, `.lb-shadow`, `.liquid-btn-primary .lb-shadow`. Les pills du tableau tournoi (`tournoi-board.jsx` → `LiquidPill`, CSS dans `tournoi-board.css` sous `.lpill*`) réutilisent exactement le même principe à plus petite échelle (padding 5px 12px, radius 999px).

**Important** : le `<svg><filter>` doit être présent dans le DOM avant que les boutons ne s'affichent, sinon Chrome tombe en fallback `blur()` simple et perd l'effet de distorsion visible.

## Assets
- `assets/da-background.png` — photo fournie par l'utilisateur (dégradé prune/ardoise/olive/cuivre), utilisée telle quelle en fond plein cadre sur les deux écrans (`background-size: cover; background-position: center`). Ne pas la recréer en CSS gradient — la fidélité vient du fichier lui-même.
- Aucune icône externe : Google (`GoogleIcon`) et Apple (`AppleIcon`) sont des SVG inline dans `login-variations.jsx`.

## Écarts connus / à corriger pendant la recréation
- Le focus-ring des `.field-input` et le `border-bottom-color` de `.field-input.underline` référencent encore des couleurs violettes historiques (`rgba(170,110,255,...)`, teinte oklch 298) alors que la DA a été recolorée en cuivre (`oklch(0.72 0.16 55)`, `#a85a1e`/`#7a4318`). Recolorer ces deux points de focus en cuivre pour rester cohérent avec le reste (checkbox, accent liens, wordmark "tournoi" utilisent déjà le cuivre).
- `vamosBlink` est défini inline dans `Vamos Login.html` plutôt que dans `styles.css` — à consolider si vous centralisez toutes les keyframes dans un seul fichier de styles côté prod.
