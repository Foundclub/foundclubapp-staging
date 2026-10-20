import {
  addDays, addYears, differenceInCalendarDays, format, isValid, parse, parseISO,
} from 'date-fns';
import { enGB, fr } from 'date-fns/locale';

import localeDesFormats from '@/theme/strings/localeDesFormats';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';

/**
 * R17-CONTROLES (20/10, REC17-011 lot 2, decision d Adel Q6 B) — ce que les ecrans lisent du CARNET
 * DES CONTROLES d une installation (planches validees P11-q6-exemple-tel, P10-securite-ordi A,
 * P10-securite-tel 1, P11-securite-ou-ca-vit). Regles pures : aucune lecture reseau. Le serveur est
 * le seul juge (qui lit, l etat, le rappel) ; l app le dit en mots et propose le prochain controle.
 */

const ISO = 'yyyy-MM-dd';
const SAISIE = 'dd/MM/yyyy';
// Sous 30 jours (la fenetre du rappel), la pastille dit la date : « Avant le 12/03 ».
const JOURS_DE_LA_DATE = 30;

const locale = () => (localeDesFormats() === 'en-GB' ? enGB : fr);
const jour = (/** @type {string} */ iso) => parseISO(String(iso));

/**
 * La saisie « 12/03/2026 » (DatePickerInput) en « 2026-03-12 », ou null si elle n est pas une date.
 * @param {string | null | undefined} saisie - jj/mm/aaaa.
 * @returns {string | null} AAAA-MM-JJ.
 */
export const isoFromPicker = (saisie) => {
  const texte = String(saisie || '').trim();
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(texte)) return null;
  const date = parse(texte, SAISIE, new Date(2000, 0, 1));
  return isValid(date) && format(date, SAISIE) === texte ? format(date, ISO) : null;
};

/**
 * « 2026-03-12 » en « 12/03/2026 » (la valeur du DatePickerInput).
 * @param {string | null | undefined} iso - AAAA-MM-JJ.
 * @returns {string} jj/mm/aaaa, ou vide.
 */
export const pickerFromIso = (iso) => (iso ? format(jour(iso), SAISIE) : '');

/**
 * « 12 mars 2027 » (« À refaire avant le 12 mars 2027 », planche Q6 ecran 4).
 * @param {string} iso - AAAA-MM-JJ.
 * @returns {string} Le jour en toutes lettres.
 */
export const checkLongDate = (iso) => format(jour(iso), 'd MMMM yyyy', { locale: locale() });

/**
 * « 12 mars » (accueil de la Ville : « Contrôle à refaire avant le 12 mars », planche
 * P11-securite-ou-ca-vit porte 1).
 * @param {string} iso - AAAA-MM-JJ.
 * @returns {string} Le jour et le mois.
 */
export const checkDayMonth = (iso) => format(jour(iso), 'd MMMM', { locale: locale() });

/**
 * « 15 janv. 2027 » (« Prochain : 15 janv. 2027 », planches P10-securite-ordi A et tel 1).
 * @param {string} iso - AAAA-MM-JJ.
 * @returns {string} Le jour abrege.
 */
export const checkShortDate = (iso) => format(jour(iso), 'd MMM yyyy', { locale: locale() });

/**
 * Le carnet : les lignes EN COURS (une par serie), la plus urgente d abord.
 * @param {any[]} rows - Les lignes du carnet (lecture de la Ville).
 * @returns {any[]} Les lignes en cours.
 */
export const currentChecks = (rows) => (Array.isArray(rows) ? rows : [])
  .filter((row) => row?.current)
  .sort((a, b) => String(a.nextDue).localeCompare(String(b.nextDue)));

/**
 * L historique d une serie (« Noter le contrôle fait » ajoute une ligne) : la plus recente d abord.
 * @param {any[]} rows - Les lignes du carnet.
 * @param {string | null | undefined} series - La serie.
 * @returns {any[]} Ses lignes.
 */
export const seriesRows = (rows, series) => (Array.isArray(rows) ? rows : [])
  .filter((row) => series && row?.series === series)
  .sort((a, b) => String(b.doneOn).localeCompare(String(a.doneOn)));

/**
 * La pastille d un controle (P10-securite-ordi A, tel 1, P11-securite-ou-ca-vit) : « À jour »
 * (vert), « En retard » (rouge), et « bientôt » (orange) dit « Avant le 12/03 » sous 30 jours,
 * « Dans 3 mois » au-dela.
 * @param {any} t - La fonction de traduction (i18next).
 * @param {{ nextDue: string, state: string }} check - La ligne en cours.
 * @param {string} today - AAAA-MM-JJ (le jour du serveur).
 * @returns {{ label: string, tone: 'success' | 'warning' | 'error' }} La pastille.
 */
export const checkPill = (t, check, today) => {
  if (check?.state === 'en_retard') {
    return { label: t('facilityReports.controles.etat.en_retard', 'En retard'), tone: 'error' };
  }
  if (check?.state !== 'bientot') {
    return { label: t('facilityReports.controles.etat.a_jour', 'À jour'), tone: 'success' };
  }
  const jours = differenceInCalendarDays(jour(check.nextDue), jour(today));
  if (jours <= JOURS_DE_LA_DATE) {
    return {
      label: t('facilityReports.controles.avantLe', {
        ...SANS_ECHAPPEMENT,
        date: format(jour(check.nextDue), 'dd/MM'),
      }),
      tone: 'warning',
    };
  }
  return {
    label: t('facilityReports.controles.dansMois', { count: Math.max(1, Math.round(jours / 30)) }),
    tone: 'warning',
  };
};

/**
 * Le prochain controle propose (planche Q6 ecran 1 : « Proposé : un an après. Modifiable. ») ;
 * refait (« Noter le contrôle fait »), le meme ecart que la fois precedente.
 * @param {string} doneOn - AAAA-MM-JJ.
 * @param {{ doneOn: string, nextDue: string } | null} [previous] - La ligne precedente.
 * @returns {string} AAAA-MM-JJ, ou vide.
 */
export const proposedNextDue = (doneOn, previous = null) => {
  if (!doneOn) return '';
  const fait = jour(doneOn);
  if (previous?.doneOn && previous?.nextDue) {
    const ecart = differenceInCalendarDays(jour(previous.nextDue), jour(previous.doneOn));
    if (ecart > 0) return format(addDays(fait, ecart), ISO);
  }
  return format(addYears(fait, 1), ISO);
};
