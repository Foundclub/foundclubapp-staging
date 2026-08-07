import { format as formatDate, isValid, parse } from 'date-fns';
import { fr } from 'date-fns/locale';

/**
 * Les dates des matchs amicaux, dites en francais.
 *
 * Un seul fichier pour les 5 ecrans du lot (assistant, detail, feuille de
 * candidature, carte de proposition) : la meme date affichee « mar. 12 mai »
 * ici et « 12/05 » la-bas donne l impression de deux dates differentes.
 */

/** Le format que produit et attend DatePickerInput. */
export const PICKER_DATE_FORMAT = 'dd/MM/yyyy';

/** Le format du champ `date` d un creneau candidat, cote serveur. */
const ISO_DAY_FORMAT = 'yyyy-MM-dd';

/**
 * « 12/05/2099 » -> « 2099-05-12 ». Une saisie illisible rend '' : c est
 * l appelant qui refuse, pas un ecran qui plante.
 * @param {any} pickerValue
 * @returns {string}
 */
export const toIsoDay = (pickerValue) => {
  const parsed = parse(String(pickerValue || ''), PICKER_DATE_FORMAT, new Date());
  return isValid(parsed) ? formatDate(parsed, ISO_DAY_FORMAT) : '';
};

/**
 * Le chemin inverse : « 2099-05-12 » -> « 12/05/2099 ». Il sert a REMETTRE un
 * creneau deja pose dans le formulaire de saisie, pour le corriger. Ecrire la
 * conversion a l envers ailleurs qu ici la ferait diverger de `toIsoDay` au
 * premier changement de format.
 * @param {any} isoDay
 * @returns {string}
 */
export const toPickerDay = (isoDay) => {
  const parsed = parse(String(isoDay || '').slice(0, 10), ISO_DAY_FORMAT, new Date());
  return isValid(parsed) ? formatDate(parsed, PICKER_DATE_FORMAT) : '';
};

/**
 * « 2099-05-12 » -> « mardi 12 mai ». Une valeur ISO complete (avec heure) est
 * coupee au jour. Une valeur illisible est rendue telle quelle plutot que vide :
 * afficher la donnee brute vaut mieux qu afficher un trou.
 * @param {any} value
 * @returns {string}
 */
export const toReadableDay = (value) => {
  const parsed = parse(String(value || '').slice(0, 10), ISO_DAY_FORMAT, new Date());
  return isValid(parsed) ? formatDate(parsed, 'EEEE d MMMM', { locale: fr }) : String(value || '');
};

/**
 * « 2099-05-12 » -> « mar. 12 mai », pour les listes serrees.
 * @param {any} value
 * @returns {string}
 */
export const toShortDay = (value) => {
  const parsed = parse(String(value || '').slice(0, 10), ISO_DAY_FORMAT, new Date());
  return isValid(parsed) ? formatDate(parsed, 'EEE d MMM', { locale: fr }) : String(value || '');
};

/**
 * L horaire d un creneau, en clair. Le creneau est facultatif (§4.1) : sans
 * heure, on dit « a convenir » plutot que de laisser une ligne vide, parce que
 * c est une information — l heure se decide dans le fil (§4.4).
 * @param {any} slot
 * @returns {string}
 */
export const getSlotHoursLabel = (slot) => {
  if (slot?.start && slot?.end) return `de ${slot.start} à ${slot.end}`;
  if (slot?.start) return `à partir de ${slot.start}`;
  return 'horaire à convenir';
};

/**
 * Le jour et l heure convenus, en un instant que le serveur pose tel quel dans
 * la date de l evenement (`agreedTerms.date` -> `event.date`,
 * friendly-match-workflow.ts:148).
 *
 * L heure est lue dans le fuseau de celui qui la saisit — « 18:00 le 12 mai »
 * veut dire 18 h chez lui, pas 18 h UTC. Sans heure, on prend midi plutot que
 * minuit : minuit bascule de jour au moindre decalage, et le match se
 * retrouverait affiche la veille.
 * @param {any} isoDay - Jour au format AAAA-MM-JJ.
 * @param {any} [time] - Heure au format HH:MM.
 * @returns {string} L instant en ISO, ou '' si le jour est illisible.
 */
export const toAgreedInstant = (isoDay, time) => {
  const day = String(isoDay || '').slice(0, 10);
  const hours = /^([01]\d|2[0-3]):[0-5]\d$/.test(String(time || '')) ? String(time) : '12:00';
  const parsed = parse(`${day} ${hours}`, `${ISO_DAY_FORMAT} HH:mm`, new Date());
  return isValid(parsed) ? parsed.toISOString() : '';
};

/**
 * Un creneau entier : le jour, puis son horaire s il en a un.
 * @param {any} slot
 * @returns {string}
 */
export const getSlotLabel = (slot) => {
  const day = toReadableDay(slot?.date);
  if (!slot?.start) return day;
  return `${day} — ${getSlotHoursLabel(slot)}`;
};
