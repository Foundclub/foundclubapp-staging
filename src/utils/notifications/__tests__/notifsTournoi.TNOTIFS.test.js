/* eslint-disable max-len -- donnees de temoin sur une ligne */
// T-NOTIFS-TOURNOI (18/11/2026, nuit D231) — OU MENE LE CLIC D UNE NOTIFICATION DU TOURNOI.
//
// (g) « ta place est a payer » (licensePaymentDue) porte `teamId` + `eventId` (serveur, tournament-team/
//     services/notification.js) : le clic ouvre LA PAGE DE L EQUIPE, plus le detail d une cotisation.
//     Une cotisation de club (sans teamId) garde son chemin d avant : MyLicense.
// (f) `tournamentTeamRegistered` (type neuf, meme chaine que le serveur) : l organisateur ouvre la gestion
//     du tournoi, comme l alerte d effectif ; icone « equipe ».
// (a)(b)(c) reutilisent des types qui menaient deja a la page de l equipe : verrouille ici.

import { NOTIFICATION_TYPES } from '../../../domains/auth/authUseCases';
import { RouteNames } from '../../../navigation/routeNames';
import { resolveNotificationDestination } from '../notificationNavigation';
import { getNotificationIcon } from '../notificationPresentation';

const PAGE_EQUIPE = {
  params: {
    params: { eventId: 'tournoi-1912', teamId: 'equipe-a' },
    screen: RouteNames.TournamentTeamDetails,
  },
  route: RouteNames.EventStack,
};

describe('T-NOTIFS-TOURNOI — destinations', () => {
  it('(g) place de tournoi a payer : la page de l equipe', () => {
    expect(resolveNotificationDestination({
      assignmentId: 'place-j', eventId: 'tournoi-1912', teamId: 'equipe-a', type: NOTIFICATION_TYPES.LICENSE_PAYMENT_DUE,
    })).toEqual(PAGE_EQUIPE);
  });

  it.each([
    'LICENSE_PAYMENT_CONFIRMED', 'LICENSE_PAYMENT_REMINDER', 'LICENSE_PAYMENT_REJECTED',
  ])('(g) %s d une place de tournoi : la page de l equipe aussi', (type) => {
    expect(resolveNotificationDestination({
      assignmentId: 'place-j', eventId: 'tournoi-1912', teamId: 'equipe-a', type: NOTIFICATION_TYPES[type],
    })).toEqual(PAGE_EQUIPE);
  });

  it('(h) paiement confirme d une place, sans equipe mais avec le tournoi : la fiche du tournoi', () => {
    expect(resolveNotificationDestination({
      assignmentId: 'place-j', campaignType: 'tournament', eventId: 'tournoi-1912', type: NOTIFICATION_TYPES.LICENSE_PAYMENT_CONFIRMED,
    })).toEqual(resolveNotificationDestination({ eventId: 'tournoi-1912', type: NOTIFICATION_TYPES.TOURNAMENT_CLOSED }));
  });

  it('(g) une cotisation de club garde le detail de la cotisation', () => {
    expect(resolveNotificationDestination({
      assignmentId: 'coti-1', type: NOTIFICATION_TYPES.LICENSE_PAYMENT_DUE,
    })).toEqual({ params: { assignmentId: 'coti-1' }, route: RouteNames.MyLicense });
  });

  it('(f) le type neuf a la meme chaine que le serveur', () => {
    expect(NOTIFICATION_TYPES.TOURNAMENT_TEAM_REGISTERED).toBe('tournamentTeamRegistered');
  });

  it('(f) nouvelle equipe inscrite : l organisateur ouvre la gestion du tournoi', () => {
    const destination = resolveNotificationDestination({
      eventId: 'tournoi-1912', teamId: 'equipe-a', type: 'tournamentTeamRegistered',
    });
    expect(destination).toEqual({
      params: { params: { eventId: 'tournoi-1912' }, screen: RouteNames.TournamentManagement },
      route: RouteNames.EventStack,
    });
    expect(destination).toEqual(resolveNotificationDestination({
      eventId: 'tournoi-1912', teamId: 'equipe-a', type: NOTIFICATION_TYPES.TOURNAMENT_TEAM_ROSTER_WARNING,
    }));
  });

  it('(f) icone « equipe »', () => {
    expect(getNotificationIcon('tournamentTeamRegistered')).toBe('users');
  });

  it.each([
    'TOURNAMENT_TEAM_INVITATION_STATUS', 'TOURNAMENT_TEAM_JOIN_REQUEST_STATUS', 'TOURNAMENT_TEAM_STATUS',
  ])('(a)(b)(c) %s mene a la page de l equipe', (type) => {
    expect(resolveNotificationDestination({
      eventId: 'tournoi-1912', teamId: 'equipe-a', type: NOTIFICATION_TYPES[type],
    })).toEqual(PAGE_EQUIPE);
  });
});
