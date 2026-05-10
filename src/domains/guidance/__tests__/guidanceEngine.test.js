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
  const createCoachContext = (userData = {}) => buildGuidanceAudienceContext({
    canEditClub: () => false,
    canManageTeam: true,
    isGold: false,
    userData: {
      role: { name: 'Entraineur' },
      ...userData,
    },
  });
  const createPresidentContext = (userData = {}, canEditClub = () => false) => buildGuidanceAudienceContext({
    canEditClub,
    canManageTeam: true,
    isGold: false,
    userData: {
      role: { name: 'Dirigeant' },
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

  it('keeps profile basics open until identity and avatar are complete', () => {
    const state = createEmptyGuidanceState();
    const withoutAvatarSnapshot = buildGuidanceSnapshot({
      config: undefined,
      context: createPlayerContext({
        firstname: 'Ada',
        lastname: 'Lovelace',
      }),
      state,
    });
    const withAvatarSnapshot = buildGuidanceSnapshot({
      config: undefined,
      context: createPlayerContext({
        avatar: { url: 'https://example.com/avatar.png' },
        firstname: 'Ada',
        lastname: 'Lovelace',
      }),
      state,
    });

    expect(withoutAvatarSnapshot.currentMission?.id).toBe('player_profile_basics');
    expect(withoutAvatarSnapshot.preparedState.completedMissionIds).not.toContain('player_profile_basics');
    expect(withAvatarSnapshot.preparedState.completedMissionIds).toContain('player_profile_basics');
    expect(withAvatarSnapshot.currentMission?.id).toBe('player_open_planning');
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

  it('auto-completes search hub tab missions from interaction signals', () => {
    const state = {
      ...createEmptyGuidanceState(),
      interactionSignals: {
        'search.tab.events': '2026-05-09T10:00:00.000Z',
      },
      manuallyConfirmedMissionIds: ['player_profile_basics', 'player_open_planning', 'player_open_messages'],
    };

    const snapshot = buildGuidanceSnapshot({
      config: undefined,
      context: createPlayerContext(),
      state,
    });

    expect(snapshot.preparedState.completedMissionIds).toEqual(
      expect.arrayContaining(['player_search_events']),
    );
    expect(snapshot.currentMission?.id).toBe('player_event_filters');
  });

  it('unblocks the coach recruitment chain after the real search hub recruitment tab', () => {
    const state = {
      ...createEmptyGuidanceState(),
      interactionSignals: {
        'search.tab.recruitment': '2026-05-09T10:00:00.000Z',
      },
      manuallyConfirmedMissionIds: [
        'coach_profile_basics',
        'coach_open_planning',
        'coach_open_teams',
        'coach_open_messages',
        'coach_open_requests',
        'coach_create_event',
        'coach_edit_event',
        'coach_search_events',
        'coach_filter_requests',
      ],
    };

    const snapshot = buildGuidanceSnapshot({
      config: undefined,
      context: createCoachContext({
        club: { documentId: 'club-1' },
        trainedTeams: [{ documentId: 'team-1' }],
      }),
      state,
    });

    expect(snapshot.preparedState.completedMissionIds).toContain('coach_search_recruitment');
    expect(snapshot.currentMission?.id).toBe('coach_open_ad_wizard');
  });

  it('skips hidden request-filter missions when the current president context cannot expose them', () => {
    const state = {
      ...createEmptyGuidanceState(),
      manuallyConfirmedMissionIds: [
        'president_open_club',
        'president_open_requests',
        'president_open_profile',
        'president_open_messages',
        'president_open_planning',
        'president_create_event',
        'president_edit_event',
        'president_open_structure',
      ],
    };

    const snapshot = buildGuidanceSnapshot({
      config: undefined,
      context: createPresidentContext({
        multisportClubs: [{ documentId: 'cm-1' }],
      }),
      state,
    });

    expect(
      snapshot.missions.find((mission) => mission.id === 'president_filter_team_requests'),
    ).toBeUndefined();
    expect(
      snapshot.missions.find((mission) => mission.id === 'president_filter_event_requests'),
    ).toBeUndefined();
    expect(snapshot.currentMission?.id).toBe('president_open_recruitment');
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
