import i18next from 'i18next';

import localeDesFormats from '@/theme/strings/localeDesFormats';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';

import { isAwaitedResponder } from '@/views/event/matchPageModel';

// ==========================================================================
// 🔔 ST-MATCH (écrans 3 et 4, design des statistiques validé le 02/10) — CE
// QUE DIT LA FENÊTRE « APRÈS LE MATCH », RAPPEL PAR RAPPEL.
//
// Sorti de `MatchStatsPromptHost.js` pour être témoigné seul (le même motif
// que `matchEncartLines.js`) : ici, aucune requête, aucun état, aucun geste.
// La fenêtre lit le RAPPEL que rend le serveur (`pending-match-stats`) et,
// pour l'entraîneur, la feuille (`match-stats`) quand elle est déjà là.
// ==========================================================================

/**
 * « Sam. 5 sept. » : le jour, avec sa majuscule.
 * @param {string | null | undefined} value - Une date ISO.
 * @returns {string} Le jour, ou une chaîne vide.
 */
export const formatPromptDay = (value) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  const day = date.toLocaleDateString(localeDesFormats(), {
    day: 'numeric', month: 'short', weekday: 'short',
  });
  return day.charAt(0).toUpperCase() + day.slice(1);
};

/**
 * « 20:00 ».
 * @param {string | null | undefined} value - Une date ISO.
 * @returns {string} L'heure, ou une chaîne vide.
 */
export const formatPromptTime = (value) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString(localeDesFormats(), { hour: '2-digit', minute: '2-digit' });
};

/**
 * « Victoire 2 - 1 » : le score du rappel, vu de l'équipe, avec son verdict.
 * @param {any} score - `prompt.score`.
 * @returns {string} Le résultat, ou une chaîne vide sans score.
 */
export const describePromptResult = (score) => {
  if (!score?.available) return '';
  const scoreFor = Number(score?.scoreFor);
  const scoreAgainst = Number(score?.scoreAgainst);
  if (!Number.isFinite(scoreFor) || !Number.isFinite(scoreAgainst)) return '';
  let verdict = i18next.t('stMatch.rappel.draw', 'Nul');
  if (scoreFor > scoreAgainst) verdict = i18next.t('stMatch.rappel.win', 'Victoire');
  if (scoreFor < scoreAgainst) verdict = i18next.t('stMatch.rappel.loss', 'Défaite');
  return `${verdict} ${scoreFor} - ${scoreAgainst}`;
};

/**
 * « Sam. 5 sept., fin à 20:00 » (et « U15 · » devant, pour l'entraîneur).
 * @param {any} prompt - Le rappel.
 * @param {{ withTeam?: boolean }} [options] - Nommer l'équipe devant.
 * @returns {string} La ligne de date.
 */
export const describePromptWhen = (prompt, { withTeam = false } = {}) => {
  const day = formatPromptDay(prompt?.endedAt || prompt?.updatedAt);
  const time = formatPromptTime(prompt?.endedAt);
  const when = day && time
    ? i18next.t('stMatch.rappel.endedAt', '{{day}}, fin à {{time}}', {
      day, time, ...SANS_ECHAPPEMENT,
    })
    : day;
  const team = withTeam ? String(prompt?.team?.name || '').trim() : '';
  return [team, when].filter(Boolean).join(' · ');
};

/**
 * Les chiffres d'un brouillon de joueur (« 90 minutes · 1 but · 0 passe · — ta note »).
 * @param {any} response - `prompt.personalResponse`.
 * @param {string} sport - 'football' ou 'basketball'.
 * @returns {Array<{ key: string, label: string, value: string }>} Les quatre cases.
 */
export const buildDraftFigures = (response, sport) => {
  const payload = response?.sportPayload || {};
  const count = (/** @type {unknown} */ value) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  };
  const isFootball = sport !== 'basketball';
  const second = isFootball ? count(payload.goals) : count(payload.points);
  const third = count(payload.assists);
  const rating = Number(response?.selfRating);
  return [
    {
      key: 'minutes',
      label: i18next.t('stMatch.rappel.figures.minutes', 'minutes'),
      value: String(count(response?.minutesPlayed)),
    },
    {
      key: 'main',
      label: isFootball
        ? i18next.t('stMatch.rappel.figures.goals', {
          count: second, defaultValue_one: 'but', defaultValue_other: 'buts',
        })
        : i18next.t('stMatch.rappel.figures.points', {
          count: second, defaultValue_one: 'point', defaultValue_other: 'points',
        }),
      value: String(second),
    },
    {
      key: 'assists',
      label: i18next.t('stMatch.rappel.figures.assists', {
        count: third, defaultValue_one: 'passe', defaultValue_other: 'passes',
      }),
      value: String(third),
    },
    {
      key: 'rating',
      label: i18next.t('stMatch.rappel.figures.myRating', 'ta note'),
      value: Number.isFinite(rating) && rating > 0 ? String(rating) : '—',
    },
  ];
};

/**
 * Ce qui reste à faire dans un brouillon de joueur, en une phrase.
 * @param {any} response - `prompt.personalResponse`.
 * @returns {string} La phrase.
 */
export const describeDraftRemaining = (response) => {
  const hasSelf = Number(response?.selfRating) > 0;
  const hasTeam = Number(response?.teamRating) > 0;
  if (!hasSelf && !hasTeam) {
    return i18next.t(
      'stMatch.rappel.draftRemainingBoth',
      'Il te reste ta note et celle de l\'équipe.',
    );
  }
  if (!hasSelf) return i18next.t('stMatch.rappel.draftRemainingSelf', 'Il te reste ta note.');
  if (!hasTeam) {
    return i18next.t('stMatch.rappel.draftRemainingTeam', 'Il te reste la note de l\'équipe.');
  }
  return i18next.t('stMatch.rappel.draftRemainingSend', 'Il te reste à l\'envoyer.');
};

/**
 * L'ÉTAPE où en est l'entraîneur (le langage de la carte « Après le match »).
 * @param {any} prompt - Le rappel `score_entry` / `coach_team_review`.
 * @returns {'score' | 'sheet' | 'draft' | 'review'} L'étape.
 */
export const resolveCoachStep = (prompt) => {
  if (prompt?.reviewRequired || prompt?.state === 'review_required') return 'review';
  // C07 / Q2-12 : en ligue, le score se saisit par la fin de match de la ligue
  // (le rappel n a pas d `eventId`, « Enregistrer » ne faisait rien).
  if (prompt?.actionType === 'score_entry') return 'score';
  if (prompt?.sourceType !== 'league' && !prompt?.score?.available) return 'score';
  if (prompt?.reportStatus === 'draft' || prompt?.state === 'draft') return 'draft';
  return 'sheet';
};

/**
 * FINITIONS11 · point 2 (écran 1, planche « Rappel d'après-match de l'entraîneur ») — le titre
 * de la fenêtre de l'entraîneur : « AS Montrivage — Test-COMPO », et « AS Montrivage —
 * adversaire à confirmer » tant qu'il est inconnu. Le serveur nomme l'adversaire
 * (`opponentName`, `null` s'il est inconnu). Un serveur d'avant ne rend pas le champ : le titre
 * d'avant (`label`) reste. Même règle que la feuille de match (`MatchStatsEditor`).
 * FINITIONS14 · point 4 — la MÊME règle titre désormais le rappel du JOUEUR (fenêtre et liste
 * des matchs en attente) et les « Retours du coach » : le serveur y nomme aussi l'adversaire.
 * @param {any} prompt - Le rappel d'entraîneur.
 * @param {string} ourSide - Le camp de gauche : le club, sinon l'équipe.
 * @returns {string} Le titre.
 */
export const describeCoachPromptTitle = (prompt, ourSide) => {
  const label = prompt?.label || 'Match';
  const serverNamesOpponent = prompt?.sourceType === 'event'
    && Object.prototype.hasOwnProperty.call(prompt || {}, 'opponentName');
  const side = String(ourSide || '').trim();
  if (!serverNamesOpponent || !side) return label;
  const opponent = String(prompt?.opponentName || '').trim();
  return [
    side,
    opponent || i18next.t('stMatch.feuille.opponentUnknown', 'adversaire à confirmer'),
  ].join(' — ');
};

/**
 * FINITIONS14 · point 4 — LE CLUB d'un rappel, camp de gauche du titre « AS Montrivage — … » :
 * lu dans les équipes du compte, celles qu'il ENTRAÎNE puis celles où il JOUE (le serveur y
 * peuple `club`). Le rappel ne porte que l'équipe ; lire le club côté serveur coûterait une
 * requête de plus (FROIDMASSE). Inconnu : chaîne vide (l'appelant met l'équipe).
 * @param {any} prompt - Le rappel (il porte `team.documentId`).
 * @param {any} userData - Le compte.
 * @returns {string} Le nom du club, ou une chaîne vide.
 */
export const findPromptClubName = (prompt, userData) => {
  const teamId = prompt?.team?.documentId;
  if (!teamId) return '';
  return String([...(userData?.trainedTeams || []), ...(userData?.myTeams || [])]
    .find((/** @type {any} */ team) => team?.documentId === teamId)?.club?.name || '').trim();
};

/**
 * « 0 sur 1 joueur a répondu ». Le rappel ne porte pas ce compte (le serveur le
 * calcule pour la feuille) : la fenêtre le lit dans la feuille de l'entraîneur
 * (`match-stats`, liste `playerResponses`), lue seulement quand elle s'ouvre.
 * FINITIONS11 · point 6 (« compte A ») : les CONVOQUÉS qui ont un compte, comme la carte.
 * @param {any} matchStats - La feuille, si elle est lue.
 * @returns {string} La phrase, ou une chaîne vide quand on ne sait pas.
 */
export const describeResponsesCount = (matchStats) => {
  const responses = Array.isArray(matchStats?.playerResponses)
    ? matchStats.playerResponses.filter(isAwaitedResponder)
    : null;
  if (!responses || !responses.length) return '';
  const total = responses.length;
  const done = responses
    .filter((/** @type {any} */ item) => item?.status === 'submitted').length;
  return i18next.t('stMatch.rappel.responsesCount', {
    count: total,
    defaultValue_one: '{{done}} sur {{count}} joueur a répondu',
    defaultValue_other: '{{done}} sur {{count}} joueurs ont répondu',
    done,
    ...SANS_ECHAPPEMENT,
  });
};
