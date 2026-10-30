// Outfit n'a pas d'espace fine insécable (U+202F) : les milliers se collent. On la remplace par une espace insécable ordinaire.
export function nbsp(formatted: string): string {
  return formatted.replace(/ /g, " ");
}
