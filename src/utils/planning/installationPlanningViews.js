import {
  addDays, addMonths, format, isSameDay, isSameMonth, isSameWeek,
} from 'date-fns';

import { getPlanningRange } from '@/utils/planning/planningSlots';

import { getItem, setItem } from '@/platform/storage';

/**
 * 📐 COLL-C2B (02/10) — LES 5 VUES du planning d une installation (design HY521H1, P5v2-vues).
 *
 * Jour · 3 jours · Semaine · Mois · Liste sur telephone ; le site n a pas « 3 jours » (« il
 * n apporte rien sur un grand ecran »). Par defaut : JOUR sur telephone (D6 A : la seule vue ou
 * une heure libre est assez grande pour etre touchee), SEMAINE sur le site. La vue choisie est
 * RETENUE (sur cet appareil). Telephone tourne : la semaine, quelle que soit la vue retenue.
 */

export const VUES = /** @type {const} */ ({
  jour: 'day',
  liste: 'list',
  mois: 'month',
  semaine: 'week',
  troisJours: '3days',
});

/** La cle de la vue retenue (une par appareil, pour toutes les installations). */
export const CLE_VUE_RETENUE = 'planning.installation.vue';

/**
 * Les vues proposees, dans l ordre du dessin.
 * @param {string} os - Platform.OS.
 * @returns {string[]} Les vues.
 */
export const vuesProposees = (os) => (os === 'web'
  ? [VUES.jour, VUES.semaine, VUES.mois, VUES.liste]
  : [VUES.jour, VUES.troisJours, VUES.semaine, VUES.mois, VUES.liste]);

/**
 * La vue par defaut : le jour sur telephone, la semaine sur le site.
 * @param {string} os - Platform.OS.
 * @returns {string} La vue.
 */
export const vueParDefaut = (os) => (os === 'web' ? VUES.semaine : VUES.jour);

/**
 * La vue retenue sur cet appareil, si elle est encore proposee ; sinon la vue par defaut.
 * @param {string} os - Platform.OS.
 * @returns {string} La vue.
 */
export const lireVueRetenue = (os) => {
  try {
    const retenue = getItem(CLE_VUE_RETENUE);
    return vuesProposees(os).includes(String(retenue)) ? String(retenue) : vueParDefaut(os);
  } catch {
    return vueParDefaut(os);
  }
};

/**
 * Retient la vue choisie (sans jamais faire tomber l ecran si le stockage manque).
 * @param {string} vue - La vue.
 * @returns {void}
 */
export const retenirVue = (vue) => {
  try {
    setItem(CLE_VUE_RETENUE, vue);
  } catch {
    // Pas de stockage : la vue vaut pour cette ouverture seulement.
  }
};

/**
 * Les jours que la periode lue couvre : la semaine pour Jour, Semaine et Liste (changer de jour
 * ne relit pas la semaine) ; la veille, le jour et le lendemain pour 3 jours ; le mois.
 * @param {string} vue - La vue.
 * @param {Date} date - Le jour affiche.
 * @returns {{ from: string, to: string }} AAAA-MM-JJ (31 jours au plus : contrat du lot 1b).
 */
export const plageDeLaVue = (vue, date) => {
  if (vue === VUES.mois) return getPlanningRange(date, 'month');
  if (vue === VUES.troisJours) {
    return {
      from: format(addDays(date, -1), 'yyyy-MM-dd'),
      to: format(addDays(date, 1), 'yyyy-MM-dd'),
    };
  }
  return getPlanningRange(date, 'week');
};

/**
 * Le jour suivant (ou precedent) selon la vue : un jour, trois jours, une semaine, un mois.
 * @param {string} vue - La vue.
 * @param {Date} date - Le jour affiche.
 * @param {1 | -1} sens - En avant ou en arriere.
 * @returns {Date} Le nouveau jour.
 */
export const pageSuivante = (vue, date, sens) => {
  if (vue === VUES.mois) return addMonths(date, sens);
  if (vue === VUES.troisJours) return addDays(date, 3 * sens);
  if (vue === VUES.semaine || vue === VUES.liste) return addDays(date, 7 * sens);
  return addDays(date, sens);
};

/**
 * La page affichee contient-elle aujourd hui ?
 * @param {string} vue - La vue.
 * @param {Date} date - Le jour affiche.
 * @param {Date} aujourdhui - Aujourd hui.
 * @returns {boolean} Vrai si « Aujourd hui » ne menerait nulle part.
 */
export const pageDAujourdhui = (vue, date, aujourdhui) => {
  if (vue === VUES.mois) return isSameMonth(date, aujourdhui);
  if (vue === VUES.semaine || vue === VUES.liste) {
    return isSameWeek(date, aujourdhui, { weekStartsOn: 1 });
  }
  if (vue === VUES.troisJours) {
    return [addDays(date, -1), date, addDays(date, 1)].some((jour) => isSameDay(jour, aujourdhui));
  }
  return isSameDay(date, aujourdhui);
};
