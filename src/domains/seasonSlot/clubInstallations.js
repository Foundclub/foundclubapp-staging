import { RouteNames } from '@/navigation/routeNames';

import {
  formatPeriod,
  isoWeekdayOf,
  timeRange,
  toMinutes,
  weekdayName,
} from './seasonSlotDisplay';

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
 * @returns {{ day: string, hours: string, period: string, team: string | null }} Le jour en minuscules, la plage,
 *   l équipe (null : « tout le club »).
 */
export const clubSlotParts = (slot) => ({
  day: weekdayName(slot?.weekday).toLocaleLowerCase(),
  hours: timeRange(slot?.startTime, slot?.endTime),
  // 🎨 COLL-FIX2 (03/10), planche 42 (tournée T10) : un créneau RÉPARTI (« Tout le club » du
  // 1 sept. au 6 oct., puis « U15 » du 7 oct. au 30 juin) se lisait en deux lignes identiques,
  // sans période. La période s'écrit quand le créneau ne couvre pas toute la saison
  // (du 1er septembre au 30 juin, contrat §2).
  period: /-09-01$/.test(String(slot?.validFrom || '-09-01'))
    && /-06-30$/.test(String(slot?.validUntil || '-06-30'))
    ? ''
    : formatPeriod(slot?.validFrom, slot?.validUntil, { withYear: false }),
  team: slot?.team?.name || null,
});

const deuxChiffres = (/** @type {number} */ nombre) => String(nombre).padStart(2, '0');

/**
 * COLL-C2C (02/10) — D32 : le créneau du club où tombe une séance, avec la même règle que le
 * serveur (`isSessionInSlot`) : ce jour de la semaine, dans la période, le début dans la plage,
 * et l équipe du créneau s il en nomme une. Heure de l appareil. Le serveur reste le seul juge (il
 * compte aussi les autres séances du club) : ceci ne sert qu à prévenir pendant la saisie.
 * @param {any[] | null | undefined} slots - Les créneaux du club sur une installation.
 * @param {{ start?: string | null, teamId?: string | null }} seance - Le début (ISO) et l équipe.
 * @returns {any | null} Le créneau, ou null.
 */
export const creneauDeLaSeance = (slots, { start = null, teamId = null } = {}) => {
  if (!start || !Array.isArray(slots)) return null;
  const debut = new Date(start);
  if (Number.isNaN(debut.getTime())) return null;
  const mois = deuxChiffres(debut.getMonth() + 1);
  const jour = `${debut.getFullYear()}-${mois}-${deuxChiffres(debut.getDate())}`;
  const minutes = (debut.getHours() * 60) + debut.getMinutes();
  return slots.find((slot) => {
    const de = toMinutes(slot?.startTime);
    const a = toMinutes(slot?.endTime);
    return Number(slot?.weekday) === isoWeekdayOf(debut)
      && (!slot?.validFrom || slot.validFrom <= jour)
      && (!slot?.validUntil || jour <= slot.validUntil)
      && (!slot?.team?.documentId || slot.team.documentId === teamId)
      && de !== null && a !== null && de <= minutes && minutes < a;
  }) || null;
};

// « DEMANDER » À LA VILLE : l écran du lot C3B (`ClubSlotRequest`, récolté le 02/10), avec
// l installation déjà choisie (ses paramètres : clubId, facilityId, teamId, date, heures).
export const ROUTE_DEMANDE_A_LA_VILLE = RouteNames.ClubSlotRequest;

/**
 * « Demander un créneau » / « Demander une heure » à la Ville.
 * @param {any} navigation - La navigation de l écran.
 * @param {{ clubId?: string | null, facility: any }} contexte - Le club et l installation.
 * @returns {void}
 */
export const ouvrirDemandeALaVille = (navigation, { clubId = null, facility }) => {
  const facilityId = idOf(facility);
  if (!facilityId) return;
  navigation.navigate(ROUTE_DEMANDE_A_LA_VILLE, { clubId, facilityId });
};
