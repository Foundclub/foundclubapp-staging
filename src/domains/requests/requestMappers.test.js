import { mapEventParticipationRequestToHubItem } from './requestMappers';

describe('requestMappers', () => {
  test('maps an event participation request with requester identity', () => {
    const item = mapEventParticipationRequestToHubItem(
      {
        documentId: 'event-1',
        name: 'Detection / Seance d essai',
        team: { name: 'Senior 2' },
      },
      {
        createdAt: '2026-03-25T10:00:00.000Z',
        documentId: 'request-1',
        sourceTeam: { name: 'U20' },
        user: {
          avatar: { url: '/uploads/avatar.jpg' },
          documentId: 'user-1',
          firstname: 'Leo',
          lastname: 'Martin',
        },
      },
    );

    expect(item).toEqual({
      actions: { primary: 'validate', secondary: 'reject' },
      createdAt: '2026-03-25T10:00:00.000Z',
      id: 'event:event-1:participation:request-1',
      meta: expect.objectContaining({
        eventId: 'event-1',
        eventName: 'Detection / Seance d essai',
        participationRequestId: 'request-1',
        requesterAvatarUrl: '/uploads/avatar.jpg',
        requesterId: 'user-1',
        requesterName: 'Leo Martin',
        sourceTeamName: 'U20',
        teamName: 'Senior 2',
      }),
      status: 'pending',
      subtitle: 'Detection / Seance d essai - Senior 2',
      title: 'Validation evenement',
      type: 'event',
    });
  });

  test('falls back to the phone number when requester names are missing', () => {
    const item = mapEventParticipationRequestToHubItem(
      {
        documentId: 'event-2',
        type: { name: 'Match' },
      },
      {
        documentId: 'request-2',
        user: {
          documentId: 'user-2',
          phoneNumber: '+33600000000',
        },
      },
    );

    expect(item.meta.requesterName).toBe('+33600000000');
  });
});
