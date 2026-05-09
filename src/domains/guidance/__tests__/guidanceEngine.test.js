import {
  buildGuidanceAudienceContext,
  buildGuidanceSnapshot,
  hydrateGuidanceState,
  prepareGuidanceState,
} from '@/domains/guidance/guidanceEngine';
import {
  createEmptyGuidanceState,
  mergeGuidanceState,
} from '@/domains/guidance/guidanceState';

import { RouteNames } from '@/navigation/routeNames';

describe('guidanceEngine', () => {
  const createPlayerContext = (userData = {}) => buildGuidanceAudienceContext({
    canEditClub: () => false,
    canManageTeam: false,
    isGold: false,
    userData: {
      role: { name: 'Joueur' },
      ...userData,
    },
  });

  it('selects the player profile mission first for a new player', () => {
    const snapshot = buildGuidanceSnapshot({
      config: undefined,
      context: createPlayerContext(),
      state: createEmptyGuidanceState(),
    });

    expect(snapshot.programSummary.programId).toBe('player');
    expect(snapshot.currentMission?.id).toBe('player_profile_basics');
  });

  it('auto-completes route-based missions and advances to the next unlocked mission', () => {
    const state = {
      ...createEmptyGuidanceState(),
      manuallyConfirmedMissionIds: ['player_profile_basics'],
      routeVisits: {
        [RouteNames.MyEventList]: '2026-05-09T10:00:00.000Z',
      },
    };

    const snapshot = buildGuidanceSnapshot({
      config: undefined,
      context: createPlayerContext(),
      state,
    });

    expect(snapshot.preparedState.completedMissionIds).toEqual(
      expect.arrayContaining(['player_profile_basics', 'player_open_planning']),
    );
    expect(snapshot.currentMission?.id).toBe('player_open_messages');
  });

  it('merges local and remote state using union and latest-timestamp rules', () => {
    const remoteState = {
      completedMissionIds: ['player_profile_basics'],
      dismissedDockUntil: '2026-05-09T08:00:00.000Z',
      dismissedDockUpdatedAt: '2026-05-09T08:00:00.000Z',
      lastViewedMissionAt: '2026-05-09T08:30:00.000Z',
      lastViewedMissionId: 'player_profile_basics',
    };
    const localState = {
      completedMissionIds: ['player_open_planning'],
      dismissedDockUntil: '2026-05-09T12:00:00.000Z',
      dismissedDockUpdatedAt: '2026-05-09T12:00:00.000Z',
      lastViewedMissionAt: '2026-05-09T11:30:00.000Z',
      lastViewedMissionId: 'player_open_planning',
    };

    const mergedState = mergeGuidanceState(remoteState, localState);
    const hydratedState = hydrateGuidanceState({
      config: undefined,
      context: createPlayerContext(),
      localState,
      remoteState,
    });
    const preparedState = prepareGuidanceState({
      config: undefined,
      context: createPlayerContext(),
      state: mergedState,
    });

    expect(mergedState.completedMissionIds).toEqual(
      expect.arrayContaining(['player_profile_basics', 'player_open_planning']),
    );
    expect(mergedState.dismissedDockUntil).toBe('2026-05-09T12:00:00.000Z');
    expect(mergedState.lastViewedMissionId).toBe('player_open_planning');
    expect(hydratedState.completedMissionIds).toEqual(preparedState.completedMissionIds);
  });
});
