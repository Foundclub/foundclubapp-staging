/**
 * POINTAGE (decisions d Adel du 29/09) — LA REGLE « PRESENT / ABSENT / PAS
 * RENSEIGNE », COTE APP, A UN SEUL ENDROIT.
 *
 * Miroir de `admin/src/api/event/utils/presence-rule.js`. Le serveur tranche ;
 * l app ne fait que ne pas proposer ce qu il refuserait.
 *
 * 1. Pointer son arrivee n est jamais obligatoire : ne pas pointer ne rend
 *    jamais absent. On est absent seulement par sa reponse « Absent » ou par
 *    l appel d un encadrant.
 * 2. Apres l evenement, qui n a rien repondu et que l appel n a pas marque
 *    absent est « pas renseigne » — et peut encore passer present.
 * 3. Deux options par evenement, cochees par defaut : les participants
 *    repondent Present / Absent (`rsvpEnabled`) ; on suit les arrivees
 *    (`arrivalTrackingEnabled`). Un evenement d avant le lot (champ absent ou
 *    NULL) a les deux cochees.
 */

/**
 * Les participants repondent-ils Present / Absent a cet evenement ?
 * @param {{ rsvpEnabled?: boolean | null } | null | undefined} event
 * @returns {boolean} `false` seulement si l organisateur a decoche l option.
 */
export const isRsvpEnabled = (event) => event?.rsvpEnabled !== false;

/**
 * Suit-on les arrivees (pointage du joueur, appel de l entraineur) ?
 * @param {{ arrivalTrackingEnabled?: boolean | null } | null | undefined} event
 * @returns {boolean} `false` seulement si l organisateur a decoche l option.
 */
export const isArrivalTrackingEnabled = (event) => event?.arrivalTrackingEnabled !== false;

/**
 * STATS-FIX2 · point 5 (tournee T10, ecran 1) — combien de temps la porte « Je passe en
 * present » reste ouverte apres le DEBUT de l evenement : le temps de l apres-match, 72 h, la
 * fenetre « chaude » des rappels d apres-match du serveur (`match-stats-report.ts`,
 * HOT_WINDOW_HOURS). Sans borne, elle restait epinglee sur un match d un mois.
 * ponytail: comptee depuis le DEBUT (la seule date sure de tous les evenements) ; un evenement
 * de plusieurs heures perd donc ses dernieres heures de porte. Voie de sortie : lire la fin.
 */
export const LATE_PRESENCE_WINDOW_MS = 72 * 60 * 60 * 1000;

/**
 * « Je passe en present » : la porte etroite du « pas renseigne », apres le
 * debut de l evenement. Memes refus que le serveur (`event-rsvp.ts`,
 * `assertLatePresenceAllowed`) : un membre convie, sans reponse, jamais
 * par-dessus une absence constatee a l appel, jamais sur un evenement ou l on
 * ne repond pas. Une journee de stage passe par le stage, un match de
 * championnat garde sa reponse ouverte : ni l un ni l autre ne sont concernes.
 * Et le temps de l apres-match seulement (`LATE_PRESENCE_WINDOW_MS`).
 * @param {{
 *   event: any,
 *   hasPendingRequest?: boolean,
 *   isConvenedMember?: boolean,
 *   isMissing?: boolean,
 *   isParticipating?: boolean,
 *   myAttendanceStatus?: string | null,
 *   now?: number,
 * }} input
 * @returns {boolean}
 */
export const canDeclareLatePresence = ({
  event,
  hasPendingRequest = false,
  isConvenedMember = false,
  isMissing = false,
  isParticipating = false,
  myAttendanceStatus = null,
  now = Date.now(),
}) => {
  if (!event || !isConvenedMember || !isRsvpEnabled(event)) return false;
  if (event?.league_match) return false;
  if (String(event?.eventFormat || '').trim().toLowerCase() === 'stage_day') return false;
  if (isParticipating || isMissing || hasPendingRequest) return false;
  // Depuis POINTAGE, le serveur ne rend `no_show` que pour une absence SIGNEE.
  if (String(myAttendanceStatus || '').trim().toLowerCase() === 'no_show') return false;
  const startMs = new Date(event?.date).getTime();
  return Number.isFinite(startMs) && startMs <= now && now - startMs <= LATE_PRESENCE_WINDOW_MS;
};
