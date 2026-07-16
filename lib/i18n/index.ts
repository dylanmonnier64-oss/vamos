import { fr } from './fr'

// Une seule langue peuplée pour l'instant (FR). Ajouter une langue = créer un
// fichier de même forme et l'enregistrer ici, puis brancher une sélection de
// locale (cookie / header). Pas de contexte React nécessaire : t() est une
// simple fonction synchrone, utilisable côté serveur comme client.
const dictionnaire = fr

type Vars = Record<string, string | number>

/**
 * Résout une clé imbriquée ('login.titre') dans le dictionnaire et interpole
 * les `{placeholders}` avec `vars`. Si la clé est absente ou ne pointe pas sur
 * une chaîne, on renvoie la clé elle-même — un texte manquant reste ainsi
 * visible à l'écran plutôt que de casser le rendu.
 */
export function t(cle: string, vars?: Vars): string {
  const valeur = cle.split('.').reduce<unknown>((acc, segment) => {
    if (acc != null && typeof acc === 'object' && segment in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[segment]
    }
    return undefined
  }, dictionnaire)

  if (typeof valeur !== 'string') return cle

  if (!vars) return valeur
  return valeur.replace(/\{(\w+)\}/g, (_, nom: string) =>
    nom in vars ? String(vars[nom]) : `{${nom}}`
  )
}
