import { USER_ROLES } from '@/domains/auth/authUseCases';

import {
  ParticipationFlowKind,
  resolveParticipationFlow,
} from './participationFlow';

describe('participationFlow', () => {
  const playerUser = {
    documentId: 'user-1',
    role: { name: USER_ROLES.player },
  };

  test('routes recruiting reservations to the dedicated reservation flow', () => {
    const reservation = {
      bookingStatus: 'shared',
      date: '2099-01-01T10:00:00.000Z',
      missingPlayers: 2,
      reservationMode: 'RECRUITING',
      type: { name: 'Réservation' },
    };

    const flow = resolveParticipationFlow(reservation, { user: playerUser });

    expect(flow.kind).toBe(ParticipationFlowKind.reservationRecruiting);
    expect(flow.submitMode).toBe('joinReservation');
    expect(flow.canAct).toBe(true);
  });

  test('does not classify a detection as reservation when technical booking fields are present', () => {
    const detection = {
      bookingStatus: 'open',
      date: '2099-01-01T10:00:00.000Z',
      documentId: 'detection-1',
      reservationMode: 'FULL_GROUP',
      type: { name: 'Détection' },
    };

    const flow = resolveParticipationFlow(detection, { user: playerUser });

    expect(flow.kind).toBe(ParticipationFlowKind.eventOpen);
    expect(flow.submitMode).toBe('createEventParticipation');
    expect(flow.actionLabel).toBe('Participer');
  });

  test('allows closed match answers when user belongs to the event team by team id', () => {
    const event = {
      date: '2099-01-01T10:00:00.000Z',
      participations: [],
      sessionStatus: 'closed',
      team: {
        documentId: 'team-1',
      },
      type: { name: 'Match' },
    };
    const user = {
      ...playerUser,
      myTeams: [{ documentId: 'team-1' }],
    };

    const flow = resolveParticipationFlow(event, { user });

    expect(flow.kind).toBe(ParticipationFlowKind.eventClosed);
    expect(flow.canAct).toBe(true);
    expect(flow.actionLabel).toBe('Present');
  });

  test('redirects stage day children to their parent event', () => {
    const event = {
      eventFormat: 'stage_day',
      parentEvent: { documentId: 'parent-1' },
    };

    const flow = resolveParticipationFlow(event, { user: playerUser });

    expect(flow.kind).toBe(ParticipationFlowKind.eventStageDayRedirect);
    expect(flow.submitMode).toBe('redirect-parent');
  });

  test('blocks closed event participation for users outside allowed teams', () => {
    const event = {
      date: '2099-01-01T10:00:00.000Z',
      invitedTeams: [],
      participations: [],
      sessionStatus: 'closed',
      team: {
        players: [{ documentId: 'someone-else' }],
      },
    };

    const flow = resolveParticipationFlow(event, { user: playerUser });

    expect(flow.kind).toBe(ParticipationFlowKind.eventClosed);
    expect(flow.canAct).toBe(false);
    expect(flow.blockedReason).toContain('réservé');
  });

  test('allows re-apply semantics for withdrawn non-detection applications', () => {
    const ad = {
      audienceType: 'player',
      documentId: 'ad-1',
      isActive: true,
    };

    const flow = resolveParticipationFlow(ad, {
      applicationState: { status: 'withdrawn' },
      currentUserApplication: { documentId: 'application-1' },
      entityType: 'recruitment-ad',
      isOwner: false,
      user: playerUser,
    });

    expect(flow.kind).toBe(ParticipationFlowKind.recruitmentPlayer);
    expect(flow.canAct).toBe(true);
    expect(flow.canWithdraw).toBe(false);
  });

  test('blocks external users when the external training quota is full', () => {
    const event = {
      date: '2099-01-01T10:00:00.000Z',
      externalParticipantLimit: 2,
      participationRequests: [
        {
          documentId: 'request-1',
          isActive: true,
          participationStatus: 'accepted',
          user: { documentId: 'user-a' },
        },
        {
          documentId: 'request-2',
          isActive: true,
          participationStatus: 'pending',
          user: { documentId: 'user-b' },
        },
      ],
      participations: [],
      sessionStatus: 'open',
      team: { documentId: 'team-1', players: [] },
      type: { name: 'Entrainement' },
    };

    const flow = resolveParticipationFlow(event, { user: playerUser });

    expect(flow.canAct).toBe(false);
    expect(flow.blockedReason).toContain('quota');
  });

  test('keeps internal members eligible even when the external training quota is full', () => {
    const event = {
      date: '2099-01-01T10:00:00.000Z',
      externalParticipantLimit: 1,
      participationRequests: [
        {
          documentId: 'request-1',
          isActive: true,
          participationStatus: 'accepted',
          user: { documentId: 'user-a' },
        },
      ],
      participations: [],
      sessionStatus: 'open',
      team: { documentId: 'team-1', players: [] },
      type: { name: 'Entrainement' },
    };
    const internalUser = {
      ...playerUser,
      myTeams: [{ documentId: 'team-1' }],
    };

    const flow = resolveParticipationFlow(event, { user: internalUser });

    expect(flow.canAct).toBe(true);
    expect(flow.submitMode).toBe('createEventParticipation');
  });
});
