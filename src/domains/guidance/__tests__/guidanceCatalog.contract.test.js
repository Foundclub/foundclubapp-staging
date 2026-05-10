import { guidanceCatalog } from '@/domains/guidance/guidanceCatalog';

import { RouteNames } from '@/navigation/routeNames';

const getMission = (missionId) => guidanceCatalog.missions.find(
  (mission) => mission.id === missionId,
);

describe('guidanceCatalog search hub contract', () => {
  it('keeps tab-based search missions aligned with the canonical SearchHub route', () => {
    const expectations = [
      ['player_search_events', 'events', 'search.tab.events'],
      ['player_search_clubs', 'clubs', 'search.tab.clubs'],
      ['player_search_recruitment', 'recruitment', 'search.tab.recruitment'],
      ['coach_search_events', 'events', 'search.tab.events'],
      ['coach_search_recruitment', 'recruitment', 'search.tab.recruitment'],
      ['coach_open_reservations', 'reservations', 'search.tab.reservations'],
      ['president_open_recruitment', 'recruitment', 'search.tab.recruitment'],
      ['president_open_reservations', 'reservations', 'search.tab.reservations'],
      ['president_open_public_club_search', 'clubs', 'search.tab.clubs'],
    ];

    expectations.forEach(([missionId, activeType, signalKey]) => {
      const mission = getMission(missionId);

      expect(mission).toMatchObject({
        completionSignal: { key: signalKey, type: 'interaction' },
        navTarget: {
          params: { activeType },
          routeName: RouteNames.SearchHub,
        },
      });
    });
  });

  it('keeps messaging missions wired through the HomeTab container', () => {
    [
      'player_open_messages',
      'coach_open_messages',
      'president_open_messages',
    ].forEach((missionId) => {
      const mission = getMission(missionId);

      expect(mission).toMatchObject({
        completionSignal: { routeName: RouteNames.Chat, type: 'route' },
        navTarget: {
          params: { screen: RouteNames.Chat },
          routeName: RouteNames.HomeTab,
        },
        tutorialTarget: {
          params: { screen: RouteNames.Chat },
          routeName: RouteNames.HomeTab,
        },
      });
    });
  });
});
