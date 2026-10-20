import { slotOccurrences } from './seasonSlotDisplay';

/**
 * 🌴 R17-QUAND-2 (REC17-007 Q3, planches P11-quand-v2-tel / -ordi, P11-quand-ou-ca-vit validées
 * par Adel le 19/10) — LES VACANCES SCOLAIRES DANS L'APP. La zone de la Ville et ses périodes
 * viennent du serveur (aperçu et planning : `holidays.periods`, calendrier officiel embarqué) ;
 * ici, seulement des fonctions pures qui les lisent : quelles séances d'une forme tombent pendant
 * les vacances, période par période (la liste décochable), et les mots.
 * Témoin : __tests__/seasonSlotHolidays.R17Q2.test.js.
 */

/**
 * @typedef {object} PeriodeDeVacances
 * @property {string} [description] - « Vacances de la Toussaint » (libellé officiel).
 * @property {string} key - « 2026-2027:toussaint ».
 * @property {string} name - « Toussaint ».
 * @property {string} start - Premier jour de vacances, AAAA-MM-JJ.
 * @property {string} end - Dernier jour de vacances (veille de la reprise), AAAA-MM-JJ.
 */

const dans = (/** @type {PeriodeDeVacances} */ periode, /** @type {string} */ jour) => (
  periode.start <= jour && jour <= periode.end
);

/**
 * Les séances qui tombent pendant les vacances, période par période. Une période gardée (décochée
 * par la Ville : un stage pendant les vacances) est listée mais ne retire rien.
 * @param {string[]} seances - Les séances de la forme (AAAA-MM-JJ).
 * @param {PeriodeDeVacances[] | null | undefined} periodes - Les périodes de la zone.
 * @param {string[]} gardees - Les clés des périodes gardées.
 * @returns {{ retirees: string[], parPeriode: Array<{ periode: PeriodeDeVacances,
 *   jours: string[], gardee: boolean }> }} Ce que « Sauf vacances scolaires » retire.
 */
export const vacancesDesSeances = (seances, periodes, gardees) => {
  const parPeriode = (Array.isArray(periodes) ? periodes : [])
    .map((periode) => ({
      gardee: gardees.includes(periode.key),
      jours: seances.filter((jour) => dans(periode, jour)),
      periode,
    }))
    .filter((ligne) => ligne.jours.length > 0);
  const retirees = parPeriode.filter((ligne) => !ligne.gardee).flatMap((ligne) => ligne.jours);
  return { parPeriode, retirees: [...new Set(retirees)].sort() };
};

/**
 * Un créneau « sauf vacances » déjà attribué : les périodes qu'il GARDE — celles où il aurait eu
 * lieu sans qu'aucun de ces jours ait été retiré (`holidayDates`). La règle du serveur
 * (`keptHolidaysOf`).
 * @param {any} creneau - Le créneau (serveur).
 * @param {PeriodeDeVacances[] | null | undefined} periodes - Les périodes de la zone.
 * @returns {string[]} Les clés gardées.
 */
export const periodesGardeesDuCreneau = (creneau, periodes) => {
  if (creneau?.exceptHolidays !== true) return [];
  const retires = new Set(Array.isArray(creneau.holidayDates) ? creneau.holidayDates : []);
  const jours = slotOccurrences({ ...creneau, exceptHolidays: false, holidayDates: [] });
  return (Array.isArray(periodes) ? periodes : [])
    .filter((periode) => {
      const dedans = jours.filter((jour) => dans(periode, jour));
      return dedans.length > 0 && dedans.every((jour) => !retires.has(jour));
    })
    .map((periode) => periode.key);
};

/**
 * Les périodes de vacances que la page du planning montre (planche P11-quand-ou-ca-vit, 5) : celles
 * qui croisent [du, au].
 * @param {any} vacances - `meta.holidays` du planning (serveur) : zone, nom, périodes.
 * @param {string} du - Premier jour montré, AAAA-MM-JJ.
 * @param {string} au - Dernier jour montré, AAAA-MM-JJ.
 * @returns {PeriodeDeVacances[]} Les périodes, dans l'ordre.
 */
export const vacancesDeLaPage = (vacances, du, au) => (
  (Array.isArray(vacances?.periods) ? vacances.periods : [])
    .filter((/** @type {PeriodeDeVacances} */ periode) => periode.start <= au && periode.end >= du)
);

const SAISONS = new Set(['Automne', 'Été', 'Hiver', 'Printemps']);

/**
 * Le nom d'une période dans une phrase : « Toussaint », « Noël », mais « hiver », « printemps ».
 * @param {string} nom - Le nom du calendrier officiel.
 * @returns {string} Le nom à écrire.
 */
export const nomDeVacances = (nom) => (SAISONS.has(nom) ? nom.toLocaleLowerCase('fr-FR') : nom);
