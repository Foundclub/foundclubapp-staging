import { createEventPayload, formatDateTimeToSend } from '@/domains/event/eventUseCases';

// 🏛️ COLL-C3B (02/10) — LE CLUB DEMANDE : les corps de POST /events (planche P8v2-demande).
// À part de collectiviteDemandes.js : celui-ci lit les règles des événements (et la langue), que
// les écrans de la mairie n'ont pas à charger.

/**
 * Les séances à poser pour une demande : une par date, l'entraînement de l'équipe sur
 * l'installation de la Ville. Le serveur en fait une DEMANDE si la place est prise (event.create) ;
 * « Un mot pour la mairie » en devient le motif (`facilityRequestNote`). Une série partage un
 * `recurrenceGroupId` : la mairie la tranche d'un geste.
 * @param {{ clubId: string, dates: string[], debut: string, facilityId: string, fin: string,
 *   groupe?: string | null, mot?: string, teamId: string, type: string, typeName: string }} demande
 * @returns {Array<Record<string, any>>} Les corps de POST /events.
 */
export const payloadsDeLaDemande = ({
  clubId, dates, debut, facilityId, fin, groupe = null, mot = '', teamId, type, typeName,
}) => dates.map((jour) => {
  const [annee, mois, date] = jour.split('-');
  const jourFr = `${date}/${mois}/${annee}`;
  const corps = createEventPayload({
    club: clubId,
    date: jourFr,
    endTime: fin,
    facility: facilityId,
    name: '',
    // 🧯 COLL-FIX-DEMANDES (02/10) — la séance de l'ÉQUIPE, FERMÉE au dehors. Sans ce champ, un
    // entraînement est « ouvert » (défaut du schéma et de resolveTrainingOpenConfig) : il lui
    // faut au moins une place externe, et le serveur refusait TOUTE demande (400, tournée G3).
    sessionStatus: 'closed',
    startTime: debut,
    team: teamId,
    type,
    typeName,
  });
  corps.endDate = formatDateTimeToSend(jourFr, fin);
  if (groupe && dates.length > 1) corps.recurrenceGroupId = groupe;
  if (String(mot || '').trim()) corps.facilityRequestNote = String(mot).trim();
  return corps;
});
