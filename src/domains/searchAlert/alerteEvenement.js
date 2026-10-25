/**
 * ALERTES (audit V1, A20) — ce qu'une alerte « événements » garde des filtres de la
 * recherche, et comment on la nomme. Fonctions PURES : aucune ne parle au serveur.
 *
 * Le serveur ne lit d'une alerte d'événements que la ville, le rayon, la zone, le
 * sport, la catégorie, le niveau, le type et le club
 * (`admin/src/api/search-alert/services/filter-normalizer.ts:62-91`), et il REFUSE
 * une alerte sans ville ou sans rayon (`filter-normalizer.ts:127-135`). On le sait
 * donc AVANT d'appeler : sans ville, pas d'alerte, et l'écran le dit.
 *
 * Tout le reste des filtres de la recherche (texte tapé, dates, équipe, zone de la
 * carte) n'a pas de sens pour une alerte, qui guette les événements À VENIR : ces
 * critères restent sur la recherche et ne partent pas.
 */

export const RAYON_ALERTE_PAR_DEFAUT = 20;

/** La mémoire « déjà vu » de la proposition de première ouverture (`tutorialStorage`). */
export const PROPOSITION_ALERTE_EVENEMENTS = 'search_events_alert_offer';

/**
 * ALERTES-ANNONCES (30/09) — les deux sortes d'alerte que la recherche propose :
 * Rechercher › Événement et Rechercher › Recrutement (`alerteAnnonce.js`).
 */
export const SorteAlerte = Object.freeze({
  annonce: 'annonce',
  evenement: 'evenement',
});

/** Les trois issues d'une création, lues par la carte, la feuille et la proposition. */
export const StatutAlerte = Object.freeze({
  creee: 'creee',
  erreur: 'erreur',
  villeManquante: 'ville-manquante',
});

/**
 * Un critère à choix multiple, toujours rendu en tableau.
 * @param {any} valeur Une valeur de critère : chaîne, tableau, ou rien.
 * @returns {string[]} Les identifiants, toujours en tableau.
 */
export const enTableau = (valeur) => {
  if (Array.isArray(valeur)) return valeur.map(String).filter(Boolean);
  if (typeof valeur === 'string' && valeur) return [valeur];
  return [];
};

/**
 * Les filtres qu'une alerte peut garder, lus dans ceux de la recherche.
 * @param {Record<string, any> | null | undefined} filtres Les filtres de la recherche.
 * @returns {null | {
 *   activity: string[]; category: string[]; city: { label: string, value: string };
 *   club?: { label: string, value: string }; level: string[]; radius: number; type: string[];
 * }} Les filtres de l'alerte, ou `null` quand il manque la ville.
 */
export const filtresDeLAlerte = (filtres) => {
  const ville = filtres?.city;
  if (!ville?.value) return null;

  const rayon = Number(filtres?.radius);
  /** @type {any} */
  const alerte = {
    activity: enTableau(filtres?.activity),
    category: enTableau(filtres?.category),
    city: { label: String(ville.label || ''), value: String(ville.value) },
    level: enTableau(filtres?.level),
    radius: rayon > 0 ? rayon : RAYON_ALERTE_PAR_DEFAUT,
    type: enTableau(filtres?.type),
  };
  if (filtres?.club?.value) {
    alerte.club = { label: String(filtres.club.label || ''), value: String(filtres.club.value) };
  }
  return alerte;
};

/**
 * Le nom des sports retenus, dans l'ordre du choix.
 * @param {string[]} identifiants Les sports retenus.
 * @param {any[] | undefined} sports Les sports connus (`useGetActivities`).
 * @returns {string[]} Leurs noms, pour ceux qu'on connaît.
 */
const nomsDesSports = (identifiants, sports) => identifiants
  .map((id) => (sports || []).find((sport) => sport?.documentId === id)?.name)
  .filter(Boolean);

/**
 * La ligne lue sous « Me prévenir » : « Football · Montrivage · 20 km ».
 * @param {ReturnType<typeof filtresDeLAlerte>} alerte Les filtres de l'alerte.
 * @param {any[] | undefined} sports Les sports connus.
 * @param {string} tousLesSports Le mot dit quand aucun sport n'est retenu.
 * @returns {string} Le résumé, vide sans alerte possible.
 */
export const resumeDeLAlerte = (alerte, sports, tousLesSports) => {
  if (!alerte) return '';
  const noms = nomsDesSports(alerte.activity, sports);
  return [
    noms.length ? noms.join(', ') : tousLesSports,
    alerte.city.label,
    `${String(alerte.radius)} km`,
  ].filter(Boolean).join(' · ');
};

/**
 * Un nom déjà pris dans « Mes alertes » reçoit un numéro : « Football · Lyon (2) ».
 * Règle commune aux alertes d'événements et d'annonces (ALERTES-ANNONCES).
 * @param {string} base Le nom voulu.
 * @param {{ label?: string }[] | undefined} alertesExistantes Les alertes du compte.
 * @returns {string} Le nom, numéroté s'il est déjà pris.
 */
export function libelleUnique(base, alertesExistantes) {
  // P3-14 : chercher un nom LIBRE, pas compter les doublons
  // (« Lyon », « Lyon (3) » ⇒ « Lyon (2) »).
  const pris = new Set(
    (alertesExistantes || []).map((existante) => String(existante?.label || '')),
  );
  if (!pris.has(base)) return base;
  let numero = 2;
  while (pris.has(`${base} (${String(numero)})`)) numero += 1;
  return `${base} (${String(numero)})`;
}

/**
 * Le nom rangé dans « Mes alertes » : les sports et la ville, sinon le gabarit de
 * l'écran d'alertes (« Événement · Ville »). Un nom déjà pris reçoit un numéro,
 * exactement comme l'écran plein le faisait (`EventFilters.js:464-477`).
 * @param {NonNullable<ReturnType<typeof filtresDeLAlerte>>} alerte Les filtres de l'alerte.
 * @param {any[] | undefined} sports Les sports connus.
 * @param {{ label?: string }[] | undefined} alertesExistantes Les alertes du compte.
 * @param {string} libelleSansSport Le gabarit déjà traduit.
 * @returns {string} Le nom.
 */
export const libelleDeLAlerte = (alerte, sports, alertesExistantes, libelleSansSport) => {
  const noms = nomsDesSports(alerte.activity, sports);
  const base = noms.length
    ? [noms.join(', '), alerte.city.label].filter(Boolean).join(' · ')
    : libelleSansSport;
  return libelleUnique(base, alertesExistantes);
};

/**
 * Deux recherches identiques pour une alerte donnent la même signature.
 * @param {ReturnType<typeof filtresDeLAlerte>} alerte Les filtres de l'alerte.
 * @returns {string} La signature, vide sans alerte possible.
 */
export const signatureDeLAlerte = (alerte) => (alerte ? JSON.stringify(alerte) : '');
