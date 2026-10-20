// Script pour use_figma, à exécuter uniquement après rétablissement du quota.
// skillNames: figma-use,figma-generate-design
// À contrôler par captures ensuite : ce fichier n'a PAS été exécuté.
const page = await figma.getNodeByIdAsync('7:51');
await figma.setCurrentPageAsync(page);
await Promise.all(['Regular', 'Medium', 'SemiBold', 'Bold'].map(style => figma.loadFontAsync({ family: 'Geist', style })));
await figma.loadFontAsync({ family: 'Tinos', style: 'Regular' });
const ids = ['75:223','77:259','77:331','77:353','77:377','77:399','77:423','77:451','77:605','77:681','77:711','77:732','78:281','78:357','78:379','78:401','78:423'];
const affected = [];
const bounds = [];
for (let i = 0; i < ids.length; i++) {
  const screen = await figma.getNodeByIdAsync(ids[i]);
  if (!screen || screen.parent.id !== page.id) throw new Error(`Écran introuvable : ${ids[i]}`);
  // Deux colonnes de largeur suffisante évitent le chevauchement bureau/mobile.
  screen.x = 6400 + (i % 2) * 1700;
  screen.y = 100 + Math.floor(i / 2) * 1600;
  affected.push(screen.id);
  for (const text of screen.findAllWithCriteria({ types: ['TEXT'] })) {
    if (text.characters === 'Application terrain' || text.characters === 'Back-office') {
      text.textAutoResize = 'WIDTH_AND_HEIGHT';
      affected.push(text.id);
    }
  }
  bounds.push({ id: screen.id, name: screen.name, x: screen.x, y: screen.y, width: screen.width, height: screen.height });
}
return { mutatedNodeIds: affected, bounds };
