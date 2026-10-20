import { versJourIso } from '@/domains/complexe/complexeReservation';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';

import { getZonedDateParts } from '@/utils/parisTime';

/**
 * LA FICHE D'UN CLIENT DU COMPLEXE — RESA-L5B-1 (20/10/2026), chantier Réservation.
 *
 * Les règles PURES de E-G15 (planche EG15 états 2 à 5 ; plan :970-1010 ; RG-BAN) sur le serveur
 * RESA-L2B : `GET /complexes/:id/clients/:joueurId` rend `{ documentId, firstname, lastname,
 * noShows, lateCancellations, upcoming, ban: { documentId, origin, reason, since, until } | null }`
 * (jamais un numéro) ; `POST /complexes/:id/bannis` ne lit QUE `{ joueur, reason, until?,
 * cancelUpcoming? }` (raison privée, 200 caractères au plus, fin = un jour inclus).
 * ⚠️ La raison d'un bannissement est PRIVÉE : elle ne s'affiche qu'au gérant. Le joueur banni ne
 * lit que « Tu ne peux plus réserver dans ce complexe. » (RC-P08, E-P13).
 *
 * Témoin : `clientDuComplexe.test.js`.
 */

/** @typedef {any} Traduire - La traduction (le TFunction d'i18next). */

/** La raison d'un bannissement : 200 caractères au plus (`BAN_REASON_MAX` du serveur). */
export const BAN_RAISON_MAX = 200;

/**
 * « 14/10 », le jour de PARIS d'un instant (le serveur pense en heure de Paris).
 * @param {unknown} iso - L'instant.
 * @returns {string} Le jour, ou ''.
 */
const jourDe = (iso) => {
  const instant = new Date(String(iso || ''));
  if (!iso || Number.isNaN(instant.getTime())) return '';
  const parts = getZonedDateParts(instant);
  return `${String(parts.day).padStart(2, '0')}/${String(parts.month).padStart(2, '0')}`;
};

/**
 * Le bloc « Bannissement » en une phrase (planche EG15 états 2 et 4) : « Non banni » ; « Banni
 * depuis le 14/10 · automatique : 3 réservations non honorées » ; « Banni jusqu'au 30/11 · raison
 * privée : … » (la fin est le DERNIER jour banni, inclus) ; sans fin, « Banni depuis le … ».
 * @param {Traduire} t - Traduction.
 * @param {{ origin?: string, reason?: string | null, since?: string | null,
 *   until?: string | null } | null | undefined} ban - Le bannissement actif, ou rien.
 * @returns {string} La phrase.
 */
export const etatDuBan = (t, ban) => {
  if (!ban) return t('complexeClients.ban.aucun', 'Non banni');
  const raison = String(ban.reason || '').trim();
  const depuis = jourDe(ban.since);
  if (ban.origin === 'automatique') {
    return t(
      'complexeClients.ban.automatique',
      'Banni depuis le {{depuis}} · automatique : {{raison}}',
      { depuis, raison, ...SANS_ECHAPPEMENT },
    );
  }
  const until = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ban.until || ''));
  if (until) {
    return t(
      'complexeClients.ban.jusqua',
      'Banni jusqu’au {{jusqua}} · raison privée : {{raison}}',
      { jusqua: `${until[3]}/${until[2]}`, raison, ...SANS_ECHAPPEMENT },
    );
  }
  return t(
    'complexeClients.ban.depuis',
    'Banni depuis le {{depuis}} · raison privée : {{raison}}',
    { depuis, raison, ...SANS_ECHAPPEMENT },
  );
};

/**
 * Le corps de « Bannir » : la liste blanche du serveur, rien d'autre (RC-T01). La raison nettoyée
 * et coupée à 200 caractères ; « Jusqu'au » (JJ/MM/AAAA) en AAAA-MM-JJ, seulement s'il est
 * lisible ; la case « Annuler aussi ses réservations à venir » seulement cochée.
 * @param {{ annulerAVenir?: boolean, joueur: string, jusqua?: string, raison: string }} saisie - La
 *   feuille.
 * @returns {{ cancelUpcoming?: boolean, joueur: string, reason: string, until?: string }} Le corps.
 */
export const corpsDuBan = ({
  annulerAVenir = false, joueur, jusqua = '', raison,
}) => {
  const jour = versJourIso(jusqua);
  return {
    ...(annulerAVenir ? { cancelUpcoming: true } : {}),
    joueur,
    reason: String(raison || '').replace(/\s+/g, ' ').trim().slice(0, BAN_RAISON_MAX),
    ...(jour ? { until: jour } : {}),
  };
};

/**
 * « Julien Marchal » (D7 : le nom, jamais un numéro).
 * @param {{ firstname?: string | null, lastname?: string | null } | null | undefined} personne - Le
 *   client.
 * @returns {string} Le nom, ou ''.
 */
export const nomComplet = (personne) => [personne?.firstname, personne?.lastname]
  .map((morceau) => String(morceau || '').trim())
  .filter(Boolean)
  .join(' ');
