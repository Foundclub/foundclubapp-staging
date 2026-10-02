/**
 * 🏛️ COLL-CONSOLE (02/10/2026) — ce que la console du super-admin LIT de ses listes, sans
 * ecran ni reseau (design HY521H1, page 2 « Console : créer la collectivité »).
 *
 * Les nombres de la tuile « Collectivités », les filtres de la liste, le tri des demandes de
 * rattachement et « Par FoundClub », et l etat de l offre club par club : tout se calcule ici,
 * depuis ce que le serveur a deja rendu. Rien n est devine : un etat que le serveur n a pas
 * dit n est pas affiche.
 */

/**
 * @typedef {{ clubsCount: number, documentId: string, isActive: boolean, name: string,
 *   type: string }} AdminCollectiviteRow
 */

/**
 * Les nombres de la tuile « Collectivités » du dashboard (planche P2-console, état 1 et 2).
 *   - `total` : les collectivites lues ;
 *   - `actives` et `clubsCovered` : les actives, et les clubs qu elles couvrent ;
 *   - `toActivate` et `clubsWaiting` : les INACTIVES qui ont deja des clubs (elles passent la
 *     tuile en orange), et les clubs qui attendent leur activation.
 * Une collectivite inactive SANS club n attend rien : elle ne compte que dans `total`.
 * @param {AdminCollectiviteRow[]} rows - Les lignes de `toAdminCollectiviteRow`.
 * @returns {{ actives: number, clubsCovered: number, clubsWaiting: number, toActivate: number,
 *   total: number }} Le bilan.
 */
export const summarizeAdminCollectivites = (rows) => (Array.isArray(rows) ? rows : [])
  .reduce((bilan, ligne) => {
    const clubs = Number(ligne?.clubsCount) || 0;
    if (ligne?.isActive === true) {
      return {
        ...bilan,
        actives: bilan.actives + 1,
        clubsCovered: bilan.clubsCovered + clubs,
        total: bilan.total + 1,
      };
    }
    if (clubs > 0) {
      return {
        ...bilan,
        clubsWaiting: bilan.clubsWaiting + clubs,
        toActivate: bilan.toActivate + 1,
        total: bilan.total + 1,
      };
    }
    return { ...bilan, total: bilan.total + 1 };
  }, {
    actives: 0, clubsCovered: 0, clubsWaiting: 0, toActivate: 0, total: 0,
  });

/**
 * Un texte sans casse ni accent, pour chercher « montrivage » dans « Ville de Montrivage ».
 * @param {unknown} texte - Le texte.
 * @returns {string} Le texte replie.
 */
const replier = (texte) => String(texte || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

/** @typedef {'all' | 'active' | 'inactive'} AdminCollectiviteFilter */

/**
 * La liste filtree par etat et par nom (planche P2-liste : « Chercher une collectivité » et
 * les trois filtres). Le filtre se fait sur la liste RECUE : rien n est relu.
 * @param {AdminCollectiviteRow[]} rows - Les lignes.
 * @param {{ filter?: AdminCollectiviteFilter, query?: string }} criteres - Le filtre et le texte.
 * @returns {AdminCollectiviteRow[]} Les lignes retenues, dans leur ordre.
 */
export const filterAdminCollectivites = (rows, { filter = 'all', query = '' } = {}) => {
  const cherche = replier(query);
  return (Array.isArray(rows) ? rows : []).filter((ligne) => {
    if (filter === 'active' && ligne?.isActive !== true) return false;
    if (filter === 'inactive' && ligne?.isActive === true) return false;
    return !cherche || replier(ligne?.name).includes(cherche);
  });
};

/**
 * Les trois nombres des filtres : « Toutes (n) », « Actives (n) », « Inactives (n) ».
 * @param {AdminCollectiviteRow[]} rows - Les lignes.
 * @returns {{ active: number, all: number, inactive: number }} Les nombres.
 */
export const countAdminCollectivitesByFilter = (rows) => {
  const lignes = Array.isArray(rows) ? rows : [];
  const actives = lignes.filter((ligne) => ligne?.isActive === true).length;
  return { active: actives, all: lignes.length, inactive: lignes.length - actives };
};

/**
 * La lettre de l ecusson d une collectivite : celle de son nom propre, le DERNIER mot
 * (« Ville de Montrivage » → M, « Département du Var » → V, « Région Sud » → S).
 * @param {string} name - Le nom officiel.
 * @returns {string} Une lettre majuscule, ou « ? ».
 */
export const collectiviteInitial = (name) => {
  const mots = String(name || '').trim().split(/[\s'’-]+/).filter(Boolean);
  const dernier = mots[mots.length - 1] || '';
  return dernier ? dernier[0].toLocaleUpperCase('fr') : '?';
};

/**
 * Les demandes de la console, rangees comme ses onglets (lot COLL-CLUBS, serveur
 * `GET /superadmin/collectivite-invitations`) :
 *   - `attachRequests` : un DIRIGEANT a demande le rattachement de son club, pas encore fait ;
 *   - `foundclub` : une mairie a donne un club absent de FoundClub (« Par FoundClub »), pas
 *     encore rattache — qu il se soit inscrit depuis (« inscrit ») ou non (« envoyee ») ;
 *   - `done` : tout ce qui est rattache.
 * @param {any[] | null | undefined} rows - Les demandes rendues par le serveur.
 * @returns {{ attachRequests: any[], done: any[], foundclub: any[] }} Les trois piles.
 */
export const splitAdminInvitations = (rows) => {
  const lignes = Array.isArray(rows) ? rows : [];
  const enAttente = (/** @type {string} */ kind) => lignes
    .filter((ligne) => ligne?.kind === kind && ligne?.status !== 'attached');
  return {
    attachRequests: enAttente('attach_request'),
    done: lignes.filter((ligne) => ligne?.status === 'attached'),
    foundclub: enAttente('foundclub'),
  };
};

/** @typedef {'atActivation' | 'offered' | 'paysItself'} ClubOfferState */

/**
 * L ETAT DE L OFFRE CLUB PAR CLUB (planche P2-fiche, bloc 3 : « À l'activation », « Offerte par
 * la Ville », « Paie lui-même »), lu dans l APERCU du serveur (`PUT …/active` avec
 * `previewIsActive`, TEXTES-COLLECTIVITES : meme juge que le geste, rien d ecrit) :
 *   - collectivite INACTIVE, apercu d « activer » : `granted` → elle le recevra a l activation,
 *     `already-paid` → il paie lui-meme ;
 *   - collectivite ACTIVE, apercu de « couper » : `revoked` → il a l offre de la Ville,
 *     `none` → il ne l a pas (il paie lui-meme, comme le dit la planche).
 * Un verdict inconnu, ou un apercu absent (serveur ancien, panne) : aucun etat — jamais un faux.
 * @param {any} response - La reponse de l apercu.
 * @returns {Map<string, ClubOfferState>} L etat par documentId de club.
 */
export const readClubOfferStates = (response) => {
  const etats = new Map();
  const data = response?.data;
  if (data?.preview !== true || !Array.isArray(data?.clubs)) return etats;
  /** @type {Record<string, ClubOfferState>} */
  const parVerdict = {
    'already-paid': 'paysItself', granted: 'atActivation', none: 'paysItself', revoked: 'offered',
  };
  data.clubs.forEach((/** @type {any} */ club) => {
    const etat = parVerdict[String(club?.offer || '')];
    if (club?.clubDocumentId && etat) etats.set(String(club.clubDocumentId), etat);
  });
  return etats;
};
