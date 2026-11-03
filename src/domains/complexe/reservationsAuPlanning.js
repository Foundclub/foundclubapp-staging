import { getPlanningItemDate } from '@/utils/planning/planningSlots';

/**
 * LA RÉSERVATION AU PLANNING DU JOUEUR — T3-RESA-PLANNING (03/11/2026, Adel « 9- A ») : une
 * réservation de terrain lue dans « Mes réservations » devient une ligne du planning, reconnue à
 * `reservationTerrain` (son bloc ouvre « Ma réservation », pas la fiche d'un événement).
 * Y entrent le créneau confirmé et la demande en attente (le créneau lui est gardé). N'y entrent ni
 * une collecte (rien n'est réservé), ni une partie à laquelle il a répondu « absent ».
 * Témoin : `reservationsAuPlanning.test.js`.
 */

const ETATS_AU_PLANNING = new Set(['confirmee', 'en_attente']);

/**
 * @param {any[] | null | undefined} reservations - Les réservations vues par le joueur.
 * @returns {any[]} Les lignes du planning (`normalizePlanningItems` les lit), sans doublon.
 */
export const versElementsDePlanning = (reservations) => {
  const vues = new Set();
  return (Array.isArray(reservations) ? reservations : []).flatMap((reservation) => {
    const id = reservation?.documentId;
    if (!id || vues.has(id) || !reservation.startsAt) return [];
    if (!ETATS_AU_PLANNING.has(reservation.status) || reservation.myResponse === 'absent') return [];
    vues.add(id);
    return [{
      documentId: id,
      endAt: reservation.endsAt || null,
      endTime: reservation.to || null,
      kind: 'reservation',
      reservationTerrain: { documentId: id },
      startAt: reservation.startsAt,
      startTime: reservation.from || null,
      title: [reservation.terrain?.name, reservation.complexe?.name].filter(Boolean).join(' · '),
    }];
  });
};

/**
 * @param {any[]} elements - Les lignes de `versElementsDePlanning`.
 * @param {{ from: string, to: string }} plage - La période lue par la vue du planning.
 * @returns {any[]} Celles qui commencent dans la période, comme les événements lus pour elle.
 */
export const dansLaPlage = (elements, plage) => {
  const debut = new Date(plage.from).getTime();
  const fin = new Date(plage.to).getTime();
  return elements.filter((element) => {
    const instant = new Date(element.startAt).getTime();
    return instant >= debut && instant < fin;
  });
};

/**
 * @param {any[]} elements - Les lignes de `versElementsDePlanning`.
 * @param {Date} [maintenant] - L'instant de référence.
 * @returns {Date[]} Les jours à venir, dans l'ordre : le calendrier s'ouvre sur le prochain.
 */
export const datesAVenirDesReservations = (elements, maintenant = new Date()) => elements
  .map(getPlanningItemDate)
  .filter((date) => date && date.getTime() >= maintenant.getTime())
  .sort((a, b) => a.getTime() - b.getTime());
