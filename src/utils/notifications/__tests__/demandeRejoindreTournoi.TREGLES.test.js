/**
 * T-REGLES-EQUIPE (18/11/2026, point 9 du chef, venu de T-NOTIFS-TOURNOI) — la notification
 * « demande de rejoindre » d'une équipe de tournoi ouvre la page d'équipe SUR les demandes
 * (`focusSection: 'requests'`) ; les autres notifications d'équipe gardent l'arrivée en haut.
 * Défilement : src/views/event/__tests__/T-PAGES-2.pageEquipe.test.js.
 */
import { RouteNames } from '@/navigation/routeNames';

import { resolveNotificationDestination } from '@/utils/notifications/notificationNavigation';

const versEquipe = (/** @type {any} */ params) => ({
  params: { params, screen: RouteNames.TournamentTeamDetails },
  route: RouteNames.EventStack,
});

describe('T-REGLES-EQUIPE — la demande de rejoindre mène aux demandes', () => {
  test('🔴 « tournamentTeamJoinRequest » : la page d équipe, focusSection « requests »', () => {
    expect(resolveNotificationDestination({ eventId: 'evt-1', teamId: 'tt-1', type: 'tournamentTeamJoinRequest' }))
      .toEqual(versEquipe({ eventId: 'evt-1', focusSection: 'requests', teamId: 'tt-1' }));
  });

  test('les autres notifications d équipe : la page d équipe, sans focusSection', () => {
    ['tournamentCaptainTransfer', 'tournamentTeamInvitation', 'tournamentTeamInvitationStatus', 'tournamentTeamJoinRequestStatus', 'tournamentTeamStatus'].forEach((type) => {
      expect(resolveNotificationDestination({ eventId: 'evt-1', teamId: 'tt-1', type }))
        .toEqual(versEquipe({ eventId: 'evt-1', teamId: 'tt-1' }));
    });
  });
});
