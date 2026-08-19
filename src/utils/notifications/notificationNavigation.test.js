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

  test('keeps target account context and differentiates open keys across local accounts', () => {
    const firstPayload = normalizeNotificationPayload({
      data: JSON.stringify({
        eventId: 55,
        targetUserDocumentId: ' user-a ',
        targetUserId: 10,
      }),
      notificationId: 'notif-1',
      type: NOTIFICATION_TYPES.EVENT_REMINDER,
    });

    const secondPayload = normalizeNotificationPayload({
      data: JSON.stringify({
        eventId: 55,
        targetUserDocumentId: 'user-b',
        targetUserId: 11,
      }),
      notificationId: 'notif-1',
      type: NOTIFICATION_TYPES.EVENT_REMINDER,
    });

    expect(firstPayload.targetUserDocumentId).toBe('user-a');
    expect(firstPayload.targetUserId).toBe('10');
    expect(getNotificationOpenKey(firstPayload)).not.toBe(getNotificationOpenKey(secondPayload));
  });

  // Lot L6 (spec matchs amicaux §7). Le piege est SILENCIEUX : un type inconnu
  // ou un adId manquant ne leve pas — on atterrit sur l'accueil, et personne
  // ne sait pourquoi la notification « n'a rien fait ».
  describe('matchs amicaux', () => {
    const FRIENDLY_TYPES = [
      NOTIFICATION_TYPES.FRIENDLY_MATCH_APPLICATION,
      NOTIFICATION_TYPES.FRIENDLY_MATCH_APPLICATION_STATUS,
      NOTIFICATION_TYPES.FRIENDLY_MATCH_TERMS_UPDATED,
      NOTIFICATION_TYPES.FRIENDLY_MATCH_AD_EXPIRED,
    ];

    test.each(FRIENDLY_TYPES)('%s ouvre le detail de l annonce', (type) => {
      const destination = resolveNotificationDestination({ adId: 'ad-7', type });

      expect(destination).toEqual({
        params: { adId: 'ad-7' },
        route: RouteNames.FriendlyMatchAdDetails,
      });
    });

    test('les 4 chaines sont EXACTEMENT celles du serveur', () => {
      // Elles sont ecrites deux fois, dans deux depots : admin/src/api/
      // user-fcm-token/types/index.ts et ici. Une faute de frappe d un cote
      // rend la notification muette, sans aucune erreur.
      expect(FRIENDLY_TYPES).toEqual([
        'friendly_match_application',
        'friendly_match_application_status',
        'friendly_match_terms_updated',
        'friendly_match_ad_expired',
      ]);
    });

    test('sans identifiant d annonce, on ne navigue nulle part', () => {
      expect(resolveNotificationDestination({
        type: NOTIFICATION_TYPES.FRIENDLY_MATCH_APPLICATION,
      })).toBeNull();
    });
  });

  // C-C — ECRAN 10 du pack composition.
  //
  // 🎯 C'est ICI que se joue « la moitie que le joueur voit ». Une convocation
  // publiee atterrissait sur la page-fleuve de l'evenement : le joueur devait
  // deviner qu'il etait convoque. Elle atterrit desormais sur SON ecran, qui le
  // repose sur la page de l'evenement s'il n'est finalement pas convoque
  // (le serveur envoie la meme notification a toute l'equipe).
  describe('convocation publiee', () => {
    test('elle ouvre l ecran du joueur, en emportant l equipe concernee', () => {
      expect(resolveNotificationDestination({
        eventId: 'evt-1',
        teamId: 'team-7',
        type: NOTIFICATION_TYPES.EVENT_CONVOCATION_PUBLISHED,
      })).toEqual({
        params: {
          params: { eventId: 'evt-1', teamId: 'team-7' },
          screen: RouteNames.PlayerConvocation,
        },
        route: RouteNames.EventStack,
      });
    });

    test('sans equipe, elle ouvre quand meme l ecran du joueur', () => {
      expect(resolveNotificationDestination({
        eventId: 'evt-1',
        type: NOTIFICATION_TYPES.EVENT_CONVOCATION_PUBLISHED,
      })).toEqual({
        params: {
          params: { eventId: 'evt-1', teamId: undefined },
          screen: RouteNames.PlayerConvocation,
        },
        route: RouteNames.EventStack,
      });
    });

    test('sans evenement, on retombe sur le comportement d avant, pas sur un ecran vide', () => {
      expect(resolveNotificationDestination({
        type: NOTIFICATION_TYPES.EVENT_CONVOCATION_PUBLISHED,
      })).toBeNull();
    });

    test('🔒 les AUTRES notifications d evenement gardent leur destination', () => {
      expect(resolveNotificationDestination({
        eventId: 'evt-1',
        type: NOTIFICATION_TYPES.EVENT_PUBLISHED,
      })).toEqual({
        params: {
          params: { eventId: 'evt-1' },
          screen: RouteNames.EventDetails,
        },
        route: RouteNames.EventStack,
      });
    });
  });
});

/**
 * U06 — TEMOIN 6 : « l'ecran des demandes d'adhesion a une porte ».
 *
 * 🧨 Mesure du 18/08 : `TeamMembershipRequestList` est construit, branche dans
 * `TeamStack` sous `RouteNames.TeamMembershipRequests`, expose sur le web en
 * `/teams/:teamId/requests` — et **AUCUN appelant dans tout `app/src`**. Zero.
 * Meme la notification qui annonce la demande envoyait vers la fiche de
 * l'equipe, ou rien ne parle des demandes en attente.
 *
 * La porte posee ici est le MIROIR exact de celle du club
 * (`CLUB_MEMBERSHIP_REQUEST` + `requestType === 'claim'`, l. ~600).
 * ⚠️ Sans `teamId`, l'ecran n'a rien a afficher : on retombe alors sur la fiche
 * de l'equipe plutot que d'ouvrir une page vide.
 */
describe('U06 — la demande d adhesion a une equipe a enfin une porte', () => {
  test('temoin 6 — la notification ouvre la LISTE DES DEMANDES de l equipe', () => {
    const destination = resolveNotificationDestination({
      teamId: 'team-7',
      type: NOTIFICATION_TYPES.TEAM_MEMBERSHIP_REQUEST,
    });

    expect(destination).toEqual({
      params: {
        params: { teamId: 'team-7' },
        screen: RouteNames.TeamMembershipRequests,
      },
      route: RouteNames.TeamStack,
    });
  });

  test('sans identifiant d equipe, on retombe sur la fiche plutot que sur une page vide', () => {
    const destination = resolveNotificationDestination({
      type: NOTIFICATION_TYPES.TEAM_MEMBERSHIP_REQUEST,
    });

    expect(destination?.params?.screen).not.toBe(RouteNames.TeamMembershipRequests);
  });

  test('les autres notifications d equipe continuent d ouvrir la fiche', () => {
    const destination = resolveNotificationDestination({
      teamId: 'team-7',
      type: NOTIFICATION_TYPES.ADD_TO_TEAM,
    });

    expect(destination).toEqual({
      params: {
        params: { teamId: 'team-7' },
        screen: RouteNames.TeamDetails,
      },
      route: RouteNames.TeamStack,
    });
  });
});
