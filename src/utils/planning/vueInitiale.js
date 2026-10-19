import {
  addDays,
  endOfDay,
  endOfMonth,
  endOfWeek,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';

import { toPlanningApiDate } from '@/utils/planning/planningSlots';

/**
 * 🗓️ R17-VUE (19/10/2026, REC17-010) — LA VUE A L ARRIVEE SUR UN PLANNING, ecrite UNE fois pour
 * les 5 plannings (perso, plein ecran, club, omnisport, installation de la Ville).
 *
 * La regle d Adel : le jour (ou la vue de base plus courte que la semaine : « 3 jours » de
 * l onglet perso) est vide ⇒ la semaine ; la semaine est vide mais un evenement vient plus tard
 * ⇒ le MOIS de ce prochain evenement ; sinon la vue de base (et son etat vide).
 * Les valeurs des vues sont celles des plannings : 'day', '3days', 'week', 'month', 'list'.
 */

/**
 * La lecture « prochain evenement » ne va pas plus loin (le serveur d une installation refuse
 * plus de 31 jours : `FACILITY_PLANNING_MAX_DAYS`, admin `planning-slot.ts`).
 */
export const JOURS_DE_LA_SUITE = 31;

/**
 * La vue de base est-elle plus courte que la semaine ? (Elle compte alors comme « jour ».)
 * @param {string} vue - La vue.
 * @returns {boolean} Vrai pour le jour et les 3 jours.
 */
const estCourte = (vue) => vue === 'day' || vue === '3days';

/**
 * Les jours que la vue de base montre a l arrivee (le premier et le dernier, inclus).
 * « 3 jours » : aujourd hui et les deux suivants (`getPlanningRange`) ; « liste » : la semaine.
 * @param {string} vue - La vue de base.
 * @param {Date} aujourdhui - Aujourd hui.
 * @returns {[Date, Date]} Debut et fin.
 */
const fenetreDeLaVue = (vue, aujourdhui) => {
  if (vue === 'day') return [startOfDay(aujourdhui), endOfDay(aujourdhui)];
  if (vue === '3days') return [startOfDay(aujourdhui), endOfDay(addDays(aujourdhui, 2))];
  if (vue === 'month') return [startOfMonth(aujourdhui), endOfMonth(aujourdhui)];
  return [
    startOfWeek(aujourdhui, { weekStartsOn: 1 }),
    endOfWeek(aujourdhui, { weekStartsOn: 1 }),
  ];
};

/**
 * Apres quel instant un evenement est-il « plus tard » ? La fin de la semaine, ou celle de la
 * vue de base si elle va plus loin (« 3 jours » un samedi, le mois).
 * @param {string} vue - La vue de base.
 * @param {Date} aujourdhui - Aujourd hui.
 * @returns {Date} La limite.
 */
const finDuPresent = (vue, aujourdhui) => {
  const finDeLaSemaine = fenetreDeLaVue('week', aujourdhui)[1];
  const finDeLaBase = fenetreDeLaVue(vue, aujourdhui)[1];
  return finDeLaBase > finDeLaSemaine ? finDeLaBase : finDeLaSemaine;
};

/**
 * La periode de la lecture « prochain evenement » : du lendemain de `finDuPresent`, 31 jours.
 * @param {string} vueDeBase - La vue de base.
 * @param {Date} aujourdhui - Aujourd hui.
 * @returns {{ from: string, to: string }} AAAA-MM-JJ.
 */
export const plageDeLaSuite = (vueDeBase, aujourdhui) => {
  const debut = addDays(startOfDay(finDuPresent(vueDeBase, aujourdhui)), 1);
  return {
    from: toPlanningApiDate(debut),
    to: toPlanningApiDate(addDays(debut, JOURS_DE_LA_SUITE - 1)),
  };
};

/**
 * La vue a l arrivee, et le jour qu elle montre.
 * @param {{
 *   aujourdhui: Date,
 *   dates: Array<Date | null>,
 *   prochain?: Date | null,
 *   vueDeBase: string,
 * }} entree - `dates` : les jours des evenements DEJA lus (ceux de la vue de base, et la semaine
 *   ou la suite quand elles sont connues) ; `prochain` : un evenement trouve a part.
 * @returns {{ date: Date, vue: string }} La vue ; `date` : aujourd hui, ou le prochain evenement
 *   (le mois qui le contient).
 */
export const vueInitiale = ({
  aujourdhui, dates, prochain = null, vueDeBase,
}) => {
  const jours = /** @type {Date[]} */ ([...dates, prochain].filter(Boolean));
  const dans = (/** @type {[Date, Date]} */ [debut, fin]) => jours
    .some((jour) => jour >= debut && jour <= fin);

  if (dans(fenetreDeLaVue(vueDeBase, aujourdhui))) return { date: aujourdhui, vue: vueDeBase };
  if (estCourte(vueDeBase) && dans(fenetreDeLaVue('week', aujourdhui))) {
    return { date: aujourdhui, vue: 'week' };
  }

  const limite = finDuPresent(vueDeBase, aujourdhui);
  const plusTard = jours
    .filter((jour) => jour > limite)
    .sort((gauche, droite) => gauche.getTime() - droite.getTime());
  if (plusTard.length) return { date: startOfDay(plusTard[0]), vue: 'month' };

  return { date: aujourdhui, vue: vueDeBase };
};

/**
 * La vue de base est-elle vide a l arrivee ? (Sinon, rien a decider ni a lire de plus.)
 * @param {string} vueDeBase - La vue de base.
 * @param {Date} aujourdhui - Aujourd hui.
 * @param {Array<Date | null>} dates - Les jours deja lus.
 * @returns {boolean} Vrai si aucun evenement n y tombe.
 */
export const vueDeBaseVide = (vueDeBase, aujourdhui, dates) => {
  const [debut, fin] = fenetreDeLaVue(vueDeBase, aujourdhui);
  return !dates.some((jour) => jour !== null && jour >= debut && jour <= fin);
};
