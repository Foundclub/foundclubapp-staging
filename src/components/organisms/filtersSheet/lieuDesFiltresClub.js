import coordonneesDeLaVille from './cityCoordinates';

// ANNUAIRE-E1 (29/09) — les règles du « Lieu » de la recherche de clubs, en UN exemplaire.
//
// Elles vivaient dans la feuille « Filtrer » (ClubFiltersSheet). Les pastilles de filtre
// (PastillesFiltresClub) appliquent le même lieu en un seul geste : deux copies de la même règle,
// c'est une des deux qu'on oublie de corriger. Module sans appel réseau.

export const RAYON_PAR_DEFAUT = 20;

/**
 * Un texte sans accent ni casse, pour comparer des noms de lieux.
 * @param {unknown} valeur Le texte.
 * @returns {string} Le texte comparable.
 */
export const normaliserLieu = (valeur) => String(valeur || '')
  .normalize('NFD')
  .replace(/\p{Diacritic}/gu, '')
  .toLowerCase()
  .trim();

/**
 * Le libellé d'un lieu : une ville avec son rayon, un département ou une région avec son seul nom
 * (RECHERCHE-UNIQUE phase 3), sinon « Toutes les villes ».
 * @param {any} city Le lieu tel que les filtres le rangent.
 * @param {number} radius Le rayon, en km.
 * @param {string} toutesLesVilles Le libellé sans lieu.
 * @returns {string} Le libellé.
 */
export const libelleDuLieu = (city, radius, toutesLesVilles) => {
  if (city?.territoire) return String(city.nom || city.label);
  if (city?.label) {
    return `${String(city.label)} · ${String(Number(radius) || RAYON_PAR_DEFAUT)} km`;
  }
  return toutesLesVilles;
};

/**
 * RECHERCHE-UNIQUE (phase 3, décision d'Adel du 25/09 « Q2 = B ») : le champ Lieu propose les
 * départements et régions de l'annuaire AVANT les adresses.
 * @param {{
 *  recherche: string,
 *  t: (clef: string, repli: string) => string,
 *  territoires: any,
 * }} params Le texte tapé, la traduction et la liste des départements et régions.
 * @returns {any[]} Les options du champ Lieu.
 */
export const optionsDeTerritoires = ({ recherche, t, territoires }) => {
  const terme = normaliserLieu(recherche);
  if (terme.length < 2) return [];
  const correspond = (/** @type {any} */ item) => normaliserLieu(item?.name).includes(terme)
    || normaliserLieu(item?.code) === terme;
  /**
   * Traduit un lieu de l'annuaire en option du champ Lieu.
   * @param {any} item Un département ou une région de l'annuaire.
   * @param {'departement' | 'region'} territoire Son échelle.
   * @returns {any} L'option du champ Lieu.
   */
  const versOption = (item, territoire) => ({
    code: item.code || null,
    label: `${item.name} (${territoire === 'departement'
      ? t('clubFiltersSheet.department', 'département')
      : t('clubFiltersSheet.region', 'région')})`,
    nom: item.name,
    slug: item.slug,
    territoire,
    value: `${territoire}:${item.slug}`,
  });
  const regions = (territoires?.regions || []).filter(correspond).slice(0, 3);
  const departements = (territoires?.departments || []).filter(correspond).slice(0, 5);
  return [
    ...regions.map((/** @type {any} */ item) => versOption(item, 'region')),
    ...departements.map((/** @type {any} */ item) => versOption(item, 'departement')),
  ];
};

/**
 * Les filtres de la recherche une fois un sport et un lieu choisis. Part TOUJOURS de `filters` :
 * le nom tapé vit dans la même poche (`name`), un payload reconstruit de zéro l'effacerait.
 * @param {{
 *  activity: string,
 *  city: any,
 *  filters?: Record<string, any> | null,
 *  getGeohashForPointAndRadius: (lat: number, lon: number, radius: number) => string | undefined,
 *  radius: number,
 * }} params
 * @returns {Record<string, any>} Les filtres à appliquer.
 */
export const filtresAvecLieu = ({
  activity, city, filters, getGeohashForPointAndRadius, radius,
}) => {
  // Un département ou une région n'a ni point ni rayon : la liste lira l'annuaire par son slug.
  if (city?.territoire) {
    return {
      ...(filters || {}),
      activity,
      city,
      geohash: undefined,
      lat: undefined,
      lon: undefined,
      radius,
    };
  }
  const coordonnees = coordonneesDeLaVille(city);
  const geohash = coordonnees
    ? getGeohashForPointAndRadius(coordonnees.lat, coordonnees.lon, radius)
    : undefined;

  // Une ville retirée doit RETIRER sa zone : laisser traîner l'ancien `geohash` ferait mentir la
  // pastille et filtrerait sur une zone que plus aucun libellé n'annonce.
  return {
    ...(filters || {}),
    activity,
    city: city || { label: '', value: '' },
    geohash: geohash || undefined,
    lat: coordonnees ? coordonnees.lat : undefined,
    lon: coordonnees ? coordonnees.lon : undefined,
    radius,
  };
};
