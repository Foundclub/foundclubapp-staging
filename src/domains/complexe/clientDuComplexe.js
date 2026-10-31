import { etatAffiche, STATUTS, versJourIso } from '@/domains/complexe/complexeReservation';
import { texteHeure } from '@/domains/complexe/complexeTerrain';
import localeDesFormats from '@/theme/strings/localeDesFormats';
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

// ── RESA-L5B-2 (20/10/2026) — la LISTE des clients et ce que la fiche attendait de RESA-L4 ──
// Serveur : `GET /complexes/:id/clients?onglet&recherche&page` (items[{ documentId, firstname,
// lastname, parties, noShows, fidelite{count, threshold} | null, banni, … }]) et
// `GET /complexes/:id/clients/:joueurId/historique` (`{ parties, reservations[] }`, 50 au plus, la
// plus récente d'abord). Témoin : `clientDuComplexe.L5B2.test.js`.

/** Les onglets de la liste, dans l'ordre de la planche EG15 (état 1). */
export const ONGLETS_CLIENTS = Object.freeze(['tous', 'habitues', 'bannis']);

/** L'historique d'un client : 50 réservations au plus (`HISTORIQUE_MAX` du serveur). */
export const HISTORIQUE_MAX = 50;

/** Les états d'une réservation qui tient encore un créneau à venir (« Écrire », AT-04). */
const ETATS_A_VENIR = Object.freeze([STATUTS.enAttente, STATUTS.confirmee, 'en_collecte']);

/**
 * La ligne d'un client (planche EG15 état 1) : « 12 parties · 1 non honorée · fidélité 8/10 » ; la
 * fidélité seulement quand le complexe a un programme (`fidelite` null sinon).
 * @param {Traduire} t - Traduction.
 * @param {{ fidelite?: { count?: number, threshold?: number } | null, noShows?: number,
 *   parties?: number }} client - Un client de la liste.
 * @returns {string} La ligne.
 */
export const resumeDuClient = (t, client) => {
  const parties = Number(client?.parties) || 0;
  const nonHonorees = Number(client?.noShows) || 0;
  const morceaux = [
    t('complexeClients.liste.parties', '{{count}} parties', {
      count: parties,
      defaultValue_one: '{{count}} partie',
      defaultValue_other: '{{count}} parties',
    }),
    t('complexeClients.liste.nonHonorees', '{{count}} non honorées', {
      count: nonHonorees,
      defaultValue_one: '{{count}} non honorée',
      defaultValue_other: '{{count}} non honorées',
    }),
  ];
  const seuil = Number(client?.fidelite?.threshold);
  if (client?.fidelite && Number.isInteger(seuil) && seuil > 0) {
    morceaux.push(t('complexeClients.liste.fidelite', 'fidélité {{compte}}/{{seuil}}', {
      compte: Number(client.fidelite.count) || 0,
      seuil,
      ...SANS_ECHAPPEMENT,
    }));
  }
  return morceaux.join(' · ');
};

/**
 * « Client depuis le 02/09 » (planche EG15 état 2) : le jour de sa plus ancienne réservation ICI,
 * SEULEMENT si l'historique est entier (moins de 50 lignes) — sinon la première peut être plus
 * ancienne que ce que le serveur rend, et la phrase mentirait.
 * @param {Array<{ startsAt?: string | null }>} reservations - L'historique, le plus récent d'abord.
 * @returns {string} « 02/09 », ou ''.
 */
export const clientDepuis = (reservations) => {
  const lignes = Array.isArray(reservations) ? reservations : [];
  if (!lignes.length || lignes.length >= HISTORIQUE_MAX) return '';
  return jourDe(lignes[lignes.length - 1]?.startsAt);
};

/**
 * CORR-RESA (75 A) — « Client depuis le … » : le jour où il a RÉSERVÉ sa première réservation
 * retenue ici (`clientDepuis` de la fiche, serveur), pas celui du créneau ; une demande refusée ne
 * compte pas. Un serveur d'avant (champ absent) : l'ancienne règle, sur l'historique.
 * @param {{ clientDepuis?: string | null } | null | undefined} client - La fiche du client.
 * @param {Array<{ startsAt?: string | null }>} reservations - L'historique, le plus récent d'abord.
 * @returns {string} « 05/10 », ou ''.
 */
export const clientDepuisLaFiche = (client, reservations) => (
  client && 'clientDepuis' in client ? jourDe(client.clientDepuis) : clientDepuis(reservations)
);

/**
 * La prochaine réservation à venir d'un client (« Écrire » : la conversation de CETTE réservation,
 * AT-04) : en attente, confirmée ou en collecte, pas encore commencée ; la plus proche.
 * @param {Array<{ documentId?: string, startsAt?: string | null, status?: string }>} reservations
 *   - L'historique.
 * @param {Date} [maintenant] - L'instant de référence.
 * @returns {any | null} La réservation, ou null.
 */
export const prochaineReservation = (reservations, maintenant = new Date()) => {
  const aVenir = (Array.isArray(reservations) ? reservations : [])
    .filter((ligne) => ETATS_A_VENIR.includes(String(ligne?.status || ''))
      && new Date(String(ligne?.startsAt || '')).getTime() > maintenant.getTime());
  aVenir.sort((a, b) => String(a.startsAt).localeCompare(String(b.startsAt)));
  return aVenir[0] || null;
};

/**
 * Une ligne de l'« Historique » (planche EG15 état 2) : « lun. 13/10 · 19 h · Terrain 1 » (le jour
 * et l'heure de PARIS) et l'état LU (`etatAffiche` : « Jouée », « Non honorée », sinon celui du
 * serveur).
 * @param {{ endsAt?: string | null, noShow?: boolean, startsAt?: string | null, status?: string,
 *   terrain?: { name?: string | null } | null }} reservation - Une ligne de l'historique.
 * @param {Date} [maintenant] - L'instant de référence.
 * @returns {{ etat: string, texte: string }} Le texte et l'état.
 */
export const ligneHistorique = (reservation, maintenant = new Date()) => {
  const instant = new Date(String(reservation?.startsAt || ''));
  let quand = '';
  if (!Number.isNaN(instant.getTime())) {
    const parts = getZonedDateParts(instant);
    const deux = (/** @type {number} */ nombre) => String(nombre).padStart(2, '0');
    const semaine = new Date(parts.year, parts.month - 1, parts.day, 12)
      .toLocaleDateString(localeDesFormats(), { weekday: 'short' });
    quand = `${semaine} ${deux(parts.day)}/${deux(parts.month)} · ${texteHeure(
      `${deux(parts.hour % 24)}:${deux(parts.minute)}`,
    )}`;
  }
  const terrain = String(reservation?.terrain?.name || '').trim();
  return {
    etat: etatAffiche(
      { ...reservation, noShowAt: reservation?.noShow ? 'marquee' : null },
      maintenant,
    ),
    texte: [quand, terrain].filter(Boolean).join(' · '),
  };
};
