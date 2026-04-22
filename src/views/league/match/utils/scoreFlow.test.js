import {
  buildLocalScoreFlow,
  formatScoreFlowCountdown,
} from '@/views/league/match/utils/scoreFlow';

const createBaseMatch = (overrides = {}) => ({
  automation_meta: {},
  date: '2026-04-20T10:00:00.000Z',
  scoreFlow: null,
  status: 'scheduled',
  submitted_score_team_a: null,
  submitted_score_team_b: null,
  venueBooked: false,
  ...overrides,
});

describe('scoreFlow utils', () => {
  test('buildLocalScoreFlow unlocks score submission for a captain once the score window opens', () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(
      new Date('2026-04-20T10:05:00.000Z').getTime(),
    );

    try {
      const scoreFlow = buildLocalScoreFlow(createBaseMatch({
        phase: 'waiting_score',
        venueBooked: true,
      }), {
        isCaptainA: true,
      });

      expect(scoreFlow.state).toBe('ready_to_submit');
      expect(scoreFlow.canSubmit).toBe(true);
      expect(scoreFlow.actionRequired).toBe(true);
      expect(scoreFlow.primaryCta?.label).toBe('Saisir le score');
    } finally {
      nowSpy.mockRestore();
    }
  });

  test('buildLocalScoreFlow exposes opponent validation state for the opposite captain', () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(
      new Date('2026-04-20T10:15:00.000Z').getTime(),
    );

    try {
      const scoreFlow = buildLocalScoreFlow(createBaseMatch({
        status: 'pending_validation',
        submitted_score_team_a: {
          by: 'captain-a',
          score_a: 2,
          score_b: 1,
          submittedAt: '2026-04-20T10:10:00.000Z',
        },
        venueBooked: true,
      }), {
        isCaptainB: true,
      });

      expect(scoreFlow.state).toBe('opponent_score_pending');
      expect(scoreFlow.canValidate).toBe(true);
      expect(scoreFlow.canDispute).toBe(true);
      expect(scoreFlow.opponentSubmission?.scoreA).toBe(2);
      expect(scoreFlow.primaryCta?.label).toBe('Valider le score adverse');
    } finally {
      nowSpy.mockRestore();
    }
  });

  test('formatScoreFlowCountdown keeps score deadline copy readable', () => {
    expect(formatScoreFlowCountdown(0)).toBe("moins d'une minute");
    expect(formatScoreFlowCountdown(65 * 60)).toBe('1h 5min');
    expect(formatScoreFlowCountdown(27 * 60 * 60)).toBe('1j 3h');
  });
});
