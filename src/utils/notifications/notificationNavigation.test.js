import { RouteNames } from '@/navigation/routeNames';

import {
  getNotificationOpenKey,
  normalizeNotificationPayload,
  resolveNotificationDestination,
} from '@/utils/notifications/notificationNavigation';
import { NOTIFICATION_TYPES } from '@/utils/notifications/notificationTypes';

describe('notificationNavigation', () => {
  test('routes league score notifications directly to the score entry screen', () => {
    const destination = resolveNotificationDestination({
      matchId: 'match-42',
      scoreFlowState: 'opponent_score_pending',
      type: NOTIFICATION_TYPES.LEAGUE_SCORE_START_INFO,
    });

    expect(destination).toEqual({
      params: {
        matchId: 'match-42',
        scoreFlowState: 'opponent_score_pending',
      },
      route: RouteNames.EndMatchScreen,
    });
  });

  test('routes validated league matches to past match details', () => {
    const destination = resolveNotificationDestination({
      matchId: 'match-99',
      type: NOTIFICATION_TYPES.LEAGUE_MATCH_VALIDATED,
    });

    expect(destination).toEqual({
      params: { matchId: 'match-99' },
      route: RouteNames.PastMatchDetails,
    });
  });

  test('routes football11 accepted proposals to presence instead of venue booking', () => {
    const destination = resolveNotificationDestination({
      matchId: 'match-11',
      matchSport: 'Football a 11',
      type: NOTIFICATION_TYPES.LEAGUE_PROPOSAL_ACCEPTED,
    });

    expect(destination).toEqual({
      params: {
        focusSection: 'presence',
        matchId: 'match-11',
      },
      route: RouteNames.LeagueMatchDetails,
    });
  });

  test('normalizes notification payload ids and keeps a deterministic open key', () => {
    const normalized = normalizeNotificationPayload({
      data: JSON.stringify({
        matchId: 77,
      }),
      id: 123,
      type: NOTIFICATION_TYPES.LEAGUE_SCORE_REMINDER_2H,
    });

    expect(normalized.notificationId).toBe('123');
    expect(normalized.matchId).toBe('77');
    expect(getNotificationOpenKey(normalized)).toContain(NOTIFICATION_TYPES.LEAGUE_SCORE_REMINDER_2H);
  });
});
