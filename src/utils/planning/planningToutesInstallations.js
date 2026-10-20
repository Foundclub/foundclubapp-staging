import {
  addDays, endOfDay, format, isSameDay,
} from 'date-fns';

import { closureCoversDay } from '@/domains/facilityClosure/facilityClosureDisplay';

import {
  assignClubPlanningColors,
  resolveFacilityPlanningColor,
} from '@/utils/facilityPlanningColor';
import {
  getPlanningItemDate,
  getPlanningItemWindow,
  normalizePlanningItems,
} from '@/utils/planning/planningSlots';

/**
 * 🏟️ R17-PLANNING (20/10/2026, REC17-005 lot 1) — LE PLANNING DE TOUTES LES INSTALLATIONS DE LA
 * VILLE, sous les cartes (planches P10-planning-ordi et P10-planning-tel, validées le 19/10).
 *
 * Les blocs viennent des lectures `GET /facilities/:id/planning` déjà faites pour les cartes
 * (« Cette semaine : … », même clé de cache) : une par installation. Ici, on les range.
 */

/**
 * Le début d'un bloc, pour trier une case ou une journée.
 * @param {any} bloc - Un bloc normalisé.
 * @returns {number} L'instant de début (ms), ou l'infini s'il est illisible.
 */
const debutDe = (bloc) => {
  const fenetre = getPlanningItemWindow(bloc);
  return fenetre?.startAt ? fenetre.startAt.getTime() : Number.POSITIVE_INFINITY;
};

/**
 * Trie des blocs dans l'ordre des heures.
 * @param {any[]} blocs - Des blocs.
 * @returns {any[]} Une copie triée.
 */
const parHeure = (blocs) => [...blocs].sort((gauche, droite) => debutDe(gauche) - debutDe(droite));

/**
 * Une demande en attente ne prend pas encore de place (contrat C2A §7).
 * @param {any} bloc - Un bloc normalisé.
 * @returns {boolean} Vrai si le bloc est en attente.
 */
const enAttente = (bloc) => bloc?.raw?.pending === true;

/**
 * 🏟️ R17-PLANNING-2 (20/10) — « complet » (planche P10-planning-ordi 1, « 18:00 – 19:30 ·
 * complet ») : au moment de ce bloc, son installation a atteint sa capacité (`maxSlots`). On
 * compte les blocs du même jour, de la même installation, qui le chevauchent, lui compris ; une
 * demande en attente ne compte pas et n'est jamais « complet ».
 * @param {any[]} blocs - Les blocs de la Ville, avec `installation`.
 * @returns {any[]} Les mêmes blocs, avec `complet`.
 */
const marquerComplets = (blocs) => {
  const fenetres = blocs.map((bloc) => (enAttente(bloc) ? null : getPlanningItemWindow(bloc)));
  return blocs.map((bloc, rang) => {
    const fenetre = fenetres[rang];
    if (!fenetre?.startAt || !fenetre?.endAt) return { ...bloc, complet: false };
    const capacite = Math.max(1, Number(bloc.installation?.maxSlots || 1));
    const ensemble = blocs.filter((autre, autreRang) => {
      const autreFenetre = fenetres[autreRang];
      return Boolean(autreFenetre?.startAt && autreFenetre?.endAt)
        && autre.installation?.documentId === bloc.installation?.documentId
        && isSameDay(autreFenetre.startAt, fenetre.startAt)
        && autreFenetre.startAt < fenetre.endAt
        && fenetre.startAt < autreFenetre.endAt;
    }).length;
    return { ...bloc, complet: ensemble >= capacite };
  });
};

/**
 * Les fermetures d'UNE installation qui touchent UN jour (planche : « Fermé · désinfection »).
 * @param {any[] | null | undefined} fermetures - Les fermetures de la Ville
 *   (`GET /collectivites/:id/closures`).
 * @param {any} installation - L'installation.
 * @param {Date} jour - Le jour.
 * @returns {any[]} Ses fermetures ce jour-là.
 */
export const fermeturesDuJour = (fermetures, installation, jour) => {
  const cle = format(jour, 'yyyy-MM-dd');
  return (Array.isArray(fermetures) ? fermetures : []).filter((fermeture) => (
    fermeture?.facility?.documentId === installation?.documentId
    && closureCoversDay(fermeture, cle)
  ));
};

/**
 * Tous les blocs de la Ville, chacun avec SON installation, colorés PAR CLUB (COL-019) : un club a
 * la même couleur d'une installation à l'autre (les couleurs sont posées sur l'ensemble).
 * @param {Array<{ data?: any[] } | null | undefined>} lectures - Les réponses, dans l'ordre des
 *   installations (une encore absente est sautée).
 * @param {any[]} installations - Les installations de la Ville.
 * @param {any[] | null} clubsDeLaVille - Les clubs rattachés, dans l'ordre de sa liste (ou null).
 * @returns {any[]} Les blocs normalisés, avec `installation` et `displayColor`.
 */
export const blocsDeLaVille = (lectures, installations, clubsDeLaVille) => {
  const blocs = installations.flatMap((installation, index) => (
    normalizePlanningItems(lectures[index]?.data || [])
      .map((/** @type {any} */ item) => ({ ...item, installation }))
  ));
  return marquerComplets(assignClubPlanningColors(blocs, clubsDeLaVille));
};

/**
 * Semaine, ordinateur : une rangée par installation, une colonne par jour.
 * @param {any[]} blocs - Les blocs de la Ville (`blocsDeLaVille`).
 * @param {any[]} installations - Les installations, dans l'ordre des cartes.
 * @param {Date} debutDeSemaine - Le lundi.
 * @returns {Array<{ installation: any, jours: any[][] }>} Sept cases par rangée, triées.
 */
export const grilleDeLaSemaine = (blocs, installations, debutDeSemaine) => installations
  .map((installation) => ({
    installation,
    jours: [0, 1, 2, 3, 4, 5, 6].map((decalage) => parHeure(blocs.filter((bloc) => (
      bloc.installation?.documentId === installation.documentId
      && isSameDay(
        getPlanningItemDate(bloc) || new Date(Number.NaN),
        addDays(debutDeSemaine, decalage),
      )
    )))),
  }));

/**
 * Semaine, téléphone : la liste jour par jour (les jours sans rien sont sautés).
 * @param {any[]} blocs - Les blocs de la Ville.
 * @param {Date} debutDeSemaine - Le lundi.
 * @returns {Array<{ jour: Date, blocs: any[] }>} Les jours qui ont quelque chose.
 */
export const listeDeLaSemaine = (blocs, debutDeSemaine) => [0, 1, 2, 3, 4, 5, 6]
  .map((decalage) => {
    const jour = addDays(debutDeSemaine, decalage);
    return {
      blocs: parHeure(blocs.filter((bloc) => {
        const date = getPlanningItemDate(bloc);
        return Boolean(date) && isSameDay(/** @type {Date} */ (date), jour);
      })),
      jour,
    };
  })
  .filter((ligne) => ligne.blocs.length > 0);

/**
 * Jour : la journée rangée par installation (toutes, même vides : « Rien ce jour »).
 * @param {any[]} blocs - Les blocs de la Ville.
 * @param {any[]} installations - Les installations.
 * @param {Date} jour - Le jour.
 * @returns {Array<{ installation: any, blocs: any[] }>} Une ligne par installation.
 */
export const journeeParInstallation = (blocs, installations, jour) => installations
  .map((installation) => ({
    blocs: parHeure(blocs.filter((bloc) => {
      const date = getPlanningItemDate(bloc);
      return bloc.installation?.documentId === installation.documentId
        && Boolean(date) && isSameDay(/** @type {Date} */ (date), jour);
    })),
    installation,
  }));

/**
 * Mois : la couleur de l'INSTALLATION (planches : on compte des installations utilisées, pas des
 * clubs ; la légende le dit).
 * @param {any[]} blocs - Les blocs de la Ville.
 * @returns {any[]} Les mêmes blocs, à la couleur de leur installation.
 */
export const blocsDuMois = (blocs) => blocs.map((bloc) => ({
  ...bloc,
  displayColor: resolveFacilityPlanningColor(bloc.installation) || bloc.displayColor,
}));

/**
 * Le premier bloc APRÈS un jour (« Prochaine séance : … » d'un jour sans rien).
 * @param {any[]} blocs - Les blocs lus.
 * @param {Date} jour - Le jour vide.
 * @returns {any | null} Le bloc, ou null si rien n'est lu après.
 */
export const prochainBloc = (blocs, jour) => parHeure(blocs.filter((bloc) => {
  const date = getPlanningItemDate(bloc);
  return Boolean(date) && /** @type {Date} */ (date) > endOfDay(jour);
}))[0] || null;
