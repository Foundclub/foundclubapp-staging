import { RouteNames } from '@/navigation/routeNames';

import { timeRange, weekdayName } from './seasonSlotDisplay';

/**
 * COLL-C2C (02/10) — « Tes installations », côté CLUB, en 3 groupes (planche
 * P8v2-installations-tel, décision D32) : ce qui est au club ; ce que la Ville lui a attribué ;
 * ce qu il peut demander.
 *
 * Les créneaux du club arrivent du serveur (GET /clubs/:id/season-slots, contrat
 * `docs/CONTRAT_CRENEAUX_SAISON.md` du dépôt admin), joints à chaque installation par
 * `getClubFacilityContext({ includeClubSlots })` sous `clubSeasonSlots`. Ce module ne lit rien :
 * il range et il écrit.
 */

const idOf = (/** @type {any} */ facility) => String(facility?.documentId || facility?.id || '');

/**
 * Les 3 groupes de « Tes installations ».
 * @param {any[]} facilities - Les installations du contexte du club (club, omnisport, Ville),
 *   celles qui portent des créneaux du club ayant `clubSeasonSlots`.
 * @returns {{
 *   aDemander: any[],
 *   auClub: any[],
 *   avecCreneaux: any[],
 *   collectiviteName: string,
 *   hasVille: boolean,
 * }} Les groupes, dans l ordre où le dirigeant s en sert.
 */
export const groupClubInstallations = (facilities) => {
  const liste = Array.isArray(facilities) ? facilities : [];
  const ville = liste.filter((facility) => facility?.ownerType === 'collectivite');
  const aDesCreneaux = (/** @type {any} */ facility) => (
    Array.isArray(facility?.clubSeasonSlots) && facility.clubSeasonSlots.length > 0
  );
  return {
    aDemander: ville.filter((facility) => !aDesCreneaux(facility)),
    auClub: liste.filter((facility) => facility?.ownerType !== 'collectivite'),
    avecCreneaux: ville.filter(aDesCreneaux),
    collectiviteName: String(ville.find((facility) => facility?.ownerName)?.ownerName || ''),
    hasVille: ville.length > 0,
  };
};

/**
 * Les morceaux d une ligne « U15 · chaque mardi 17:30 – 19:00 ».
 * @param {any} slot - Un créneau du club (vue du contrat §4.1).
 * @returns {{ day: string, hours: string, team: string | null }} Le jour en minuscules, la plage,
 *   l équipe (null : « tout le club »).
 */
export const clubSlotParts = (slot) => ({
  day: weekdayName(slot?.weekday).toLocaleLowerCase(),
  hours: timeRange(slot?.startTime, slot?.endTime),
  team: slot?.team?.name || null,
});

// POINT D ACCROCHE NOMMÉ (lot C3B) : l écran où le club DEMANDE un créneau à la Ville. Tant qu il
// n est pas récolté, la route n existe pas : « Demander » ouvre le planning de l installation,
// où l on voit les heures libres. Le jour où `RouteNames.ClubDemandeCreneau` existe, ce seul
// endroit bascule, avec { clubId, facilityId, facilityName }.
export const ROUTE_DEMANDE_A_LA_VILLE = 'ClubDemandeCreneau';

/**
 * « Demander un créneau » / « Demander une heure » à la Ville.
 * @param {any} navigation - La navigation de l écran.
 * @param {{ clubId?: string | null, facility: any }} contexte - Le club et l installation.
 * @returns {void}
 */
export const ouvrirDemandeALaVille = (navigation, { clubId = null, facility }) => {
  const facilityId = idOf(facility);
  if (!facilityId) return;
  const routes = /** @type {Record<string, string>} */ (RouteNames);
  if (routes[ROUTE_DEMANDE_A_LA_VILLE]) {
    navigation.navigate(routes[ROUTE_DEMANDE_A_LA_VILLE], {
      clubId,
      facilityId,
      facilityName: facility?.name || null,
    });
    return;
  }
  navigation.navigate(RouteNames.PlanningWeekFullscreen, {
    contextDetailLabel: facility?.name || null,
    facilityId,
    sourceType: 'facility',
  });
};
