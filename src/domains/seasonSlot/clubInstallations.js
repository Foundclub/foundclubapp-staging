import { RouteNames } from '@/navigation/routeNames';

import {
  finDuCreneau,
  formatPeriod,
  slotOccursOn,
  timeRange,
  toMinutes,
  weekdayName,
} from './seasonSlotDisplay';
import { formeEnMots } from './seasonSlotWhen';

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
 * R17-QUAND-1 (point 6) — `rythme` dit la forme : « chaque mardi », « un mercredi sur deux », des
 * dates choisies (`formeEnMots`, avec la traduction `t`).
 * @param {any} slot - Un créneau du club (vue du contrat §4.1).
 * @param {((cle: string, ...autres: any[]) => string) | null} [t] - La traduction.
 * @returns {{ day: string, hours: string, period: string, rythme: string, team: string | null }} Le
 *   jour en minuscules, la plage, la forme,
 *   l équipe (null : « tout le club »).
 */
export const clubSlotParts = (slot, t = null) => ({
  day: weekdayName(slot?.weekday).toLocaleLowerCase(),
  hours: timeRange(slot?.startTime, slot?.endTime),
  rythme: t ? formeEnMots(t, slot) : `chaque ${weekdayName(slot?.weekday).toLocaleLowerCase()}`,
  // 🎨 COLL-FIX2 (03/10), planche 42 (tournée T10) : un créneau RÉPARTI (« Tout le club » du
  // 1 sept. au 6 oct., puis « U15 » du 7 oct. au 30 juin) se lisait en deux lignes identiques,
  // sans période. La période s'écrit quand le créneau ne couvre pas toute la saison
  // (du 1er septembre au 30 juin, contrat §2).
  // FINITIONS12-COLL : la fin écrite est le dernier jour où il a lieu (retiré : la veille).
  period: /-09-01$/.test(String(slot?.validFrom || '-09-01'))
    && /-06-30$/.test(finDuCreneau(slot) || '-06-30')
    ? ''
    : formatPeriod(slot?.validFrom, finDuCreneau(slot), { withYear: false }),
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
    // R17-QUAND-1 — la règle partagée : sa forme (chaque semaine, 1 sur 2, dates choisies) et
    // sa période.
    return slotOccursOn(slot, jour)
      && (!slot?.team?.documentId || slot.team.documentId === teamId)
      && de !== null && a !== null && de <= minutes && minutes < a;
  }) || null;
};

/**
 * FINITIONS16 · POINT 4 (T15) — LES INSTALLATIONS PROPOSÉES À UNE SÉANCE, une seule liste pour
 * le téléphone (`FacilitySelector`) et le site (`EventEdit.web.js`). Sur le site, « Modifier »
 * une séance au Gymnase de la Ville affichait « Aucune installation » : le formulaire ne lisait
 * que les installations du club.
 *
 * Dans cet ordre, sans doublon : celles du club ; celles de l omnisport (`isShared`) ; celles de
 * la Ville où le club a un créneau (`isVilleSlot`, COLL-C2C) ; et toujours l installation
 * ACTUELLE de la séance, même hors des listes lues (FINITIONS13-COLL).
 * @param {{ clubFacilities?: any[] | null, cmFacilities?: any[] | null,
 *   currentFacility?: any | null, villeFacilities?: any[] | null }} listes - Ce qui a été lu.
 * @returns {any[]} Les installations à proposer.
 */
export const eventFacilityOptions = ({
  clubFacilities = [], cmFacilities = [], currentFacility = null, villeFacilities = [],
}) => {
  const installations = [...(Array.isArray(clubFacilities) ? clubFacilities : [])];
  const dejaListee = (/** @type {any} */ facility) => installations
    .some((installation) => installation.documentId === facility?.documentId);

  (Array.isArray(cmFacilities) ? cmFacilities : []).forEach((cmFacility) => {
    if (!dejaListee(cmFacility)) installations.push({ ...cmFacility, isShared: true });
  });
  (Array.isArray(villeFacilities) ? villeFacilities : []).forEach((villeFacility) => {
    if (!dejaListee(villeFacility)) installations.push({ ...villeFacility, isVilleSlot: true });
  });
  if (currentFacility?.documentId && !dejaListee(currentFacility)) {
    installations.push({ ...currentFacility });
  }

  return installations;
};

// « DEMANDER » À LA VILLE : l écran du lot C3B (`ClubSlotRequest`, récolté le 02/10), avec
// l installation déjà choisie (ses paramètres : clubId, facilityId, teamId, date, heures).
export const ROUTE_DEMANDE_A_LA_VILLE = RouteNames.ClubSlotRequest;

/**
 * « Demander un créneau » à la Ville.
 * @param {any} navigation - La navigation de l écran.
 * @param {{ clubId?: string | null, facility: any }} contexte - Le club et l installation.
 * @returns {void}
 */
export const ouvrirDemandeALaVille = (navigation, { clubId = null, facility }) => {
  const facilityId = idOf(facility);
  if (!facilityId) return;
  navigation.navigate(ROUTE_DEMANDE_A_LA_VILLE, { clubId, facilityId });
};
