/* eslint-disable no-underscore-dangle */

/**
 * D95 — le compteur de joueurs qui attendent un club.
 *
 * Ce fichier est volontairement SEPARE de `adminService.js` : ce dernier
 * instancie le client HTTP au chargement, qui tire lui-meme des modules natifs
 * (`react-native-device-info`). Une fonction pure enfermee la-dedans ne peut
 * pas etre testee sans empiler les mocks. Ici, zero import : le test la charge
 * telle quelle.
 */

/** Valeur de l'enumeration `requestKind` du schema Strapi `club-request`. */
export const TEAM_NOT_FOUND_KIND = 'team_not_found';

/**
 * La clef qui identifie « le meme club » entre deux demandes.
 * L'identifiant prime ; le nom normalise n'est le repli que s'il n'y en a pas
 * (les demandes venues de l'onboarding sont une recherche en texte libre).
 * @param {object} item
 * @returns {string}
 */
const buildWaitedClubKey = (item = {}) => {
  const clubId = String(item?.searchContext?.clubId || '').trim();
  if (clubId) return `id:${clubId}`;
  const clubName = String(item?.clubName || '').trim().toLowerCase();
  return clubName ? `name:${clubName}` : '';
};

/**
 * Le chiffre qui rend l'onglet super-admin vendable.
 * « 12 joueurs de votre club vous attendent sur FoundClub » est un appel qui se
 * decroche ; « un joueur a demande » ne l'est pas. On compte des JOUEURS
 * DISTINCTS, pas des demandes : les doublons deja en base gonfleraient le
 * chiffre a vide.
 * @param {object[]} items demandes deja annotees de `__requestType`
 * @returns {object[]} les memes items, annotes de `__waitingPlayersCount`
 */
export const annotateWaitingPlayersPerClub = (items = []) => {
  const requestersByClub = new Map();

  items.forEach((item) => {
    if (item?.__requestType !== TEAM_NOT_FOUND_KIND) return;
    const clubKey = buildWaitedClubKey(item);
    if (!clubKey) return;
    if (!requestersByClub.has(clubKey)) requestersByClub.set(clubKey, new Set());
    // Un compte sans identifiant lisible compte quand meme pour 1 : on retombe
    // sur l'identifiant de la demande, jamais sur 0.
    requestersByClub.get(clubKey).add(
      String(item?.user?.documentId || item?.user?.id || `request:${item?.documentId || ''}`),
    );
  });

  return items.map((item) => {
    if (item?.__requestType !== TEAM_NOT_FOUND_KIND) return item;
    const clubKey = buildWaitedClubKey(item);
    return {
      ...item,
      __waitingPlayersCount: clubKey ? (requestersByClub.get(clubKey)?.size || 1) : 1,
    };
  });
};
