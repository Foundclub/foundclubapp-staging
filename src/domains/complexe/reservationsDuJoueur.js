import { ajouterJours, jourDeParis } from '@/domains/complexe/reserverTerrain';

import { COMPLEXES_JOUEUR } from '@/config/fonctionsMasquees';

/**
 * LE JOUEUR ET SES RÉSERVATIONS — RESA-L6B-1 (19/10/2026), chantier Réservation : la confirmation
 * la veille (E-P14) et « Mes réservations » (E-P10). Plan
 * `docs/PLAN_ECRANS_RESERVATION_2026-10-13.md` E-P14 et E-P10 ; planches EP14 et EP10 (toile
 * BLG79NHv2). Le serveur (RESA-L2B, `toPlayerView`) est le seul juge : `canAnswerDayBefore` dit si
 * la question attend une réponse.
 * Témoin : `reservationsDuJoueur.test.js`.
 */

/**
 * L'interrupteur `COMPLEXES_JOUEUR`, lu À L'APPEL (une liaison vivante : les témoins le
 * basculent ; même motif que `notificationsDuComplexe.js`). Les boutons de N-20 (`rsvpActions.js`)
 * le lisent ici.
 * @returns {boolean} Vrai si le côté joueur des complexes est allumé.
 */
export const joueurDesComplexesAllume = () => Boolean(COMPLEXES_JOUEUR);

/**
 * @typedef {{ canAnswerDayBefore?: boolean, cancellableUntil?: string | null,
 *   cancelledBy?: string | null, date?: string, dayBeforeConfirmedAt?: string | null,
 *   startsAt?: string | null, status?: string | null }} ReservationDuJoueur
 */

/**
 * L'état de E-P14 : à répondre, déjà confirmée, déjà annulée (par toi), annulée par le complexe
 * entre-temps, trop tard (le créneau a commencé), ou rien à demander (aucune question posée, une
 * demande en attente, une refusée…) — l'écran laisse alors place à la fiche (E-P07).
 * @param {ReservationDuJoueur | null | undefined} reservation - La réservation.
 * @param {Date} [maintenant] - L'instant de référence.
 * @returns {'aRepondre' | 'dejaConfirmee' | 'dejaAnnulee' | 'annuleeParLeComplexe' | 'tropTard'
 *   | 'rienADemander'} L'état.
 */
export const etatDeLaVeille = (reservation, maintenant = new Date()) => {
  if (reservation?.status === 'annulee') {
    return reservation.cancelledBy === 'reserveur' ? 'dejaAnnulee' : 'annuleeParLeComplexe';
  }
  if (reservation?.status !== 'confirmee') return 'rienADemander';
  const debut = new Date(String(reservation.startsAt || '')).getTime();
  if (Number.isFinite(debut) && debut <= maintenant.getTime()) return 'tropTard';
  if (reservation.dayBeforeConfirmedAt) return 'dejaConfirmee';
  return reservation.canAnswerDayBefore ? 'aRepondre' : 'rienADemander';
};

/**
 * AT-07 : « J'annule » après le délai d'annulation FIGÉ est accepté, marqué « hors délai ».
 * @param {ReservationDuJoueur | null | undefined} reservation - La réservation.
 * @param {Date} [maintenant] - L'instant de référence.
 * @returns {boolean} Vrai si le délai est passé.
 */
export const annulationHorsDelai = (reservation, maintenant = new Date()) => {
  const jusquA = new Date(String(reservation?.cancellableUntil || '')).getTime();
  return Number.isFinite(jusquA) && jusquA < maintenant.getTime();
};

/**
 * Une date civile est-elle demain, au jour de Paris ?
 * @param {string | null | undefined} date - « AAAA-MM-JJ ».
 * @param {Date} [maintenant] - L'instant de référence.
 * @returns {boolean} Vrai si c'est demain.
 */
export const estDemain = (date, maintenant = new Date()) => (
  Boolean(date) && date === ajouterJours(jourDeParis(maintenant), 1)
);

/**
 * Les onglets de E-P10 dans ce lot, dans l'ordre de la planche. « En collecte » et « Ma fidélité »
 * attendent les serveurs L3 et L4 (lot app RESA-L6B-2) : pas d'onglet vide ni de bloc factice.
 * @type {ReadonlyArray<'a-venir' | 'passees' | 'refusees'>}
 */
export const PERIODES_DE_MES_RESERVATIONS = Object.freeze(['a-venir', 'passees', 'refusees']);

/**
 * RESA-L6B-2 (20/10/2026, serveur RESA-L3) — les onglets de E-P10, dans l'ordre de la planche :
 * « En collecte » s'ajoute ; il se lit dans la période « à venir » du serveur (qui y range les
 * collectes), « À venir » gardant les confirmées et les demandes.
 * @type {ReadonlyArray<'a-venir' | 'en-collecte' | 'passees' | 'refusees'>}
 */
export const ONGLETS_DE_MES_RESERVATIONS = Object.freeze([
  'a-venir', 'en-collecte', 'passees', 'refusees',
]);

/**
 * La période du serveur (`GET /reservations-terrain/mine?periode=`) que lit un onglet.
 * @param {string} onglet - L'onglet.
 * @returns {'a-venir' | 'passees' | 'refusees'} La période.
 */
export const periodeDeLOnglet = (onglet) => (
  /** @type {'a-venir' | 'passees' | 'refusees'} */ (onglet === 'en-collecte' ? 'a-venir' : onglet)
);

/**
 * Les réservations d'un onglet : « En collecte » ne garde que les collectes, « À venir » tout le
 * reste ; les autres onglets, tout ce que le serveur rend.
 * @template {{ status?: string | null }} R
 * @param {string} onglet - L'onglet.
 * @param {R[] | null | undefined} reservations - Celles de la période.
 * @returns {R[]} Celles de l'onglet.
 */
export const reservationsDeLOnglet = (onglet, reservations) => {
  const toutes = Array.isArray(reservations) ? reservations : [];
  if (onglet === 'en-collecte') return toutes.filter((r) => r?.status === 'en_collecte');
  if (onglet === 'a-venir') return toutes.filter((r) => r?.status !== 'en_collecte');
  return toutes;
};

/**
 * E-P10 : la liste groupée par jour, dans l'ordre où le serveur la rend.
 * @template {{ date?: string }} R
 * @param {R[] | null | undefined} reservations - Les réservations.
 * @returns {Array<{ date: string, reservations: R[] }>} Un groupe par jour.
 */
export const joursDeMesReservations = (reservations) => {
  /** @type {Array<{ date: string, reservations: R[] }>} */
  const jours = [];
  (Array.isArray(reservations) ? reservations : []).forEach((reservation) => {
    const date = String(reservation?.date || '');
    const dernier = jours[jours.length - 1];
    if (dernier && dernier.date === date) dernier.reservations.push(reservation);
    else jours.push({ date, reservations: [reservation] });
  });
  return jours;
};
