/**
 * LE COMPLEXE DE RÉSERVATION, CÔTÉ JOUEUR — RESA-L6A (14/10/2026), chantier Réservation.
 *
 * Les routes du serveur après RESA-L1A + L1B + L2A (contrat : dépôt méthode
 * `docs/RESERVATION_CONTRAT_API_L1.md`, les deux parties ; source qui fait foi : admin
 * `origin/feat/RESAL2A-admin` = f76ddb38, `src/api/complexe/routes/*.ts`). La lecture publique
 * (recherche, page du complexe, terrains, créneaux d'un jour) se fait SANS compte ; réserver, lire
 * et annuler SA réservation demandent un compte. Le serveur est le seul juge : il recalcule le
 * prix, le mode et l'état, et ne lit que sa liste blanche (`readBookingPayload`).
 *
 * ⚠️ NON LIVRÉ (ni recette ni production, 14/10) : tout ce qui appelle ce module est caché par
 * l'interrupteur `COMPLEXES_JOUEUR` (`src/config/fonctionsMasquees.js`).
 *
 * Le client HTTP est IMPORTÉ, jamais chargé par `require` : le site compile ce fichier et le
 * navigateur n'a pas `require` (témoin `views/reserverTerrain/__tests__/site.sansRequire.test.js`).
 *
 * Témoin : `__tests__/complexeJoueurService.test.js`.
 */
import client from '../client';

/**
 * Le corps d'une réponse.
 * @param {Promise<any>} reponse - La réponse axios.
 * @returns {Promise<any>} Son corps.
 */
const corps = async (reponse) => (await reponse).data;

const enc = (/** @type {unknown} */ valeur) => encodeURIComponent(String(valeur || ''));

/**
 * Les filtres remplis seulement : le serveur refuse un filtre mal formé, il ne doit pas en
 * recevoir de vides.
 * @param {Record<string, unknown>} filtres - Les filtres de l'écran.
 * @returns {Record<string, unknown>} Ceux qui ont une valeur.
 */
const remplis = (filtres) => Object.fromEntries(
  Object.entries(filtres || {}).filter(([, valeur]) => (
    valeur !== null && valeur !== undefined && valeur !== ''
  )),
);

/**
 * E-P01 — chercher un terrain libre (ou un complexe par son nom, A-P11), sans compte.
 * @param {{ apres?: string | null, cadre?: string | null, date?: string | null,
 *   lat?: number | null, lng?: number | null, q?: string | null, rayon?: number | null,
 *   sport?: string | null }} filtres - Les filtres (`GET /public-complexes`).
 * @returns {Promise<any>} `{ data: { complexes: [...], date } }`.
 */
export const chercherDesTerrains = async (filtres) => corps(
  client.get('/public-complexes', { params: remplis(filtres) }),
);

/**
 * E-P02 — la page publique d'un complexe (liste fermée de champs).
 * @param {string} slug - L'adresse publique du complexe.
 * @returns {Promise<any>} `{ data: complexe }` ; 404 COMPLEXE_NOT_FOUND s'il n'est plus là.
 */
export const lireComplexePublic = async (slug) => corps(
  client.get(`/public-complexes/${enc(slug)}`),
);

/**
 * E-P02 — les terrains réservables d'un complexe actif.
 * @param {string} slug - L'adresse publique du complexe.
 * @returns {Promise<any>} `{ data: [terrain] }`.
 */
export const lireTerrainsPublics = async (slug) => corps(
  client.get(`/public-complexes/${enc(slug)}/terrains`),
);

/**
 * E-P03 / E-P06 — les créneaux d'UN jour d'un terrain : `libre | pris | ferme | trop-tard`, avec
 * leur prix ; un terrain « téléphone seulement » montre aussi les siens (A-G24).
 * @param {string} slug - L'adresse publique du complexe.
 * @param {string} terrainId - documentId du terrain.
 * @param {string} date - « AAAA-MM-JJ », aujourd'hui à +90 jours.
 * @returns {Promise<any>} `{ data: { date, slots, terrain } }`.
 */
export const lireCreneauxDuJour = async (slug, terrainId, date) => corps(
  client.get(`/public-complexes/${enc(slug)}/terrains/${enc(terrainId)}/creneaux`, {
    params: { date },
  }),
);

/**
 * E-P04 — le récapitulatif : les mêmes contrôles que « Réserver », rien n'est écrit (`dryRun` DANS
 * LE CORPS). Il rend le prix figé, l'état à venir (`willBe`), le délai d'annulation, la case du
 * numéro permise ou non (`canSharePhone`).
 * @param {{ date: string, from: string, note?: string | null, phoneShared?: boolean,
 *   players?: number, terrain: string }} demande - Le créneau choisi.
 * @returns {Promise<any>} `{ data: { dryRun: true, willBe, price, … } }`.
 */
export const apercuDeReservation = async (demande) => corps(
  client.post('/reservations-terrain', { data: demande, dryRun: true }),
);

/**
 * E-P04 → E-P05 — réserver (automatique : confirmée ; manuel : demande en attente).
 * @param {{ date: string, from: string, note?: string | null, phoneShared?: boolean,
 *   players?: number, terrain: string }} demande - Le créneau choisi.
 * @returns {Promise<any>} `{ data: réservation vue par son réserveur }` (201).
 */
export const reserverUnCreneau = async (demande) => corps(
  client.post('/reservations-terrain', { data: demande }),
);

/**
 * E-P07 — SA réservation (404 pour celle d'un autre).
 * @param {string} reservationId - documentId de la réservation.
 * @returns {Promise<any>} `{ data: réservation }`.
 */
export const lireMaReservation = async (reservationId) => corps(
  client.get(`/reservations-terrain/${enc(reservationId)}`),
);

/**
 * E-P07 — annuler SA réservation, dans le délai FIGÉ du complexe (une demande se retire
 * toujours) ; après : 409 COMPLEXE_RESERVATION_CANCEL_TOO_LATE et le numéro du complexe.
 * @param {string} reservationId - documentId de la réservation.
 * @returns {Promise<any>} `{ data: réservation annulée }`.
 */
export const annulerMaReservation = async (reservationId) => corps(
  client.post(`/reservations-terrain/${enc(reservationId)}/annuler`, {}),
);

/**
 * RESA-L6B-1 — E-P10 « Mes réservations » : SES réservations d'une période (50 au plus ; à venir
 * dans l'ordre du calendrier, passées et refusées des plus récentes aux plus anciennes).
 * @param {'a-venir' | 'passees' | 'refusees'} periode - L'onglet.
 * @returns {Promise<any>} `{ data: [réservation vue par son réserveur] }`.
 */
export const lireMesReservations = async (periode) => corps(
  client.get('/reservations-terrain/mine', { params: { periode } }),
);

/**
 * RESA-L6B-1 — E-P14 : la réponse à la question de la veille (N-20). « confirme » : le complexe lit
 * « Confirmée la veille » ; « annule » : le créneau est libéré, même après le délai (AT-07, marquée
 * « hors délai »). Refus 409 COMPLEXE_RESERVATION_STATE si aucune question n'est posée, si elle est
 * déjà annulée ou si elle a commencé.
 * @param {string} reservationId - documentId de la réservation.
 * @param {'confirme' | 'annule'} reponse - La réponse.
 * @param {{ jeton?: string | null }} [options] - `jeton` : celui du compte que vise la notification
 *   (bouton d'une notification, sur un téléphone qui porte plusieurs comptes).
 * @returns {Promise<any>} `{ data: réservation vue par son réserveur }`.
 */
export const repondreALaVeille = async (reservationId, reponse, { jeton = null } = {}) => corps(
  client.post(
    `/reservations-terrain/${enc(reservationId)}/veille`,
    { data: { reponse } },
    jeton ? { headers: { Authorization: `Bearer ${jeton}` } } : undefined,
  ),
);

// ---------------------------------------------------------------------------------------------
// RESA-L6B-2 (20/10/2026) — jouer à plusieurs (serveur RESA-L3) et la communauté du joueur
// (serveur RESA-L4) : contrat « Ajouté après RESA-L3 et RESA-L4 » (admin `integ/RESA-admin`
// a91b03c7). Témoin : `__tests__/complexeJoueurService.L6B2.test.js`.
// ---------------------------------------------------------------------------------------------

/**
 * E-P07 — le groupe d'une réservation : rôle, ma réponse, les participants (prénom + initiale), le
 * lien (réserveur), la collecte, l'équipe, l'annonce, la discussion, la conversation (réserveur).
 * @param {string} reservationId - documentId de la réservation (404 hors du groupe).
 * @returns {Promise<any>} `{ data: groupe }`.
 */
export const lireLeGroupe = async (reservationId) => corps(
  client.get(`/reservations-terrain/${enc(reservationId)}/groupe`),
);

/**
 * E-P07 — un participant répond (le réserveur est toujours présent : 409).
 * @param {string} reservationId - documentId de la réservation.
 * @param {'present' | 'absent'} reponse - Sa réponse.
 * @returns {Promise<any>} `{ data: groupe }` ; 403 `_AGE` / `_BIRTHDATE_REQUIRED` / `_BANNED`,
 *   409 `_COMPLETE` / `_STATE`.
 */
export const repondreALaPartie = async (reservationId, reponse) => corps(
  client.post(`/reservations-terrain/${enc(reservationId)}/reponse`, { data: { reponse } }),
);

/**
 * E-P05 / E-P07 — le lien d'invitation du réserveur : l'activer (le relire), ou le désactiver
 * (le code est effacé).
 * @param {string} reservationId - documentId de la réservation.
 * @param {boolean} actif - Vrai : un lien ; faux : plus de lien.
 * @returns {Promise<any>} `{ data: { actif, code, url } }`.
 */
export const lienDInvitation = async (reservationId, actif) => corps(
  client.post(
    `/reservations-terrain/${enc(reservationId)}/lien`,
    { data: { actif: actif === true } },
  ),
);

/**
 * E-P08 — la page d'un lien, SANS compte (liste fermée : jamais un numéro ni un nom complet).
 * @param {string} code - Le code du lien (`foundclub.app/r/<code>`).
 * @returns {Promise<any>} `{ data: { code, etat, message, organisateur, participants, … } }` ;
 *   404 `COMPLEXE_RESERVATION_LIEN_INVALIDE`.
 */
export const lireLInvitation = async (code) => corps(
  client.get(`/public-reservations/${enc(code)}`),
);

/**
 * E-P08 — répondre par le lien (avec un compte).
 * @param {string} code - Le code du lien.
 * @param {'present' | 'absent'} reponse - La réponse.
 * @returns {Promise<any>} `{ data: groupe }` (entrée « lien »).
 */
export const repondreParLeLien = async (code, reponse) => corps(
  client.post(`/reservations-terrain/lien/${enc(code)}/reponse`, { data: { reponse } }),
);

/**
 * E-P07 — la discussion du groupe (RG-FIL : la règle des mineurs du fil amical) : ouverte la
 * première fois, complétée ensuite.
 * @param {string} reservationId - documentId de la réservation.
 * @returns {Promise<any>} `{ data: { chat, membres, exclus } }` ;
 *   403 `MINOR_DIRECT_CHAT_FORBIDDEN`.
 */
export const ouvrirLaDiscussion = async (reservationId) => corps(
  client.post(`/reservations-terrain/${enc(reservationId)}/discussion`, {}),
);

/**
 * E-P07 — « Écrire au complexe » (le réserveur, AT-04 : la conversation de SA réservation).
 * @param {string} reservationId - documentId de la réservation.
 * @returns {Promise<any>} `{ data: { chat } }`.
 */
export const ecrireAuComplexe = async (reservationId) => corps(
  client.post(`/reservations-terrain/${enc(reservationId)}/conversation`, {}),
);

/**
 * E-P09 A — publier « Il me manque des joueurs » : combien, le niveau (facultatif), la case des
 * favoris (cochée par défaut, A-P10). Rien d'autre ne part (RC-T01).
 * @param {string} reservationId - documentId de la réservation.
 * @param {{ level?: string | null, notifyFavorites?: boolean, places: number }} annonce - Le choix.
 * @returns {Promise<any>} `{ data: { documentId, places, joined, level, notifyFavorites,
 *   status } }`
 *   (201) ; 409 `_ANNONCE_DEJA`.
 */
export const publierUneAnnonce = async (reservationId, annonce) => corps(
  client.post(`/reservations-terrain/${enc(reservationId)}/annonce`, {
    data: {
      ...(annonce?.level ? { level: annonce.level } : {}),
      notifyFavorites: annonce?.notifyFavorites !== false,
      places: Number(annonce?.places),
    },
  }),
);

/**
 * E-P09 B — la page d'une annonce (un compte) : la partie, les présents, l'âge minimum, `canJoin`.
 * @param {string} annonceId - documentId de l'annonce.
 * @returns {Promise<any>} `{ data: annonce }`.
 */
export const lireUneAnnonce = async (annonceId) => corps(
  client.get(`/annonces-reservation/${enc(annonceId)}`),
);

/**
 * E-P09 B — « Je viens » : il entre dans la partie (entrée « annonce »).
 * @param {string} annonceId - documentId de l'annonce.
 * @returns {Promise<any>} `{ data: groupe }` ; 409 `_COMPLETE`.
 */
export const rejoindreUneAnnonce = async (annonceId) => corps(
  client.post(`/annonces-reservation/${enc(annonceId)}/rejoindre`, {}),
);

/**
 * E-P09 B — « Fermer l'annonce » (le réserveur).
 * @param {string} annonceId - documentId de l'annonce.
 * @returns {Promise<any>} `{ data: annonce fermée }`.
 */
export const fermerUneAnnonce = async (annonceId) => corps(
  client.post(`/annonces-reservation/${enc(annonceId)}/fermer`, {}),
);

/**
 * E-P11 — mes complexes favoris (un complexe qui n'est plus actif garde son nom, `disponible`
 * faux).
 * @returns {Promise<any>} `{ data: { items: [{ complexe, origin, since }], total } }`.
 */
export const lireMesFavoris = async () => corps(client.get('/complexes-favoris/mine'));

/**
 * E-P02 — le cœur : mettre en favori (A-G06), ce qui fait entrer dans le canal (A-G08).
 * @param {string} slug - L'adresse publique du complexe.
 * @param {'bouton' | 'affiche'} [origin] - D'où vient le geste (le scan de l'affiche, A-G12).
 * @returns {Promise<any>} `{ data: { created, favori, complexe, origin, canal } }`.
 */
export const ajouterAuxFavoris = async (slug, origin = 'bouton') => corps(
  client.post('/complexes-favoris', {
    data: { complexe: String(slug || ''), origin: origin === 'affiche' ? 'affiche' : 'bouton' },
  }),
);

/**
 * E-P02 / E-P11 — retirer des favoris : le canal est GARDÉ (Q5, AT-11), sauf la case « Quitter
 * aussi le canal ».
 * @param {string} slug - L'adresse publique du complexe.
 * @param {{ quitterCanal?: boolean }} [options] - La case.
 * @returns {Promise<any>} `{ data: { favori: false, retire, canal } }`.
 */
export const retirerDesFavoris = async (slug, { quitterCanal = false } = {}) => corps(
  client.delete(
    `/complexes-favoris/${enc(slug)}`,
    quitterCanal ? { params: { quitterCanal: true } } : undefined,
  ),
);

/**
 * E-P02 — ce complexe et MOI : mon favori, ma fidélité (n sur x, ou null), mon canal (membre, le
 * NOMBRE de membres, jamais la liste).
 * @param {string} slug - L'adresse publique du complexe.
 * @returns {Promise<any>} `{ data: { canal, complexe, favori, fidelite } }`.
 */
export const lireMaRelationAuComplexe = async (slug) => corps(
  client.get(`/complexes-moi/${enc(slug)}`),
);

/**
 * E-P10 « MA FIDÉLITÉ » — une carte par complexe actif où j'ai joué, au programme actif.
 * @returns {Promise<any>} `{ data: { items: [{ complexe, count, threshold, reward, restant,
 *   disponible }] } }`.
 */
export const lireMaFidelite = async () => corps(client.get('/complexes-fidelite/mine'));

/**
 * E-P12 — quitter le canal d'un complexe (Q5) ; on y revient en remettant le complexe en favori.
 * @param {string} slug - L'adresse publique du complexe.
 * @returns {Promise<any>} Le corps de la réponse.
 */
export const quitterLeCanal = async (slug) => corps(
  client.post(`/complexes-canal/${enc(slug)}/quitter`, {}),
);

/**
 * E-P02 — « Signaler ce complexe » (N-09) : le motif de la liste fermée, un mot facultatif.
 * @param {{ complexe: string, details?: string | null,
 *   motif: 'inexistant' | 'informations-fausses' | 'comportement-abusif' | 'autre' }} signalement
 *   - Le slug, le motif, le mot.
 * @returns {Promise<any>} `{ data: { created, motif, message } }`.
 */
export const signalerUnComplexe = async ({ complexe, details = null, motif }) => {
  const mot = String(details || '').replace(/\s+/g, ' ').trim();
  return corps(client.post('/complexes-signalements', {
    data: { complexe: String(complexe || ''), ...(mot ? { details: mot } : {}), motif },
  }));
};

/**
 * E-P02 « Nos partenaires » (A-G25), sans compte.
 * @param {string} slug - L'adresse publique du complexe.
 * @returns {Promise<any>} `{ data: { items: [{ title, logo, link }] } }`.
 */
export const lireLesPartenaires = async (slug) => corps(
  client.get(`/public-complexes/${enc(slug)}/partenaires`),
);
