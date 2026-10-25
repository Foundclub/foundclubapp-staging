import { resolveCoachStep } from '../matchStatsPromptModel';

// C07 / Q2-12 — un rappel d'entraîneur de LIGUE (`matchId`, sans `eventId`)
// sur un match pas encore validé tombait sur l'étape « score » : « Enregistrer »
// sortait sans rien faire (le score d'un événement exige un `eventId`) et le
// rappel revenait. En ligue, le score se saisit par la fin de match de la
// ligue : le rappel passe directement à la feuille.

jest.mock('i18next', () => ({ __esModule: true, default: { t: (cle, repli) => repli || cle } }));

const rappelLigue = {
  actionType: 'coach_team_review',
  matchId: 'm1',
  reportStatus: null,
  reviewRequired: false,
  score: { available: false },
  sourceType: 'league',
  state: 'todo',
};

describe('resolveCoachStep', () => {
  it('Q2-12 : un rappel de ligue sans score validé ne propose pas de saisir le score ici', () => {
    expect(resolveCoachStep(rappelLigue)).toBe('sheet');
    expect(resolveCoachStep({ ...rappelLigue, reportStatus: 'draft', state: 'draft' })).toBe('draft');
  });

  it('garde l étape « score » pour un événement sans score', () => {
    expect(resolveCoachStep({ ...rappelLigue, eventId: 'e1', sourceType: 'event' })).toBe('score');
  });

  it('garde l étape « score » pour un rappel score_entry', () => {
    expect(resolveCoachStep({ ...rappelLigue, actionType: 'score_entry' })).toBe('score');
  });

  it('garde « review » avant tout', () => {
    expect(resolveCoachStep({ ...rappelLigue, reviewRequired: true })).toBe('review');
  });
});
