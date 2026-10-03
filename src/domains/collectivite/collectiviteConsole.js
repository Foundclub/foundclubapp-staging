/**
 * 🏛️ COLL-CONSOLE (02/10/2026) — ce que la console du super-admin LIT de ses listes, sans
 * ecran ni reseau (design HY521H1, page 2 « Console : créer la collectivité »).
 *
 * Les nombres de la tuile « Collectivités », les filtres de la liste, le tri des demandes de
 * rattachement et « Par FoundClub », et l etat de l offre club par club : tout se calcule ici,
 * depuis ce que le serveur a deja rendu. Rien n est devine : un etat que le serveur n a pas
 * dit n est pas affiche.
 */

import { getShortAddress } from '@/utils/location';

/**
 * @typedef {{ activatedAt?: string | null, clubsCount: number, documentId: string, isActive: boolean,
 *   membersCount?: number | null, name: string, type: string }} AdminCollectiviteRow
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

// ─── COLL-CONSOLE-BIS (03/10/2026) : LA FICHE D UNE COLLECTIVITE (planche 15) ─────────────

/**
 * Le departement d un code INSEE : ses 2 premiers caracteres (2A, 2B compris), 3 outre-mer.
 * @param {unknown} codeInsee - Le code.
 * @returns {string} Le departement, ou ''.
 */
const departementDe = (codeInsee) => {
  const code = String(codeInsee || '').trim().toUpperCase();
  if (!code) return '';
  return /^9[78]/.test(code) ? code.slice(0, 3) : code.slice(0, 2);
};

/**
 * La PROXIMITE dans la recherche de clubs a rattacher : d abord les clubs de la commune de la
 * collectivite (meme code INSEE), puis ceux de son departement, puis les autres ; l ordre du
 * serveur (alphabetique) est garde dans chaque groupe. Sans code INSEE, rien ne bouge.
 * ponytail: la proximite par les codes, pas par la distance ; voie de sortie : le geohash du
 * club, si une Ville voisine compte un jour.
 * @param {any[]} resultats - Les clubs trouves (`raw.inseeCom`).
 * @param {unknown} codeInsee - Le code INSEE de la collectivite.
 * @returns {any[]} Les memes clubs, ranges.
 */
export const sortClubsByProximity = (resultats, codeInsee) => {
  const lignes = Array.isArray(resultats) ? resultats : [];
  const ville = String(codeInsee || '').trim().toUpperCase();
  if (!ville) return lignes;
  const rang = (/** @type {any} */ resultat) => {
    const code = String(resultat?.raw?.inseeCom || '').trim().toUpperCase();
    if (code && code === ville) return 0;
    if (code && departementDe(code) === departementDe(ville)) return 1;
    return 2;
  };
  return lignes
    .map((resultat, index) => ({ index, rang: rang(resultat), resultat }))
    .sort((a, b) => a.rang - b.rang || a.index - b.index)
    .map(({ resultat }) => resultat);
};

/**
 * La ville d un club (son libelle officiel SIRENE, sinon son adresse publique), et son sport (ses
 * activites, deux au plus) : « Montrivage · Basket ».
 * @param {any} club - Le club (`cityName`, `addressDetails`, `activites`).
 * @returns {string} La ligne, ou ''.
 */
export const clubCityAndSport = (club) => {
  const ville = String(club?.cityName || '').trim() || getShortAddress(club?.addressDetails);
  const sports = (Array.isArray(club?.activites) ? club.activites : [])
    .map((/** @type {any} */ activite) => String(activite?.name || '').trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(', ');
  return [ville, sports].filter(Boolean).join(' · ');
};

/**
 * L e-mail d un gestionnaire, pour l equipe FoundClub (planche 15 : « [e-mail du compte] »), sauf
 * l e-mail de REMPLISSAGE que le serveur pose a la creation d un compte par telephone
 * (`<numero>@example.com`) : ce n est pas une adresse, et il porterait le numero. La console ne
 * lit des gestionnaires que le nom et l e-mail (minimisation, temoin collectiviteDisplay).
 * @param {{ email?: string | null }} compte - Le compte.
 * @returns {string | null} L e-mail, ou null.
 */
export const managerEmail = (compte) => {
  const email = String(compte?.email || '').trim();
  return email.includes('@') && !/@example\.com$/i.test(email) ? email : null;
};

/**
 * Le prenom et le nom d un nom affiche (« Karim Benali »), pour le rond a ses initiales.
 * @param {unknown} nom - Le nom affiche.
 * @returns {{ firstname: string, lastname: string }} Le premier mot, et le dernier.
 */
export const splitDisplayName = (nom) => {
  const mots = String(nom || '').trim().split(/\s+/).filter(Boolean);
  return { firstname: mots[0] || '', lastname: mots.length > 1 ? mots[mots.length - 1] : '' };
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
