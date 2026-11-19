import { getZonedDateParts } from '@/utils/parisTime';

// IMPL-2-EQUIPE (18/11/2026, planches 10c et 10d) — quitter l'équipe APRÈS avoir payé sa place :
// les conditions d'inscription (CGV § 5, Adel « 4- A ») remboursent en entier jusqu'au 5 décembre
// inclus, puis laissent céder la place jusqu'au 17/12, pour le tournoi du 19 décembre 2026.
// ponytail: les deux dates sont dérivées de la date du tournoi (J−14 et J−2), parce que l'app n'a
// qu'une page de conditions pour tous les tournois payants (domains/tournoi/conditionsTournoi.js) ;
// limite : un tournoi aux conditions différentes. Sortie : des dates lues dans `tournamentConfig`.
// Témoin : __tests__/tournamentWithdrawal.IMPL2.test.js.

const JOUR = 86400000;
export const JOURS_DE_REMBOURSEMENT = 14;
export const JOURS_DE_CESSION = 2;
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre',
  'octobre', 'novembre', 'décembre'];

/**
 * Le jour de Paris d'un instant, compté en jours depuis 1970.
 * @param {Date} instant - L'instant.
 * @returns {number} Le numéro du jour.
 */
const jourDeParis = (instant) => {
  const { day, month, year } = getZonedDateParts(instant, 'Europe/Paris');
  return Math.round(Date.UTC(year, month - 1, day) / JOUR);
};

/**
 * « 5 décembre » pour un numéro de jour.
 * @param {number} jour - Le numéro du jour.
 * @returns {string} Le jour et le mois.
 */
const enMots = (jour) => {
  const date = new Date(jour * JOUR);
  return `${date.getUTCDate()} ${MOIS[date.getUTCMonth()]}`;
};

/**
 * Où en est le joueur qui a payé et veut partir.
 * @param {object} params - Les paramètres.
 * @param {string | null | undefined} params.eventDate - La date du tournoi.
 * @param {Date} [params.now] - Maintenant (pour les témoins).
 * @returns {{ phase: 'unknown' } | { phase: 'refund' | 'cession' | 'after', refundDate: string,
 *   noRefundDate: string, cessionDate: string }} La fenêtre.
 */
export const getWithdrawalWindow = ({ eventDate, now = new Date() }) => {
  const debut = eventDate ? new Date(eventDate) : null;
  if (!debut || Number.isNaN(debut.getTime())) return { phase: 'unknown' };
  const tournoi = jourDeParis(debut);
  const dernierRembourse = tournoi - JOURS_DE_REMBOURSEMENT;
  const derniereCession = tournoi - JOURS_DE_CESSION;
  const aujourdhui = jourDeParis(now);
  /** @type {'refund' | 'cession' | 'after'} */
  let phase = 'after';
  if (aujourdhui <= dernierRembourse) phase = 'refund';
  else if (aujourdhui <= derniereCession) phase = 'cession';
  return {
    cessionDate: enMots(derniereCession),
    noRefundDate: enMots(dernierRembourse + 1),
    phase,
    refundDate: enMots(dernierRembourse),
  };
};
