/**
 * 👪 PAR-L11b (13/10) — « INSCRIRE MES ENFANTS » A UN EVENEMENT PUBLIC : CE QUE L ECRAN MONTRE.
 *
 * Decision D4 B d Adel (12/10) : tous les evenements publics, une regle par type. Le serveur
 * reste le juge (admin `api/event-child-registration/services/child-registration-rules.js`) ;
 * ces fonctions pures disent seulement s il faut un bouton, quels enfants on peut cocher, et
 * la phrase de chaque resultat.
 *
 *   detection, entrainement, match, autre, stage ENTIER ⇒ une demande, validee ;
 *   reservation qui recrute                             ⇒ inscription immediate ;
 *   tournoi, match amical                               ⇒ pas de bouton (des equipes) ;
 *   ferme, passe, annule, journee de stage              ⇒ pas de bouton, une phrase.
 * Temoin : `childRegistrationFlow.test.js`.
 */

/** A partir de cet age, l enfant a son propre compte (registre des mineurs, ligne 1). */
const CHILD_SELF_SIGNUP_AGE = 13;

const BLOCKED = 'childEventRegistration.blocked';

/**
 * Un texte sans accent, en minuscules.
 * @param {unknown} value - Un texte.
 * @returns {string} Le texte replie.
 */
const fold = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .toLowerCase()
  .trim();

/**
 * La famille d un evenement, lue sur son format et le NOM de son type.
 * @param {any} event - L evenement.
 * @returns {string} tournament, friendly, reservation, stage_day, stage, training,
 * detection, match ou other.
 */
export const resolveChildEventKind = (event) => {
  const format = fold(event?.eventFormat);
  if (format === 'stage_day') return 'stage_day';
  const typeName = fold(event?.type?.name);
  if (typeName.includes('tournoi')) return 'tournament';
  if (typeName.includes('amical')) return 'friendly';
  if (typeName.includes('reservation')) return 'reservation';
  if (format === 'stage_parent' || typeName.includes('stage')) return 'stage';
  if (typeName.includes('entrainement')) return 'training';
  if (typeName.includes('detection')) return 'detection';
  if (typeName.includes('match')) return 'match';
  return 'other';
};

/**
 * Une offre : le mode d admission, ou la phrase qui dit pourquoi pas.
 * @param {string|null} admission - request, immediate, ou null.
 * @param {string|null} blockedKey - La clef de la phrase, ou null.
 * @returns {{ admission: string|null, blockedKey: string|null, canAct: boolean }} L offre.
 */
const offer = (admission, blockedKey) => ({
  admission,
  blockedKey,
  canAct: Boolean(admission),
});

/**
 * Ce que l evenement permet a un parent, avant de regarder ses enfants.
 * @param {any} event - L evenement (type, format, date, statut, reservation).
 * @param {number} nowMs - L instant.
 * @returns {{ admission: string|null, blockedKey: string|null, canAct: boolean }} L offre.
 */
export const resolveChildRegistrationOffer = (event, nowMs) => {
  const kind = resolveChildEventKind(event);
  if (event?.isActive === false || fold(event?.status) === 'cancelled') {
    return offer(null, `${BLOCKED}.cancelled`);
  }
  if (kind === 'tournament') return offer(null, `${BLOCKED}.tournament`);
  if (kind === 'friendly') return offer(null, `${BLOCKED}.friendly`);
  if (kind === 'stage_day') return offer(null, `${BLOCKED}.stageDay`);
  if (fold(event?.sessionStatus) === 'closed' || event?.league_match) {
    return offer(null, `${BLOCKED}.invitedTeamsOnly`);
  }
  const start = new Date(event?.date).getTime();
  if (!Number.isFinite(start) || start <= nowMs) return offer(null, `${BLOCKED}.past`);
  if (kind === 'reservation') {
    if (event?.reservationMode !== 'RECRUITING') {
      return offer(null, `${BLOCKED}.reservationClosed`);
    }
    if ((Number(event?.missingPlayers) || 0) <= 0) return offer(null, `${BLOCKED}.full`);
    return offer('immediate', null);
  }
  return offer('request', null);
};

/**
 * Les enfants du parent, TOUS montres : ceux qu on ne peut pas cocher portent leur raison
 * (comme la demande de place, PAR-009). Une demande refusee se renvoie.
 * @param {any[]} children - Les fiches (`documentId`, `firstname`, `age`).
 * @param {any[]} registrations - Ses inscriptions ici (`child.documentId`, `status`).
 * @returns {Array<{ age: number|null, documentId: string, firstname: string,
 *   reasonKey: string|null, selectable: boolean }>} Une ligne par enfant.
 */
export const describeChildChoices = (children, registrations) => {
  const statusByChild = new Map(
    (Array.isArray(registrations) ? registrations : []).map((registration) => [
      String(registration?.child?.documentId || ''),
      String(registration?.status || ''),
    ]),
  );
  return (Array.isArray(children) ? children : [])
    .filter((child) => child?.documentId)
    .map((child) => {
      const age = typeof child.age === 'number' ? child.age : null;
      const status = statusByChild.get(String(child.documentId));
      let reasonKey = null;
      if (age === null || age >= CHILD_SELF_SIGNUP_AGE) {
        reasonKey = 'childEventRegistration.reasons.tooOld';
      } else if (status === 'pending') {
        reasonKey = 'childEventRegistration.reasons.alreadyPending';
      } else if (status === 'accepted') {
        reasonKey = 'childEventRegistration.reasons.alreadyRegistered';
      }
      return {
        age,
        documentId: String(child.documentId),
        firstname: String(child.firstname || '').trim(),
        reasonKey,
        selectable: reasonKey === null,
      };
    });
};

const REFUSAL_CODES = new Set([
  'ALREADY_PENDING',
  'ALREADY_REGISTERED',
  'CHILD_ALREADY_MEMBER',
  'CHILD_TOO_OLD',
  'EXTERNAL_QUOTA_FULL',
  'FULL',
]);

/**
 * La phrase du resultat d UN enfant, apres l envoi.
 * @param {{ code?: string, firstname?: string, outcome?: string }} result - Le resultat
 * rendu par le serveur.
 * @returns {{ key: string, params: { firstname: string }, tone: 'ok'|'refused' }} La clef.
 */
export const resultLine = (result) => {
  const params = { firstname: String(result?.firstname || '').trim() };
  if (result?.outcome === 'pending') {
    return { key: 'childEventRegistration.result.pending', params, tone: 'ok' };
  }
  if (result?.outcome === 'accepted') {
    return { key: 'childEventRegistration.result.accepted', params, tone: 'ok' };
  }
  const code = REFUSAL_CODES.has(String(result?.code)) ? String(result.code) : 'default';
  return { key: `childEventRegistration.result.refused.${code}`, params, tone: 'refused' };
};

/**
 * Ce que le parent relit sous l evenement, pour chacun de ses enfants deja inscrits.
 * @param {any} registration - Sa ligne (`child.firstname`, `reason`, `status`).
 * @returns {{ key: string, params: object, tone: 'ok'|'refused'|'waiting' }} La clef.
 */
export const statusLine = (registration) => {
  const firstname = String(registration?.child?.firstname || '').trim();
  const reason = String(registration?.reason || '').trim();
  if (registration?.status === 'accepted') {
    return { key: 'childEventRegistration.status.accepted', params: { firstname }, tone: 'ok' };
  }
  if (registration?.status === 'declined') {
    return reason
      ? {
        key: 'childEventRegistration.status.declinedWithReason',
        params: { firstname, reason },
        tone: 'refused',
      }
      : {
        key: 'childEventRegistration.status.declined',
        params: { firstname },
        tone: 'refused',
      };
  }
  return { key: 'childEventRegistration.status.pending', params: { firstname }, tone: 'waiting' };
};

const ERROR_KEY_BY_CODE = {
  ALREADY_PENDING: 'childEventRegistration.result.refused.ALREADY_PENDING',
  EVENT_INACTIVE: `${BLOCKED}.cancelled`,
  EVENT_PAST: `${BLOCKED}.past`,
  EXTERNAL_QUOTA_FULL: `${BLOCKED}.externalQuotaFull`,
  FULL: `${BLOCKED}.full`,
  INVITED_TEAMS_ONLY: `${BLOCKED}.invitedTeamsOnly`,
  NOT_PENDING: 'childEventRegistration.errors.alreadyDecided',
  RESERVATION_CLOSED: `${BLOCKED}.reservationClosed`,
  STAGE_DAY: `${BLOCKED}.stageDay`,
  TEAMS_ONLY: `${BLOCKED}.teamsOnly`,
};

/**
 * La phrase d un refus du serveur pour TOUT l evenement (ou d une decision de
 * l organisateur). Le client rejette `response.data.error` lui-meme : le code est dans
 * `details.code` (`client.native.js`).
 * @param {any} error - L erreur rejetee par le client.
 * @returns {string} La clef de traduction.
 */
export const errorKey = (error) => ERROR_KEY_BY_CODE[String(error?.details?.code || '')]
  || 'childEventRegistration.errors.generic';

/**
 * 👪 PAR-L11c (14/10) point 4 — la longueur d un motif de refus : celle que le serveur garde
 * (admin `child-registration-rules.js`, `REASON_MAX_LENGTH`). Au-dela, il couperait.
 */
export const REFUSAL_REASON_MAX_LENGTH = 500;

const CANCELLABLE_STATUSES = new Set(['accepted', 'pending']);

/**
 * 👪 PAR-L11c (14/10) — le parent peut-il annuler cette ligne ? En attente ou confirmee, et
 * l evenement pas encore commence. Une ligne refusee n a rien a annuler. Sans date lue, le
 * lien reste : le serveur est juge (`cancel` efface la ligne et rend une place immediate).
 * @param {any} registration - Sa ligne (`status`, `event.date`).
 * @param {number} nowMs - L instant.
 * @returns {boolean} Vrai si « Annuler l inscription » se montre.
 */
export const canCancelRegistration = (registration, nowMs) => {
  if (!CANCELLABLE_STATUSES.has(String(registration?.status || ''))) return false;
  const start = new Date(String(registration?.event?.date || '')).getTime();
  return !Number.isFinite(start) || start > nowMs;
};

/** Le message du serveur quand la ligne n existe plus (admin `event-child-registration.ts`). */
const GONE_MESSAGE = 'registration not found';

/**
 * 👪 PAR-L11c (14/10) — CE QUE VEUT DIRE LE REFUS D UNE ANNULATION (meme lecture que PAR-L8,
 * `annulationDeLaDemande.js`) :
 *   · 404 « Registration not found » : la ligne est deja effacee        → 'gone' ;
 *   · un autre 404 (route absente) ou un 403 (droit absent) : un serveur d AVANT
 *                                                                        → 'unavailable' ;
 *   · le reste (pas de reseau, abandon, panne)                           → 'failed' (on relance).
 * Le client rejette `response.data.error` (`client.native.js`) : status et message y sont.
 * @param {any} error - L erreur rejetee.
 * @returns {'gone'|'unavailable'|'failed'} La situation.
 */
export const cancelSituation = (error) => {
  const status = Number(error?.status || error?.response?.status) || 0;
  const message = String(typeof error === 'string' ? error : error?.message || '')
    .trim()
    .toLowerCase();
  if (status === 404 && message === GONE_MESSAGE) return 'gone';
  if (status === 403 || status === 404 || message === 'not found') return 'unavailable';
  return 'failed';
};
