// Parsing du textarea de saisie des équipes (stepper de création).
// Isolé du reste de bracket.ts : ce n'est pas de la logique de tableau,
// juste de la préparation d'input utilisateur — mais reste pur et testable
// pour les mêmes raisons que le reste de lib/.

export interface EquipeSaisie {
  joueur1: string
  joueur2: string
}

export interface ParseEquipesResult {
  equipes: EquipeSaisie[]
  /** Lignes non vides qui n'ont pas pu être parsées (pas de séparateur, ou un seul nom). */
  lignesInvalides: string[]
}

/**
 * Parse le textarea "Joueur1 / Joueur2" (une équipe par ligne). Accepte
 * "/", "-" ou "&" comme séparateur pour tolérer les habitudes de saisie
 * (le brief ne spécifie que "/", les deux autres sont une extension
 * raisonnable plutôt qu'une contrainte stricte à faire respecter à l'utilisateur).
 */
export function parseEquipes(texte: string): ParseEquipesResult {
  const equipes: EquipeSaisie[] = []
  const lignesInvalides: string[] = []

  const lignes = texte
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  for (const ligne of lignes) {
    const parts = ligne.split(/[/&-]/).map((p) => p.trim()).filter(Boolean)
    if (parts.length !== 2) {
      lignesInvalides.push(ligne)
      continue
    }
    equipes.push({ joueur1: parts[0], joueur2: parts[1] })
  }

  return { equipes, lignesInvalides }
}
