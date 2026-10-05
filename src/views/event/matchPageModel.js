import localeDesFormats from '@/theme/strings/localeDesFormats';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';

import { buildMatchEncartLines } from './matchEncartLines';

/**
 * ST-VUES3-ORDI (03/10) — LA PAGE DU MATCH, PARTAGÉE PAR LE TÉLÉPHONE ET LE SITE.
 *
 * Le téléphone (`EventDetails.js`) calculait ces règles dans ses propres `useMemo` ; le site
 * (`EventDetails.web.js`) en avait des copies plus anciennes, ou rien (l'encart du score,
 * la carte « Après le match », la puce « Stats du match » du menu Gérer). Elles sortent ici,
 * TELLES QUELLES, pour que les deux surfaces n'aient qu'un seul juge : une règle recopiée
 * diverge au premier changement (le motif a déjà coûté D08, D22, D40, D48).
 *
 * Fonctions PURES : aucune requête, aucun état, aucune navigation.
 */

/**
 * @typedef {(key: string, fallback?: any, options?: any) => string} Traduire
 */

/**
 * 🔄 N3 (D3) — QUI REGARDE CE MATCH ? Le même match est « à domicile » pour l'équipe
 * organisatrice et « à l'extérieur » pour l'invitée : le score et le verdict s'inversent
 * pour elle. 🧨 R2 — deux équipes du MÊME club ne s'affrontent pas : rien ne s'inverse.
 * @param {{ compositionTeamId?: string | null, event: any }} params - L'équipe du lecteur.
 * @returns {boolean} Vrai si le lecteur est de l'équipe invitée (d'un autre club).
 */
export const resolveViewerFromInvitedTeam = ({ compositionTeamId = null, event }) => {
  const organizerTeamId = event?.team?.documentId || null;
  const currentTeamId = compositionTeamId || organizerTeamId || null;
  if (!organizerTeamId || !currentTeamId || organizerTeamId === currentTeamId) return false;

  const organizerClubId = event?.team?.club?.documentId || event?.club?.documentId || null;
  const viewerTeam = (event?.invitedTeams || [])
    .find((/** @type {any} */ team) => team?.documentId === currentTeamId);
  const viewerClubId = viewerTeam?.club?.documentId || null;
  if (organizerClubId && viewerClubId && organizerClubId === viewerClubId) return false;

  return true;
};

/**
 * ST-MATCH (écrans 1 et 7) — « Karim n'a pas encore saisi le score », « Le bilan de Karim ».
 * @param {any} team - L'équipe du match.
 * @returns {string | null} Le prénom du premier entraîneur, ou rien.
 */
export const resolveTeamCoachFirstname = (team) => String(
  team?.trainers?.[0]?.firstname || '',
).trim() || null;

/**
 * ST-MATCH (écran 1, état 1) — « VS » et l'heure du coup d'envoi, au centre.
 * @param {any} event - L'événement.
 * @param {string} [locale] - Les formats de l'appareil.
 * @returns {string | null} « 19:00 », ou rien.
 */
export const resolveMatchStartTimeLabel = (event, locale = localeDesFormats()) => {
  if (event?.startTime) return String(event.startTime).substring(0, 5);
  if (!event?.date) return null;
  const startAt = new Date(event.date);
  return Number.isNaN(startAt.getTime())
    ? null
    : startAt.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
};

/**
 * 🎯 ST-MATCH (écrans 7 et 8) — « Tout s'ouvre à la fin du match, sam. 5 sept. à 20:00 ».
 * @param {{ eventEndedAt?: Date | null, locale?: string, t: Traduire }} params - La fin.
 * @returns {string} « sam. 5 sept. à 20:00 », ou vide si la fin est inconnue.
 */
export const formatMatchEndLabel = ({ eventEndedAt, locale = localeDesFormats(), t }) => {
  if (!eventEndedAt || Number.isNaN(eventEndedAt.getTime())) return '';
  return t('stMatch.carte.endLabel', '{{day}} à {{time}}', {
    day: eventEndedAt.toLocaleDateString(locale, {
      day: 'numeric', month: 'short', weekday: 'short',
    }),
    time: eventEndedAt.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }),
    ...SANS_ECHAPPEMENT,
  });
};

/**
 * 🗣️ N4 (D6) / ST-MATCH (écran 8) — LA PORTE « STATS DU MATCH » : ouverte ou fermée, et
 * sa note dans le langage de la carte (« Étape 1 sur 3 : le score », « Feuille publiée le
 * 1 oct. à 22:39 », « S'ouvre à la fin du match, sam. 5 sept. à 20:00 », et au dirigeant
 * qui n'entraîne pas — « score A » — QUI saisit). `disabled` et `isScoreEntry` portent le
 * droit et l'aiguillage, et ils ne vivent qu'ici.
 * @param {{
 *   canManage: boolean, coachFirstname?: string | null, endLabel?: string,
 *   finalizedAt?: string | null, isFinal: boolean, isFinished: boolean,
 *   isReviewRequired: boolean, locale?: string, scoreAvailable: boolean, t: Traduire,
 *   waitingOfficial: boolean,
 * }} params - L'état du match et le droit du lecteur.
 * @returns {{ disabled: boolean, isScoreEntry?: boolean, subtitle: string }} La porte.
 */
export const resolveMatchStatsDoor = ({
  canManage,
  coachFirstname = null,
  endLabel = '',
  finalizedAt = null,
  isFinal,
  isFinished,
  isReviewRequired,
  locale = localeDesFormats(),
  scoreAvailable,
  t,
  waitingOfficial,
}) => {
  if (!isFinished) {
    return {
      disabled: true,
      subtitle: endLabel
        ? t('stMatch.gerer.opensAt', 'S’ouvre à la fin du match, {{when}}', {
          when: endLabel, ...SANS_ECHAPPEMENT,
        })
        : t('stMatch.gerer.opensAtEnd', 'S’ouvre à la fin du match'),
    };
  }
  if (waitingOfficial) {
    return {
      disabled: true,
      subtitle: t(
        'eventDetails.waitingForTheSyncedOfficial',
        'En attente du score officiel synchronise.',
      ),
    };
  }
  const publiee = finalizedAt ? new Date(finalizedAt) : null;
  const reportFinalisedSubtitle = publiee && !Number.isNaN(publiee.getTime())
    ? t('stMatch.gerer.publishedOn', 'Feuille publiée le {{date}} à {{time}}', {
      date: publiee.toLocaleDateString(locale, { day: 'numeric', month: 'short' }),
      time: publiee.toLocaleTimeString(locale, {
        hour: '2-digit', minute: '2-digit',
      }),
      ...SANS_ECHAPPEMENT,
    })
    : t('stMatch.gerer.published', 'Feuille publiée');
  // 🔒 SECU-STATS — L'ÉDITEUR EST L'OUTIL DE L'ENCADREMENT (l'avis du coach et
  // l'auto-évaluation de CHAQUE joueur) : ce test passe AVANT les deux suivants.
  // 🏛️ « score A » (Adel, 02/10) : le dirigeant qui n'entraîne pas ne saisit pas ; la note
  // lui dit QUI saisit.
  if (!canManage) {
    return {
      disabled: true,
      subtitle: coachFirstname
        ? t('stMatch.gerer.managerWho', 'Saisies par l’entraîneur de l’équipe, {{name}}', {
          name: coachFirstname, ...SANS_ECHAPPEMENT,
        })
        : t('stMatch.gerer.managerWhoUnnamed', 'Saisies par l’entraîneur de l’équipe'),
    };
  }
  if (isReviewRequired) {
    return {
      disabled: false,
      subtitle: t('stMatch.gerer.review', 'Score officiel changé : vérifie la feuille'),
    };
  }
  if (isFinal) {
    return { disabled: false, subtitle: reportFinalisedSubtitle };
  }
  if (scoreAvailable) {
    return {
      disabled: false,
      subtitle: t('stMatch.gerer.stepSheet', 'Étape 2 sur 3 : la feuille'),
    };
  }
  // AD01 (✍️) — LE SEUL CAS QUE LA FEUILLE COURTE DU TÉLÉPHONE DÉTOURNE.
  return {
    disabled: false,
    isScoreEntry: true,
    subtitle: t('stMatch.gerer.stepScore', 'Étape 1 sur 3 : le score'),
  };
};

/**
 * 🧮 FINITIONS11 · points 4 et 6 — QUI EST ATTENDU après un match : un joueur CONVOQUÉ
 * (« c oui » : `convoked === false` = hors convocation) qui a un COMPTE (un joueur ajouté à la
 * main a `userDocumentId: null` : il ne peut ni répondre, ni être relancé). C'est LE compte
 * de « N sur M ont répondu », partout (« compte A », Adel 03/10), et la règle de la relance.
 * Un serveur d'avant ne marque ni l'un ni l'autre : tout le monde reste attendu.
 * @param {any} item - Une ligne de `playerResponses`.
 * @returns {boolean} Vrai si le joueur a un compte (ou si le serveur ne le dit pas).
 */
export const hasResponderAccount = (item) => !(
  item && 'userDocumentId' in item && !item.userDocumentId
);

/**
 * La règle d'attente (voir plus haut) : convoqué, et un compte.
 * @param {any} item - Une ligne de `playerResponses`.
 * @returns {boolean} Vrai si sa réponse est attendue.
 */
export const isAwaitedResponder = (item) => item?.convoked !== false && hasResponderAccount(item);

/**
 * 🔔 FINITIONS11 · point 4 (écran 7) — CEUX QUE LE SERVEUR RELANCERA, et eux seuls
 * (`remindEventMissingResponses`) : attendus, et sans réponse envoyée.
 * @param {unknown} playerResponses - `matchStatsPayload.playerResponses`.
 * @returns {any[]} Les réponses attendues et pas encore envoyées.
 */
const listResponsesToRemind = (playerResponses) => (
  Array.isArray(playerResponses) ? playerResponses : []
).filter((/** @type {any} */ item) => item?.status !== 'submitted' && isAwaitedResponder(item));

/**
 * 🔔 FINITIONS11 · point 4 — « Relancer les N » : N = ceux que le serveur relancera (la liste
 * des prénoms est coupée à 5 + « +N », elle ne se compte pas).
 * @param {unknown} playerResponses - `matchStatsPayload.playerResponses`.
 * @returns {number} Le nombre de joueurs à relancer.
 */
export const countPlayersToRemind = (playerResponses) => (
  listResponsesToRemind(playerResponses).length
);

/**
 * 📋 FINITIONS11 · point 6 bis — « Convoqués : » ne se dit que si une convocation est
 * publiée : le serveur marque alors chaque ligne `convoked` vrai ou faux (`null` sans
 * convocation, rien chez un serveur d'avant).
 * @param {unknown} playerResponses - `matchStatsPayload.playerResponses`.
 * @returns {boolean} Vrai si une convocation est publiée.
 */
export const hasPublishedConvocation = (playerResponses) => (
  Array.isArray(playerResponses) ? playerResponses : []
).some((/** @type {any} */ item) => typeof item?.convoked === 'boolean');

/**
 * 📋 FINITIONS11 · point 6 bis — « listes ok » (Adel, 03/10) : « Aussi présents, sans
 * convocation : Lucas, Nathan ». Un joueur NON convoqué (`convoked === false`, avec un compte :
 * un joueur ajouté à la main est DANS la convocation) qui est VENU : sa réponse le dit
 * (« j'ai joué », « présent sans jouer ») ou l'entraîneur lui a mis des minutes sur la feuille.
 * Aucune lecture neuve : tout est dans la charge de la feuille. 5 prénoms au plus, puis « +N ».
 * @param {unknown} playerResponses - `matchStatsPayload.playerResponses`.
 * @param {unknown} playerLines - `matchStatsPayload.report.playerLines`.
 * @returns {string[]} Les prénoms, et « +N » s'il y en a plus de 5.
 */
export const listPresentWithoutConvocation = (playerResponses, playerLines) => {
  const avecMinutes = new Set((Array.isArray(playerLines) ? playerLines : [])
    .filter((/** @type {any} */ ligne) => Number(ligne?.minutesPlayed) > 0)
    .map((/** @type {any} */ ligne) => String(
      ligne?.userDocumentId || ligne?.user?.documentId || ligne?.player?.documentId || '',
    ))
    .filter(Boolean));
  const prenoms = (Array.isArray(playerResponses) ? playerResponses : [])
    .filter((/** @type {any} */ item) => item?.convoked === false
      && Boolean(item?.userDocumentId)
      && (['played', 'present_no_play'].includes(item?.participation)
        || avecMinutes.has(String(item.userDocumentId))))
    .map((/** @type {any} */ item) => String(item?.label || '').trim().split(/\s+/)[0])
    .filter(Boolean);
  return prenoms.length > 5 ? [...prenoms.slice(0, 5), `+${prenoms.length - 5}`] : prenoms;
};

/**
 * 🎯 ST-MATCH (écran 7, amélioration 3) — l'étape 3 NOMME qui manque : 5 prénoms au plus,
 * puis « +N ». La feuille de l'encadrement porte la liste (le joueur n'en reçoit que le
 * compte : SECU-STATS). FINITIONS11 · point 4 : les mêmes que la relance (convoqués, avec
 * un compte).
 * @param {unknown} playerResponses - `matchStatsPayload.playerResponses`.
 * @returns {string[]} Les prénoms, et « +N » s'il y en a plus de 5.
 */
export const listMissingResponders = (playerResponses) => {
  const prenoms = listResponsesToRemind(playerResponses)
    .map((/** @type {any} */ item) => String(item?.label || '').trim().split(/\s+/)[0])
    .filter(Boolean);
  return prenoms.length > 5 ? [...prenoms.slice(0, 5), `+${prenoms.length - 5}`] : prenoms;
};

/**
 * 🆚 ST-MATCH (écran 1) — CE QUE L'ENCART DU SCORE DIT, POUR CE LECTEUR. Le score vient de
 * la feuille (`matchStats.score`) ou, pour qui ne la lit pas (le dirigeant), du score
 * enregistré sur l'événement (`matchResult`), orienté vers le lecteur (D3). L'encart
 * existe AVANT le match (N3, D5) ; le verdict se DÉDUIT (D6) ; « Nommer l'adversaire »
 * n'existe que pour qui peut éditer et quand l'adversaire manque (D9/D10).
 * @param {{
 *   canEdit: boolean, canManage: boolean, canSeeDetails: boolean,
 *   coachFirstname?: string | null, event: any, isFinal: boolean, isFinished: boolean,
 *   isViewerFromInvitedTeam: boolean, locale?: string,
 *   onNameOpponent?: (() => void) | null, opponentName?: string, playerLines?: any,
 *   scoreState?: any, sport?: string | null, startTimeLabel?: string | null, t: Traduire,
 *   viewerDocumentId?: string | null,
 * }} params - Ce que l'écran sait du match et du lecteur.
 * @returns {any} Les lignes de l'encart, l'adversaire, le verdict et le geste « Nommer ».
 */
export const buildMatchHeaderScoreSummary = ({
  canEdit,
  canManage,
  canSeeDetails,
  coachFirstname = null,
  event,
  isFinal,
  isFinished,
  isViewerFromInvitedTeam,
  locale = localeDesFormats(),
  onNameOpponent = null,
  opponentName = '',
  playerLines = null,
  scoreState = null,
  sport = null,
  startTimeLabel = null,
  t,
  viewerDocumentId = null,
}) => {
  const storedMatchResult = event?.matchResult || null;
  const shouldInvertStoredScore = Boolean(storedMatchResult && isViewerFromInvitedTeam);

  let fallbackScoreFor = null;
  let fallbackScoreAgainst = null;
  if (storedMatchResult) {
    fallbackScoreFor = shouldInvertStoredScore
      ? storedMatchResult?.scoreAgainst
      : storedMatchResult?.scoreFor;
    fallbackScoreAgainst = shouldInvertStoredScore
      ? storedMatchResult?.scoreFor
      : storedMatchResult?.scoreAgainst;
  }
  const fallbackAvailable = fallbackScoreFor !== null
    && fallbackScoreFor !== undefined
    && fallbackScoreAgainst !== null
    && fallbackScoreAgainst !== undefined;
  const fallbackSource = storedMatchResult?.source || null;

  const available = Boolean(scoreState?.available || fallbackAvailable);
  const resolvedScoreFor = scoreState?.available ? scoreState?.scoreFor : fallbackScoreFor;
  const resolvedScoreAgainst = scoreState?.available
    ? scoreState?.scoreAgainst
    : fallbackScoreAgainst;
  const resolvedSource = scoreState?.available ? scoreState?.source : fallbackSource;
  const waitingOfficial = Boolean(
    scoreState?.waitingOfficial || (!scoreState?.available && event?.externalAutoSource),
  );

  const awaitingOpponent = !opponentName;

  let verdict = null;
  if (available) {
    const scoredFor = Number(resolvedScoreFor);
    const scoredAgainst = Number(resolvedScoreAgainst);
    if (Number.isFinite(scoredFor) && Number.isFinite(scoredAgainst)) {
      if (scoredFor > scoredAgainst) verdict = 'win';
      else if (scoredFor < scoredAgainst) verdict = 'loss';
      else verdict = 'draw';
    }
  }

  const lignes = buildMatchEncartLines({
    available,
    canManage,
    canSeeDetails,
    coachFirstname,
    isFinished,
    locale,
    publishedLines: isFinal && sport !== 'basketball' ? playerLines || null : null,
    recordedAt: scoreState?.available
      ? scoreState?.recordedAt || null
      : storedMatchResult?.savedAt || null,
    recordedBy: scoreState?.available
      ? scoreState?.recordedBy || null
      : storedMatchResult?.savedBy || null,
    scoreAgainst: resolvedScoreAgainst,
    scoreFor: resolvedScoreFor,
    source: resolvedSource,
    startTimeLabel,
    t,
    viewerDocumentId,
    waitingOfficial,
  });

  return {
    ...lignes,
    awaitingOpponent,
    onNameOpponent: canEdit && awaitingOpponent ? onNameOpponent : null,
    opponentName,
    verdict,
  };
};

/**
 * 🏷️ ST-MATCH (écran 1) — la pastille de type porte le VERDICT une fois le score connu :
 * « MATCH · TERMINÉ · VICTOIRE ».
 * @param {{ isFinished: boolean, t: Traduire, verdict?: string | null }} params - Le match.
 * @returns {string} « VICTOIRE », « NUL », « DÉFAITE », ou vide.
 */
export const resolveMatchVerdictTag = ({ isFinished, t, verdict = null }) => {
  if (!isFinished || !verdict) return '';
  return /** @type {Record<string, string>} */ ({
    draw: t('stMatch.encart.verdictTag.draw', 'NUL'),
    loss: t('stMatch.encart.verdictTag.loss', 'DÉFAITE'),
    win: t('stMatch.encart.verdictTag.win', 'VICTOIRE'),
  })[verdict] || '';
};

/**
 * 🎨 FINITIONS15 point 9e (T14, S03f) — LES PRÉCISIONS DE LA PASTILLE D'UN MATCH : le lieu avant
 * la fin, « TERMINÉ » et le verdict après. Le parent lisait « MATCH » seul : la fin se décide à
 * l'horloge du SERVEUR, que seul l'appel donne, et le parent n'y a pas accès. Quand cette
 * horloge MANQUE, un SCORE connu prouve la fin (le serveur refuse de l'enregistrer avant,
 * `ensureEventIsFinished`). Quand elle est là, elle seule décide (règle AC10).
 * Une seule règle pour le téléphone et le site. À n'appeler que pour un match.
 * @param {{ horlogeConnue?: boolean, isFinished: boolean, segmentDuLieu?: string, t: Traduire,
 *   verdict?: string | null }} params - L'horloge du serveur est-elle lue, la fin à cette horloge,
 *   le segment « À DOMICILE » / « À L'EXTÉRIEUR », le verdict.
 * @returns {string[]} Les segments, vides compris (`buildTypeTagLabel` les retire).
 */
export const resolveMatchTagSegments = ({
  horlogeConnue = false, isFinished, segmentDuLieu = '', t, verdict = null,
}) => {
  const fini = Boolean(isFinished || (!horlogeConnue && verdict));
  return [
    fini ? t('eventDetails.typeTag.matchFinished', 'TERMINÉ') : segmentDuLieu,
    resolveMatchVerdictTag({ isFinished: fini, t, verdict }),
  ];
};
