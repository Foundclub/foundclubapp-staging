/**
 * L5-A — LA LOGIQUE PURE DE « FAIRE L APPEL » (planche 02 du pack).
 *
 * Tout ce qui DECIDE vit ici, et rien de ce qui decide ne lit l horloge du
 * telephone. C est la lecon AC10, payee une fois : un telephone en avance
 * ouvrait les statistiques d apres-match avant le coup d envoi. La fenetre
 * d appel a exactement le meme defaut potentiel, en pire — elle autorise une
 * ECRITURE.
 *
 * ⛔ Aucune fonction de ce fichier n appelle `Date.now()` ni `new Date()` sans
 * argument. L instant courant ARRIVE en parametre (`serverNowMs`), il ne se
 * lit pas. Les seuls `new Date(valeur)` presents sont des ANALYSEURS de chaine.
 */

import { getServerErrorCode } from '@/utils/errors/displayError';

const MINUTE_MS = 60 * 1000;
const DAY_MINUTES = 24 * 60;

/**
 * Repli — duree retenue quand l evenement ne declare ni fin ni heure de fin.
 *
 * 90, comme la valeur du service qui borne L APPEL
 * (`admin/src/api/event-attendance/services/event-attendance.ts`,
 * `defaultDurationMinutes: 90`).
 *
 * ⚠️ `eventMatchClock.js` porte la MEME valeur depuis le lot P5, mais pour une
 * AUTRE question — celle des statistiques d apres-match, servie par un autre
 * service serveur (`match-stats-report.ts`). Les deux repondent 90 aujourd hui ;
 * ce sont deux reglages distincts, et les confondre casserait l un ou l autre.
 */
export const FALLBACK_DURATION_MINUTES = 90;

/** Repli — minutes d ouverture avant le debut (defaut serveur). */
export const FALLBACK_BEFORE_MINUTES = 30;

/** Repli — minutes de fermeture apres la fin (defaut serveur). */
export const FALLBACK_AFTER_MINUTES = 120;

/** Le code que le serveur renvoie quand la fenetre est fermee. */
export const WINDOW_CLOSED_CODE = 'EVENT_ATTENDANCE_WINDOW_CLOSED';

/** Plafond serveur d un envoi groupe (`BULK_ARRIVAL_MAX_USERS`). */
export const BULK_MAX_USERS = 100;

const TIME_OF_DAY_RE = /^(\d{1,2}):(\d{2})/;

/**
 * @typedef {object} AttendanceWindow
 * @property {number | null} closesAtMs - Fin de la fenetre, en ms.
 * @property {boolean} enabled - `false` quand l evenement n est pas bornable.
 * @property {number | null} opensAtMs - Debut de la fenetre, en ms.
 * @property {'fallback' | 'server'} source - Qui a calcule cette fenetre.
 */

/**
 * @typedef {object} BulkFailure
 * @property {string} code - Le code serveur du refus.
 * @property {string} message - Le message brut du serveur.
 * @property {string} userDocumentId - La personne refusee.
 */

/**
 * @typedef {object} BulkOutcome
 * @property {number} failedCount - Nombre de lignes refusees.
 * @property {BulkFailure[]} failures - Le detail, ligne par ligne.
 * @property {number} markedCount - Nombre de lignes reellement ecrites.
 * @property {string | null} sharedFailureCode - Le code unique, si cause unique.
 */

/**
 * Analyse une chaine ISO en millisecondes, sans jamais rendre NaN.
 * @param {unknown} value
 * @returns {number | null}
 */
export const toMsOrNull = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = new Date(/** @type {any} */ (value)).getTime();
  return Number.isNaN(parsed) ? null : parsed;
};

/**
 * Une heure « HH:MM » lue dans le fuseau DU CLUB, jamais celui du telephone.
 *
 * 🧨 MESURE DU 2026-08-23 : la machine de developpement est en Asia/Bangkok.
 * Formatee avec l horloge locale, l ouverture d un match parisien de 18:00
 * s affichait « 22:30 » au lieu de « 17:30 ». Un coach qui voyage aurait vu la
 * meme chose. Le serveur envoie deja son fuseau dans la reponse (`timezone`) :
 * c est LUI qui fait foi, et le repli est celui du serveur.
 *
 * 🧭 Le mecanisme (`Intl.DateTimeFormat` + `timeZone`) n est pas invente ici :
 * c est exactement celui de `src/utils/parisTime.js`, deja en production.
 * @param {unknown} instant - Un instant ISO ou en millisecondes.
 * @param {string} [timeZone] - Le fuseau du club, rendu par la reponse.
 * @returns {string} - « 17:30 », ou une chaine vide si l instant est illisible.
 */
export const formatTimeInZone = (instant, timeZone) => {
  const ms = toMsOrNull(instant);
  if (ms === null) return '';
  return new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    timeZone: timeZone || 'Europe/Paris',
  }).format(new Date(ms));
};

/**
 * Une date courte « mer. 19/08 » lue dans le fuseau DU CLUB.
 *
 * Meme raison que `formatTimeInZone` : un match du mercredi 19 a 23:30 heure
 * de Paris est deja le jeudi 20 pour un telephone a Bangkok.
 * @param {unknown} instant - Un instant ISO ou en millisecondes.
 * @param {string} [timeZone] - Le fuseau du club.
 * @returns {string} - « mer. 19/08 », ou une chaine vide.
 */
export const formatShortDateInZone = (instant, timeZone) => {
  const ms = toMsOrNull(instant);
  if (ms === null) return '';
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    timeZone: timeZone || 'Europe/Paris',
    weekday: 'short',
  }).format(new Date(ms));
};

/**
 * Minutes depuis minuit d une heure « HH:MM », ou `null`.
 * @param {unknown} value
 * @returns {number | null}
 */
const toMinutesOfDay = (value) => {
  const match = TIME_OF_DAY_RE.exec(String(value || ''));
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (hours > 23 || minutes > 59) return null;
  return (hours * 60) + minutes;
};

/**
 * Duree de l evenement, en minutes, deduite de `startTime` et `endTime`.
 *
 * 🧭 POURQUOI PAR LA DIFFERENCE, ET PAS EN RECONSTRUISANT UNE DATE : `endTime`
 * est une heure MURALE dans le fuseau du club (Europe/Paris cote serveur).
 * Reconstruire un instant a partir d elle obligerait l app a connaitre ce
 * fuseau — donc a se tromper des qu un utilisateur voyage. La DIFFERENCE entre
 * deux heures murales du meme jour, elle, ne depend d aucun fuseau.
 * 🧨 MESURE DU 2026-08-23 : exiger `startTime` etait un BUG. Un evenement
 * porte tres souvent son heure de debut dans `date` seul — `startTime` ne fait
 * que COMPLETER une heure manquante, cote serveur comme ici. Sans lui, la
 * duree retombait sur 90 min : pour un match 18:00-20:00, la feuille de
 * cloture annoncait le passage du serveur a 19:43 au lieu de 20:13, soit
 * AVANT la fin du match. L heure murale du debut se lit donc dans `date`,
 * rendue dans le fuseau du club.
 * @param {{ endTime?: unknown, startTime?: unknown }} event
 * @param {{ startAtMs?: number | null, timeZone?: string }} [contexte]
 * @returns {number | null}
 */
export const resolveDurationMinutes = (event, contexte = {}) => {
  const endMinutes = toMinutesOfDay(event?.endTime);
  if (endMinutes === null) return null;

  const startMinutes = toMinutesOfDay(event?.startTime)
    ?? toMinutesOfDay(formatTimeInZone(contexte.startAtMs, contexte.timeZone));
  if (startMinutes === null) return null;
  const delta = endMinutes - startMinutes;
  return delta > 0 ? delta : delta + DAY_MINUTES;
};

/**
 * La FIN de l evenement : `endDate`, sinon `endTime`, sinon 90 minutes.
 *
 * C est la meme cascade que le serveur (`resolveEventEndAt`), et elle sert a
 * deux endroits : le repli de la fenetre, et la feuille de cloture qui doit
 * annoncer a quelle heure le cron passera les non-pointes en « Non pointé ».
 * @param {{ event?: any, payloadData?: any }} input
 * @returns {number | null}
 */
export const resolveEventEndMs = ({ event, payloadData }) => {
  const startAtMs = toMsOrNull(payloadData?.eventStartAt) ?? toMsOrNull(event?.date);
  if (startAtMs === null) return null;

  const explicitEndMs = toMsOrNull(event?.endDate);
  if (explicitEndMs !== null && explicitEndMs > startAtMs) return explicitEndMs;

  const durationMinutes = resolveDurationMinutes(event, {
    startAtMs, timeZone: payloadData?.timezone,
  }) ?? FALLBACK_DURATION_MINUTES;
  return startAtMs + (durationMinutes * MINUTE_MS);
};

/**
 * Les minutes de l heure auxquelles le cron de fin de match tourne.
 *
 * 🕐 `eventAbsenceFinalizationGovernance` est programme `13,43 * * * *`
 * (`admin/config/cron/tasks.ts`) : deux passages par heure, a :13 et a :43.
 * Les minutes d une heure ne dependent d aucun fuseau a decalage entier —
 * Paris en est un — donc ce calcul est juste sans connaitre le fuseau.
 */
export const CRON_SWEEP_MINUTES = [13, 43];

/**
 * Le PREMIER passage du cron apres la fin du match.
 *
 * ⚠️ C est ce que la feuille de cloture doit dire : le bouton « Clôturer » ne
 * passe personne en « Non pointé » — aucune route de cloture n existe. C est
 * ce passage-la qui le fera. Annoncer le contraire ferait du bouton un
 * MENTEUR : il rendrait la main sans avoir rien ecrit.
 * @param {number | null} endAtMs - La fin du match, en millisecondes.
 * @returns {number | null}
 */
export const resolveNoShowSweepMs = (endAtMs) => {
  if (!Number.isFinite(endAtMs)) return null;
  const fin = new Date(Number(endAtMs));
  const [an, mois, jour, heure] = [
    fin.getUTCFullYear(), fin.getUTCMonth(), fin.getUTCDate(), fin.getUTCHours(),
  ];
  const debutHeure = Date.UTC(an, mois, jour, heure);
  const candidats = [
    ...CRON_SWEEP_MINUTES.map((minute) => debutHeure + (minute * MINUTE_MS)),
    // Si la fin tombe apres :43, le passage suivant est le :13 de l heure d apres.
    ...CRON_SWEEP_MINUTES.map((minute) => debutHeure + ((60 + minute) * MINUTE_MS)),
  ];
  return candidats.find((instant) => instant >= Number(endAtMs)) ?? null;
};

/**
 * LA FENETRE D APPEL — celle du serveur, ou un repli qui dit son nom.
 *
 * Le serveur l expose desormais dans la reponse de `list` (`data.window`).
 * C est la SEULE source juste : trois causes de divergence ont ete mesurees le
 * 2026-08-23 entre son calcul et un recalcul cote app — `endTime` que l app
 * ignorait, les minutes reglables par variable d environnement, et le fuseau
 * du club. Le repli n existe que pour un serveur plus ancien, et il se
 * DECLARE (`source: 'fallback'`) pour que l ecran puisse le dire.
 * @param {{ event?: any, payloadData?: any }} input
 * @returns {AttendanceWindow}
 */
export const resolveAttendanceWindow = ({ event, payloadData }) => {
  const serverWindow = payloadData?.window;
  if (serverWindow && typeof serverWindow === 'object') {
    const opensAtMs = toMsOrNull(serverWindow.opensAt);
    const closesAtMs = toMsOrNull(serverWindow.closesAt);
    return {
      closesAtMs,
      enabled: Boolean(serverWindow.enabled) && opensAtMs !== null && closesAtMs !== null,
      opensAtMs,
      source: 'server',
    };
  }

  const startAtMs = toMsOrNull(payloadData?.eventStartAt) ?? toMsOrNull(event?.date);
  if (startAtMs === null) {
    return {
      closesAtMs: null, enabled: false, opensAtMs: null, source: 'fallback',
    };
  }

  const endAtMs = resolveEventEndMs({ event, payloadData }) ?? startAtMs;

  return {
    closesAtMs: endAtMs + (FALLBACK_AFTER_MINUTES * MINUTE_MS),
    enabled: true,
    opensAtMs: startAtMs - (FALLBACK_BEFORE_MINUTES * MINUTE_MS),
    source: 'fallback',
  };
};

/**
 * Dans quel mode l ecran se rend : `before` = cadre 2A, `open` = 2B/2C,
 * `closed` = la fenetre est passee.
 *
 * ⛔ Sans horloge serveur, la reponse est `before` : afficher l heure
 * d ouverture a quelqu un qui pouvait deja pointer est un desagrement ; lui
 * ouvrir un appel que le serveur refusera ligne par ligne est un mensonge.
 * @param {{ serverNowMs: number | null | undefined, window: AttendanceWindow }} input
 * @returns {'before' | 'closed' | 'open'}
 */
export const resolveCallMode = ({ serverNowMs, window: attendanceWindow }) => {
  if (!attendanceWindow?.enabled) return 'open';
  if (!Number.isFinite(serverNowMs)) return 'before';

  const now = Number(serverNowMs);
  const { closesAtMs, opensAtMs } = attendanceWindow;
  if (opensAtMs !== null && now < opensAtMs) return 'before';
  if (closesAtMs !== null && now > closesAtMs) return 'closed';
  return 'open';
};

/**
 * L instant serveur, avance par le temps ecoule depuis sa reception.
 * @param {{ elapsedMs?: number, serverNowIso?: unknown }} input
 * @returns {number | null}
 */
export const resolveServerClockMs = ({ elapsedMs = 0, serverNowIso }) => {
  const baseMs = toMsOrNull(serverNowIso);
  if (baseMs === null) return null;
  return baseMs + (Number.isFinite(elapsedMs) ? Number(elapsedMs) : 0);
};

/**
 * Le bilan d un envoi groupe, lu LIGNE PAR LIGNE.
 *
 * 🧨 Le serveur repond HTTP 200 meme quand il a tout refuse : hors fenetre, il
 * rend `markedCount: 0` et N lignes en erreur (la fenetre est testee PAR
 * PERSONNE). Un ecran qui ne lirait que le code HTTP annoncerait « 22 pointes »
 * sans avoir rien ecrit.
 *
 * Et quand les N refus portent le MEME code, l ecran doit UNE phrase, pas
 * vingt-deux : c est une seule cause.
 * @param {any} response
 * @returns {BulkOutcome}
 */
export const summarizeBulkOutcome = (response) => {
  const data = response?.data ?? response;
  const items = /** @type {any[]} */ (Array.isArray(data?.items) ? data.items : []);
  const failures = items
    .filter((/** @type {any} */ item) => item && item.ok === false)
    .map((/** @type {any} */ item) => ({
      code: String(item?.error?.code || ''),
      message: String(item?.error?.message || ''),
      userDocumentId: String(item?.userDocumentId || ''),
    }));

  const codes = Array.from(new Set(failures.map((/** @type {any} */ failure) => failure.code)));
  return {
    failedCount: Number.isFinite(data?.failedCount) ? Number(data.failedCount) : failures.length,
    failures,
    markedCount: Number.isFinite(data?.markedCount) ? Number(data.markedCount) : 0,
    sharedFailureCode: codes.length === 1 ? codes[0] : null,
  };
};

/**
 * Un pointage a-t-il eu lieu pour cette ligne ?
 *
 * 🔒 C est `arrivedAt` qui fait foi, jamais le statut : apres le passage du
 * cron de fin de match, un non-pointe arrive en `no_show` alors que la fenetre
 * est encore ouverte 2 h. Il reste pointable, et « Tout depointer » ne doit
 * surtout pas le viser — un `reset` effacerait AUSSI la declaration que le
 * joueur avait faite lui-meme.
 * @param {any} item
 * @returns {boolean}
 */
export const isMarked = (item) => Boolean(item?.attendance?.arrivedAt);

/**
 * Cette ligne a-t-elle ete finalisee « Non pointe » par le cron de fin ?
 * Elle reste POINTABLE tant que la fenetre est ouverte : un `coachArrival`
 * ecrase `no_show`.
 * @param {any} item
 * @returns {boolean}
 */
export const isNoShow = (item) => item?.attendanceStatus === 'no_show' && !isMarked(item);

/**
 * Les compteurs de REPONSES (echelle du cadre 2A — avant l heure).
 * @param {any[]} items
 * @returns {{ answeredNo: number, answeredYes: number, unanswered: number }}
 */
export const countAnswers = (items) => (items || []).reduce((totals, item) => {
  const answer = item?.rsvpStatus;
  if (answer === 'participating') return { ...totals, answeredYes: totals.answeredYes + 1 };
  if (answer === 'missing') return { ...totals, answeredNo: totals.answeredNo + 1 };
  return { ...totals, unanswered: totals.unanswered + 1 };
}, { answeredNo: 0, answeredYes: 0, unanswered: 0 });

/**
 * Les compteurs de PRESENCE REELLE (echelle des cadres 2B/2C).
 *
 * ⚠️ « Reponse ≠ presence » : ces trois-la ne se montrent JAMAIS en meme temps
 * que les trois du dessus. C est la confusion majeure que la planche 02 corrige.
 * @param {any[]} items
 * @returns {{ arrived: number, late: number, waiting: number }}
 */
export const countPresence = (items) => (items || []).reduce((totals, item) => {
  if (!isMarked(item)) return { ...totals, waiting: totals.waiting + 1 };
  const lateMinutes = Number(item?.attendance?.lateMinutes || 0);
  if (item?.isLate || lateMinutes > 0) return { ...totals, late: totals.late + 1 };
  return { ...totals, arrived: totals.arrived + 1 };
}, { arrived: 0, late: 0, waiting: 0 });

/**
 * Les personnes que le coach n a jamais vues — celles que la cloture nomme.
 * @param {any[]} items
 * @returns {any[]}
 */
export const listNeverSeen = (items) => (items || []).filter((item) => !isMarked(item));

/**
 * Les lignes « sans reponse » : l onglet du cadre 2C.
 * @param {any[]} items
 * @returns {any[]}
 */
export const listUnanswered = (items) => (items || []).filter(
  (item) => item?.rsvpStatus !== 'participating' && item?.rsvpStatus !== 'missing',
);

/**
 * Les identifiants a envoyer a `bulk` : les NON pointes de la liste donnee.
 * @param {any[]} items
 * @returns {string[]}
 */
export const listUnmarkedIds = (items) => (items || [])
  .filter((item) => !isMarked(item))
  .map((item) => String(item?.user?.documentId || ''))
  .filter(Boolean);

/**
 * Les identifiants a DEPOINTER : uniquement les lignes qui portent un
 * `arrivedAt`. Viser les autres effacerait la declaration du joueur pour rien.
 * @param {any[]} items
 * @returns {string[]}
 */
export const listMarkedIds = (items) => (items || [])
  .filter(isMarked)
  .map((item) => String(item?.user?.documentId || ''))
  .filter(Boolean);

/**
 * Decoupe une liste d identifiants en paquets acceptes par le serveur.
 * @param {string[]} userIds
 * @returns {string[][]}
 */
export const chunkUserIds = (userIds) => {
  const chunks = [];
  const source = userIds || [];
  for (let index = 0; index < source.length; index += BULK_MAX_USERS) {
    chunks.push(source.slice(index, index + BULK_MAX_USERS));
  }
  return chunks;
};

/**
 * Le retard, en minutes, deduit d une heure d arrivee MURALE saisie a la main
 * (le palier « Autre heure » du cadre 2E).
 *
 * 🧭 Meme principe que `resolveDurationMinutes` : on compare deux heures
 * murales du meme jour, ce qui ne depend d aucun fuseau. Une heure anterieure
 * au debut se lit comme le lendemain — un tournoi qui commence a 23:00 et un
 * joueur qui arrive a 00:15 font +75 min, pas -1365.
 * @param {{ arrivalTime: unknown, eventStartMs: number | null, timeZone?: string }} input
 * @returns {number | null}
 */
export const resolveLateMinutesFromArrivalTime = ({ arrivalTime, eventStartMs, timeZone }) => {
  const arrivalMinutes = toMinutesOfDay(arrivalTime);
  if (arrivalMinutes === null) return null;
  const startMinutes = toMinutesOfDay(formatTimeInZone(eventStartMs, timeZone));
  if (startMinutes === null) return null;
  const delta = arrivalMinutes - startMinutes;
  return delta >= 0 ? delta : delta + DAY_MINUTES;
};

/**
 * L heure d arrivee a ENVOYER pour un retard constate.
 *
 * 🧨 Sans `arrivedAt`, le serveur pose SON instant courant — meme quand
 * `lateMinutes` vaut 10. L ecran afficherait alors « Arrivé +10 min à 18:42 »
 * pour un match de 18:00. L heure se calcule donc ici, depuis le DEBUT.
 * @param {{ eventStartMs: number | null, lateMinutes: number }} input
 * @returns {string | null}
 */
export const buildArrivedAtIso = ({ eventStartMs, lateMinutes }) => {
  if (!Number.isFinite(eventStartMs)) return null;
  const minutes = Number.isFinite(lateMinutes) ? Math.max(0, Number(lateMinutes)) : 0;
  return new Date(Number(eventStartMs) + (minutes * MINUTE_MS)).toISOString();
};

/**
 * La phrase FRANCAISE d un refus serveur.
 *
 * ⛔ Le serveur repond en anglais brut (« Attendance can only be marked from 30
 * minutes before… ») : la laisser passer telle quelle mettrait de l anglais
 * sous le doigt d un coach au bord d un terrain. Le code, lui, est stable.
 * @param {any} error
 * @param {(key: string, fallback: string) => string} t
 * @returns {string}
 */
export const describeAttendanceError = (error, t) => {
  const code = getServerErrorCode(error);
  if (code === WINDOW_CLOSED_CODE) {
    return t(
      'eventDetails.attendanceCall.errors.windowClosed',
      "L'appel est fermé. Il reste ouvert jusqu'à 2 h après la fin"
      + " de l'événement.",
    );
  }
  return t(
    'eventDetails.attendanceCall.errors.generic',
    "Impossible d'enregistrer le pointage. Réessaie dans un instant.",
  );
};

/**
 * La phrase qui resume un envoi groupe — UNE seule quand la cause est unique.
 *
 * 🧨 22 refus pour la meme raison, c est UNE phrase. En afficher 22 rendrait
 * l ecran illisible au moment precis ou le coach a besoin de comprendre vite.
 * @param {{ failedCount: number, failures: Array<{ code: string }>, markedCount: number }} summary
 * @param {(key: string, fallback: string) => string} t
 * @returns {string}
 */
export const describeBulkOutcome = (summary, t) => {
  const marked = Number(summary?.markedCount || 0);
  const failed = Number(summary?.failedCount || 0);
  if (failed === 0) {
    return t('eventDetails.attendanceCall.bulk.allMarked', 'Tout le monde est pointé.');
  }

  const codes = Array.from(new Set((summary?.failures || []).map((failure) => failure.code)));
  if (codes.length === 1 && codes[0] === WINDOW_CLOSED_CODE) {
    return t(
      'eventDetails.attendanceCall.bulk.windowClosed',
      "Personne n'a été pointé : l'appel n'est pas ouvert en ce moment.",
    );
  }
  if (codes.length === 1 && marked === 0) {
    return t(
      'eventDetails.attendanceCall.bulk.allRefused',
      "Personne n'a été pointé : le serveur a refusé pour la même raison.",
    );
  }
  const reste = t(
    'eventDetails.attendanceCall.bulk.partial',
    'pointé·e·s, le reste a été refusé.',
  );
  return `${marked} ${reste}`;
};
