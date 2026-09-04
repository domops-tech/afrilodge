/**
 * Carte de situation approximative (CDC §6.1.4). Coordonnées arrondies à
 * 2 décimales (~1 km de précision) avant tout affichage : l'adresse
 * exacte n'est jamais montrée avant confirmation de réservation
 * (CDC §6.1.5). Embed OpenStreetMap plutôt qu'une bibliothèque JS de carte
 * interactive : aucun script ajouté au poids de notre propre page
 * (CDC §7.3) — c'est un iframe tiers, pas une dépendance de notre bundle.
 */
function roundApprox(value: number): number {
  return Math.round(value * 100) / 100;
}

export function ApproximateMap({ latitude, longitude }: { latitude: number; longitude: number }) {
  const lat = roundApprox(latitude);
  const lng = roundApprox(longitude);
  const delta = 0.02; // ~2km de large, pour rester "approximatif"
  const bbox = [lng - delta, lat - delta, lng + delta, lat + delta].join(",");
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;

  return (
    <iframe
      title="Situation approximative"
      src={src}
      loading="lazy"
      className="h-56 w-full rounded-[var(--radius-default)] border border-border"
    />
  );
}
