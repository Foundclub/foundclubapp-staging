/**
 * Les coordonnees portees par une ville choisie, ou rien.
 *
 * Les deux feuilles de filtres rangent la ville dans la meme forme que les
 * ecrans pleins qu'elles remplacent : `{ label, value: 'lon|lat' }`.
 *
 * ⚠️ Le controle porte sur la VALEUR, pas sur le resultat du decoupage :
 * `''.split('|')` rend `['']`, un tableau vide de sens mais bien truthy. C'est
 * ce qui faisait calculer un geohash sur des `NaN` dans les ecrans pleins quand
 * la ville venait d'etre effacee.
 * @param {any} city La ville retenue.
 * @returns {{ lat: number, lon: number } | null} Les coordonnees, ou null.
 */
const coordonneesDeLaVille = (city) => {
  const brut = typeof city?.value === 'string' ? city.value : '';
  if (!brut) return null;
  const [lon, lat] = brut.split('|').map(Number);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon };
};

export default coordonneesDeLaVille;
