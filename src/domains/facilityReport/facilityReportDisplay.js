import { format, parseISO } from 'date-fns';
import { enGB, fr } from 'date-fns/locale';

import localeDesFormats from '@/theme/strings/localeDesFormats';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';

import { isBirthdateUnderAge } from '@/constants/parentalDeclaration';

/**
 * « sam. 18 oct. » (P10-securite-ordi), dans la langue de l ecran.
 * @param {string | null | undefined} iso - Une date ou un instant ISO.
 * @returns {string} Le jour, ou une chaine vide.
 */
export const reportDayLabel = (iso) => {
  if (!iso) return '';
  try {
    return format(parseISO(String(iso)), 'EEE d MMM', {
      locale: localeDesFormats() === 'en-GB' ? enGB : fr,
    });
  } catch {
    return '';
  }
};

/**
 * « sam. 18 oct., 10:42 » (P10-securite-ordi B, P10-securite-tel 2) : le jour et l heure de
 * l envoi.
 * @param {string | null | undefined} iso - Un instant ISO.
 * @returns {string} Le jour et l heure, ou une chaine vide.
 */
export const reportMomentLabel = (iso) => {
  if (!iso) return '';
  try {
    return format(parseISO(String(iso)), 'EEE d MMM, HH:mm', {
      locale: localeDesFormats() === 'en-GB' ? enGB : fr,
    });
  } catch {
    return '';
  }
};

/**
 * R17-SIGNALER-1 (19/10, REC17-011) — ce que les ecrans lisent d un signalement d installation.
 * Regles pures : aucune lecture reseau. Le serveur reste le seul juge (droits, photo, statuts).
 */

// P10-signaler-tel, ecran 2 — l ordre des puces.
export const REPORT_CATEGORIES = [
  'securite',
  'equipement',
  'eclairage',
  'proprete',
  'acces',
  'autre',
];
export const OPEN_STATUSES = ['envoye', 'pris_en_charge'];
// Q7 B (registre des mineurs, ligne 33) : la photo a partir de 15 ans. Age inconnu : pas de photo.
export const REPORT_PHOTO_MIN_AGE = 15;
export const REPORT_PHOTO_MAX_BYTES = 15 * 1024 * 1024;

/**
 * Le signalement est-il encore ouvert (Envoyé, Pris en charge) ?
 * @param {any} report - Le signalement.
 * @returns {boolean} Vrai s il est ouvert.
 */
export const isOpenReport = (report) => OPEN_STATUSES.includes(report?.status);

/**
 * La photo est-elle proposee a ce compte ? Le serveur refuse de toute facon sous 15 ans.
 * @param {unknown} birthdate - La date de naissance du compte.
 * @returns {boolean} Vrai a partir de 15 ans ; faux si la date est inconnue.
 */
export const canAttachReportPhoto = (birthdate) => (
  Boolean(birthdate) && !isBirthdateUnderAge(birthdate, REPORT_PHOTO_MIN_AGE)
);

/**
 * La couleur d une pastille de statut (P10-securite-ordi) : Nouveau orange, Pris en charge cyan,
 * Resolu vert, Sans suite neutre.
 * @param {string | null | undefined} status - Le statut.
 * @returns {'warning' | 'primary' | 'success' | 'neutral'} Le ton.
 */
export const reportStatusTone = (status) => {
  if (status === 'envoye') return 'warning';
  if (status === 'pris_en_charge') return 'primary';
  if (status === 'resolu') return 'success';
  return 'neutral';
};

/**
 * Les trois etapes « Envoyé · Pris en charge · Résolu » : combien sont faites.
 * @param {string | null | undefined} status - Le statut.
 * @returns {number} 1, 2 ou 3.
 */
export const reportStepCount = (status) => {
  if (status === 'pris_en_charge') return 2;
  if (status === 'resolu' || status === 'sans_suite') return 3;
  return 1;
};

/**
 * Q2 A — l auteur tel que la Ville le lit : « Lucas Morel, entraîneur · AS Montrivage » pour un
 * encadrant, « un joueur · AS Montrivage » sinon (le serveur ne rend le nom que d un encadrant).
 * @param {any} t - La fonction de traduction (i18next).
 * @param {any} report - Le signalement (lecture de la Ville).
 * @returns {string} La ligne.
 */
export const reportAuthorLabel = (t, report) => {
  const roleKey = report?.author?.role || 'membre';
  const role = t(`facilityReports.roles.${roleKey}`);
  const club = report?.club?.name || '';
  const name = report?.author?.name || null;
  return name
    ? t('facilityReports.auteurNomme', {
      ...SANS_ECHAPPEMENT, club, name, role,
    })
    : t('facilityReports.auteurAnonyme', { ...SANS_ECHAPPEMENT, club, role });
};

/**
 * Les signalements ouverts d abord la securite, puis du plus recent au plus ancien ; les traites
 * a part (l historique).
 * @param {any[]} reports - Les signalements.
 * @returns {{ ouverts: any[], traites: any[] }} Les deux listes.
 */
export const splitReports = (reports) => {
  const liste = Array.isArray(reports) ? reports : [];
  const recents = (/** @type {any} */ a, /** @type {any} */ b) => String(b?.createdAt || '')
    .localeCompare(String(a?.createdAt || ''));
  const ouverts = liste.filter(isOpenReport).sort((/** @type {any} */ a, /** @type {any} */ b) => {
    const securite = Number(b?.category === 'securite') - Number(a?.category === 'securite');
    return securite || recents(a, b);
  });
  return { ouverts, traites: liste.filter((report) => !isOpenReport(report)).sort(recents) };
};

/**
 * L historique de l onglet : les signalements clos et les fermetures, du plus recent au plus
 * ancien.
 * @param {any[]} traites - Les signalements clos.
 * @param {any[]} closures - Les fermetures (meta.closures).
 * @returns {Array<{ date: string, kind: 'report' | 'closure', item: any }>} Les jalons.
 */
export const securityHistory = (traites, closures) => [
  ...(Array.isArray(traites) ? traites : []).map((item) => ({
    date: String(item?.closedAt || item?.createdAt || ''),
    item,
    kind: /** @type {'report'} */ ('report'),
  })),
  ...(Array.isArray(closures) ? closures : [])
    .filter((item) => item?.kind === 'closure')
    .map((item) => ({
      date: String(item?.startDate || ''),
      item,
      kind: /** @type {'closure'} */ ('closure'),
    })),
].sort((a, b) => b.date.localeCompare(a.date));

/**
 * Q4 A, etape 4 de l exemple — la fermeture liee est finie (rouverte, ou passee) et le signalement
 * est encore « Pris en charge » : on propose a la Ville de le marquer « Résolu ».
 * @param {any} report - Le signalement.
 * @param {string} today - AAAA-MM-JJ.
 * @returns {boolean} Vrai s il faut le proposer.
 */
export const shouldProposeResolved = (report, today) => Boolean(
  report?.status === 'pris_en_charge'
      && report?.closure
      && (report.closure.status === 'reopened'
        || String(report.closure.endDate || '') < String(today || '')),
);

/**
 * Les parametres du formulaire de fermeture (COL-008) pre-rempli depuis un signalement (Q4 A) :
 * l installation, le motif, le mot aux clubs, a partir d aujourd hui. Scalaires : l adresse du site
 * les porte.
 * @param {any} report - Le signalement (lecture de la Ville).
 * @param {any} prefill - `meta.closurePrefill` rendu par le serveur.
 * @param {string | null} collectiviteId - La Ville.
 * @returns {Record<string, string>} Les parametres de `CollectiviteFermeture`.
 */
export const closureParamsFromReport = (report, prefill, collectiviteId) => {
  /** @type {Record<string, string>} */
  const params = {
    date: String(prefill?.startDate || ''),
    facilityId: String(report?.facility?.documentId || ''),
    message: String(prefill?.message || ''),
    mode: 'fermer',
    motif: String(prefill?.reason || 'travaux'),
    reportId: String(report?.documentId || ''),
  };
  if (report?.facility?.name) params.facilityName = String(report.facility.name);
  if (collectiviteId) params.collectiviteId = String(collectiviteId);
  return Object.fromEntries(Object.entries(params).filter(([, value]) => value));
};
