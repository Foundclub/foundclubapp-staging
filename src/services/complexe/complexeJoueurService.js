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
