import i18next from 'i18next';

import { LEAGUE_SPORT_KEYS } from './leagueSportConfig';

const toInt = (value) => {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const isValidRegularPadelSet = (winnerGames, loserGames) => {
  if (winnerGames === 6 && loserGames >= 0 && loserGames <= 4) return true;
  if (winnerGames === 7 && (loserGames === 5 || loserGames === 6)) return true;
  return false;
};

const isValidSuperTieBreakSet = (winnerPoints, loserPoints) => (
  winnerPoints >= 10 && winnerPoints - loserPoints >= 2
);

const normalizeSet = (set, index) => {
  const a = toInt(set?.a);
  const b = toInt(set?.b);
  if (a === null || b === null || a < 0 || b < 0) {
    return {
      error: i18next.t(
        'leagueScoreDetails.invalidSet',
        'Set {{setNumber}} invalide.',
        { setNumber: index + 1 },
      ),
    };
  }
  if (a === b) {
    return {
      error: i18next.t(
        'leagueScoreDetails.tiedSet',
        'Le set {{setNumber}} ne peut pas être à égalité.',
        { setNumber: index + 1 },
      ),
    };
  }
  const winner = Math.max(a, b);
  const loser = Math.min(a, b);
  const superTieBreak = set?.superTieBreak === true || winner >= 10;
  const valid = superTieBreak
    ? isValidSuperTieBreakSet(winner, loser)
    : isValidRegularPadelSet(winner, loser);
  if (!valid) {
    return {
      error: i18next.t(
        'leagueScoreDetails.setBreaksPadelRules',
        'Le set {{setNumber}} ne respecte pas les règles du padel.',
        { setNumber: index + 1 },
      ),
    };
  }
  return {
    set: {
      a,
      b,
      ...(superTieBreak ? { superTieBreak: true } : {}),
    },
  };
};

export const buildPadelScorePayload = (sets) => {
  const inputSets = (sets || [])
    .map((set) => ({ a: toInt(set?.a), b: toInt(set?.b), superTieBreak: set?.superTieBreak === true }))
    .filter((set) => set.a !== null || set.b !== null);

  if (inputSets.length < 2 || inputSets.length > 3) {
    return {
      error: i18next.t(
        'leagueScoreDetails.setCount',
        'Renseigne 2 ou 3 sets pour un match de padel.',
      ),
    };
  }

  let scoreA = 0;
  let scoreB = 0;
  const normalizedSets = [];

  for (let index = 0; index < inputSets.length; index += 1) {
    const result = normalizeSet(inputSets[index], index);
    if (result.error) return result;
    normalizedSets.push(result.set);
    if (result.set.a > result.set.b) scoreA += 1;
    if (result.set.b > result.set.a) scoreB += 1;
  }

  if (!((scoreA === 2 && [0, 1].includes(scoreB)) || (scoreB === 2 && [0, 1].includes(scoreA)))) {
    return {
      error: i18next.t('leagueScoreDetails.winnerSets', 'Le vainqueur doit gagner 2 sets.'),
    };
  }

  return {
    scoreA,
    scoreB,
    scoreDetails: {
      format: 'sets',
      scoreLabel: normalizedSets.map((set) => `${set.a}-${set.b}`).join(' '),
      sets: normalizedSets,
      sport: LEAGUE_SPORT_KEYS.PADEL,
    },
  };
};

export const getSubmissionScoreLabel = (submission) => {
  if (!submission || typeof submission !== 'object') return '-';
  const details = submission.score_details || submission.scoreDetails;
  if (details?.scoreLabel) return details.scoreLabel;
  if (submission.score_label || submission.scoreLabel) return submission.score_label || submission.scoreLabel;
  return `${submission.score_a ?? '-'} - ${submission.score_b ?? '-'}`;
};
