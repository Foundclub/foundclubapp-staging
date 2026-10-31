/**
 * ST-REPONSE (02/10) — LA LOGIQUE DE « MON RETOUR DE MATCH », SANS UN SEUL ÉLÉMENT D'ÉCRAN.
 *
 * Ce qui part au serveur et ce qui bloque l'envoi se décide ici ; l'écran ne fait que
 * l'afficher. Les règles d'incohérence sont celles du serveur, une par une
 * (`admin/src/api/match-stats-report/services/match-stats-report.ts`,
 * `buildPlayerResponseConsistencyIssues`) : une règle oubliée ici, c'est un joueur qui
 * remplit tout son formulaire pour se prendre un refus à l'envoi.
 * Témoin : `__tests__/PlayerMatchResponseScreen.STREPONSE.test.js`.
 */
import { clampMatchStatsValue, getMatchStatsFieldMax } from '@/utils/matchStatsBounds';

/** Le pas des boutons « − / + » du temps de jeu : une minute à la fois n'a aucun sens. */
export const MINUTES_STEP = 5;

/**
 * Ramène un sport libre à l'une des deux familles connues.
 * @param {any} value Le sport tel que reçu.
 * @returns {'basketball' | 'football'} La famille.
 */
export const normalizeSport = (value) => (
  String(value || '').toLowerCase().includes('basket') ? 'basketball' : 'football'
);

/**
 * Le poste du profil désigne-t-il un gardien ? Le profil peut en porter plusieurs,
 * séparés par des virgules (`UserPosition`).
 * @param {any} position Le poste du profil.
 * @returns {boolean} Vrai pour un gardien.
 */
export const isGoalkeeperPosition = (position) => /gardien/i.test(String(position || ''));

/**
 * Les chiffres demandés au joueur, dans l'ordre de l'écran. « Buts encaissés » et le
 * clean sheet ne concernent que le gardien : un joueur de champ n'en a pas.
 * @param {string} sport Le sport normalisé.
 * @param {boolean} isGoalkeeper Le joueur est-il gardien ?
 * @returns {string[]} Les clés des chiffres.
 */
export const getFigureKeys = (sport, isGoalkeeper) => {
  if (normalizeSport(sport) === 'basketball') {
    return ['points', 'assists', 'rebounds', 'threePointsMade'];
  }
  return isGoalkeeper ? ['goals', 'assists', 'goalsConceded'] : ['goals', 'assists'];
};

/**
 * Les trois pastilles du temps de jeu, qui remplissent le compteur.
 * @param {string} sport Le sport normalisé.
 * @returns {Array<{ key: 'full' | 'half' | 'none', minutes: number }>} Les pastilles.
 */
export const getMinutesPresets = (sport) => {
  const full = normalizeSport(sport) === 'basketball' ? 40 : 90;
  return [
    { key: 'none', minutes: 0 },
    { key: 'half', minutes: full / 2 },
    { key: 'full', minutes: full },
  ];
};

/**
 * Lit un chiffre saisi.
 * @param {any} value La saisie.
 * @returns {number} L'entier, 0 si vide.
 */
export const toFigure = (value) => Number.parseInt(String(value ?? '0'), 10) || 0;

/**
 * Le score qui borne la saisie, ou `null` quand il n'est pas encore connu.
 * @param {any} score Le score de l'enveloppe.
 * @returns {{ scoreAgainst: number | null, scoreFor: number | null }} Les deux côtés.
 */
const readScore = (score) => {
  if (!score?.available) return { scoreAgainst: null, scoreFor: null };
  const scoreFor = Number(score?.scoreFor);
  const scoreAgainst = Number(score?.scoreAgainst);
  return {
    scoreAgainst: Number.isFinite(scoreAgainst) ? scoreAgainst : null,
    scoreFor: Number.isFinite(scoreFor) ? scoreFor : null,
  };
};

/**
 * Le plafond du bouton « + » d'un chiffre : le score de l'équipe pour ce qu'on marque,
 * le score adverse pour ce qu'on encaisse, sinon les bornes H6 partagées avec le serveur.
 * La FRAPPE n'est bornée que par H6 : un chiffre au-dessus du score s'affiche, en erreur.
 * @param {string} field La clé du chiffre.
 * @param {any} score Le score de l'enveloppe.
 * @returns {number} Le plafond.
 */
export const getPlusLimit = (field, score) => {
  const { scoreAgainst, scoreFor } = readScore(score);
  if ((field === 'goals' || field === 'points') && scoreFor !== null) return scoreFor;
  if (field === 'goalsConceded' && scoreAgainst !== null) return scoreAgainst;
  return getMatchStatsFieldMax(field);
};

/**
 * Borne une saisie clavier aux limites H6, comme le serveur.
 * @param {string} field La clé du chiffre.
 * @param {any} value La saisie brute.
 * @returns {string} La saisie bornée.
 */
export const sanitizeFigure = (field, value) => (
  clampMatchStatsValue(value, getMatchStatsFieldMax(field))
);

/**
 * Les incohérences qui bloquent l'envoi — les règles du serveur, dans son ordre.
 * @param {object} input L'état du formulaire.
 * @param {boolean} input.doesKnowStats Le joueur connaît-il ses chiffres ?
 * @param {string | null} input.participation Sa participation.
 * @param {any} input.quantitative Ses chiffres.
 * @param {any} input.score Le score de l'enveloppe.
 * @param {string} input.sport Le sport normalisé.
 * @returns {Array<{ code: string, field: string, limit: number, value: number }>}
 *   Les incohérences.
 */
export const buildConsistencyIssues = ({
  doesKnowStats, participation, quantitative, score, sport,
}) => {
  if (participation !== 'played' || !doesKnowStats) return [];
  const { scoreAgainst, scoreFor } = readScore(score);
  const issues = [];

  if (normalizeSport(sport) === 'basketball') {
    const points = toFigure(quantitative?.points);
    const threes = toFigure(quantitative?.threePointsMade);
    if (scoreFor !== null && points > scoreFor) {
      issues.push({
        code: 'pointsOverScore', field: 'points', limit: scoreFor, value: points,
      });
    }
    if (threes * 3 > points) {
      issues.push({
        code: 'threesOverPoints', field: 'threePointsMade', limit: points, value: threes,
      });
    }
    return issues;
  }

  const goals = toFigure(quantitative?.goals);
  const conceded = toFigure(quantitative?.goalsConceded);
  const cleanSheet = Boolean(quantitative?.cleanSheet);
  if (scoreFor !== null && goals > scoreFor) {
    issues.push({
      code: 'goalsOverScore', field: 'goals', limit: scoreFor, value: goals,
    });
  }
  if (scoreAgainst !== null && conceded > scoreAgainst) {
    issues.push({
      code: 'concededOverScore', field: 'goalsConceded', limit: scoreAgainst, value: conceded,
    });
  }
  if (scoreAgainst !== null && scoreAgainst > 0 && cleanSheet) {
    issues.push({
      code: 'cleanSheetScored', field: 'cleanSheet', limit: scoreAgainst, value: 1,
    });
  }
  if (cleanSheet && conceded > 0) {
    issues.push({
      code: 'cleanSheetConceded', field: 'cleanSheet', limit: 0, value: conceded,
    });
  }
  return issues;
};

/**
 * Les chiffres de départ, depuis la réponse déjà enregistrée.
 * @param {any} response La réponse du serveur, ou `null`.
 * @param {string} sport Le sport normalisé.
 * @returns {Record<string, any>} Les chiffres, en texte, et le clean sheet.
 */
export const buildInitialQuantitative = (response, sport) => {
  const payload = response?.sportPayload || {};
  // CORR-EVENEMENTS 124 : sans temps enregistré, aucune pastille allumée (« 0 » allumait
  // « Pas joué » juste après « J'ai joué »). Laissé vide, l'envoi part à 0, comme avant.
  const initial = {
    minutesPlayed: response?.minutesPlayed == null ? '' : String(response.minutesPlayed),
  };
  getFigureKeys(sport, true).forEach((key) => { initial[key] = String(payload?.[key] ?? 0); });
  if (normalizeSport(sport) === 'football') initial.cleanSheet = Boolean(payload?.cleanSheet);
  return initial;
};

/**
 * Ce qui part au serveur. Les chiffres ne partent que si le joueur a joué ET les connaît ;
 * un joueur de champ envoie toujours `cleanSheet: false` (l'ancien écran le cochait tout
 * seul à 0 but encaissé, pour TOUS les joueurs de champ).
 * @param {object} input L'état du formulaire.
 * @param {string | null} input.participation `played`, `present_no_play` ou `not_involved`.
 * @param {boolean} input.doesKnowStats Le joueur connaît-il ses chiffres ?
 * @param {number | null} input.rating Sa note.
 * @param {number | null} input.teamRating La note de l'équipe.
 * @param {string} input.comment Son mot.
 * @param {any} input.quantitative Ses chiffres.
 * @param {string} input.sport Le sport normalisé.
 * @param {boolean} input.isGoalkeeper Le joueur est-il gardien ?
 * @param {string | null} input.teamId L'équipe demandée par la route.
 * @param {'draft' | 'submitted'} status Brouillon ou envoi.
 * @returns {Record<string, any>} Le corps de la requête.
 */
export const buildResponsePayload = ({
  comment, doesKnowStats, isGoalkeeper, participation, quantitative, rating, sport, teamId,
  teamRating,
}, status) => {
  const played = participation === 'played';
  let quantitativeState = 'not_applicable';
  if (played) quantitativeState = doesKnowStats ? 'completed' : 'unknown';
  const notInvolved = participation === 'not_involved';

  const payload = {
    participation: participation || 'not_involved',
    quantitativeState,
    selfComment: String(comment || '').trim() || null,
    selfRating: notInvolved ? null : rating,
    status,
    teamRating: notInvolved ? null : teamRating,
    ...(teamId ? { teamId } : {}),
  };

  if (played && doesKnowStats) {
    payload.minutesPlayed = toFigure(quantitative?.minutesPlayed);
    getFigureKeys(sport, isGoalkeeper).forEach((key) => {
      payload[key] = toFigure(quantitative?.[key]);
    });
    if (normalizeSport(sport) === 'football') {
      payload.cleanSheet = isGoalkeeper ? Boolean(quantitative?.cleanSheet) : false;
    }
  }
  return payload;
};

/**
 * Le résultat du match vu par l'équipe du joueur.
 * @param {any} score Le score de l'enveloppe.
 * @returns {'draw' | 'loss' | 'pending' | 'win'} Le résultat.
 */
export const getMatchOutcome = (score) => {
  const { scoreAgainst, scoreFor } = readScore(score);
  if (scoreFor === null || scoreAgainst === null) return 'pending';
  if (scoreFor > scoreAgainst) return 'win';
  if (scoreFor < scoreAgainst) return 'loss';
  return 'draw';
};

/**
 * Le pied de page : rien de choisi (deux boutons qui attendent), pas concerné·e (un seul
 * « Envoyer »), déjà envoyée (un seul « Enregistrer la correction »), sinon les deux.
 * @param {{ isSubmitted: boolean, participation: string | null }} input L'état.
 * @returns {'correction' | 'pair' | 'single'} La forme du pied.
 */
export const getFooterMode = ({ isSubmitted, participation }) => {
  if (isSubmitted) return 'correction';
  if (participation === 'not_involved') return 'single';
  return 'pair';
};
