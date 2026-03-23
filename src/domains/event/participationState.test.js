import {
  getCurrentUserEventParticipationState,
  getLatestActiveParticipationForUser,
} from './participationState';

describe('event participation state', () => {
  const currentUser = { documentId: 'user-1', id: 10 };

  test('prefers the latest active request over an older accepted history entry', () => {
    const participationRequests = [
      {
        createdAt: '2026-03-20T10:00:00.000Z',
        documentId: 'req-accepted-old',
        isActive: false,
        participationStatus: 'accepted',
        updatedAt: '2026-03-20T10:05:00.000Z',
        user: { documentId: 'user-1', id: 10 },
      },
      {
        createdAt: '2026-03-22T09:00:00.000Z',
        documentId: 'req-pending-new',
        isActive: true,
        participationStatus: 'pending',
        updatedAt: '2026-03-22T09:10:00.000Z',
        user: { documentId: 'user-1', id: 10 },
      },
    ];

    const latestActiveRequest = getLatestActiveParticipationForUser({
      participationRequests,
      user: currentUser,
    });
    const state = getCurrentUserEventParticipationState({
      participationRequests,
      participations: [{ documentId: 'user-1', id: 10 }],
      user: currentUser,
    });

    expect(latestActiveRequest?.documentId).toBe('req-pending-new');
    expect(state.hasPendingRequest).toBe(true);
    expect(state.hasAcceptedRequest).toBe(false);
    expect(state.requestStatus).toBe('pending');
  });

  test('falls back to accepted participation only when no active request exists', () => {
    const state = getCurrentUserEventParticipationState({
      participationRequests: [
        {
          createdAt: '2026-03-20T10:00:00.000Z',
          documentId: 'req-accepted-old',
          isActive: false,
          participationStatus: 'accepted',
          updatedAt: '2026-03-20T10:05:00.000Z',
          user: { documentId: 'user-1', id: 10 },
        },
      ],
      participations: [{ documentId: 'user-1', id: 10 }],
      user: currentUser,
    });

    expect(state.hasPendingRequest).toBe(false);
    expect(state.hasAcceptedRequest).toBe(false);
    expect(state.isParticipating).toBe(true);
    expect(state.effectiveStatus).toBe('accepted');
  });
});
