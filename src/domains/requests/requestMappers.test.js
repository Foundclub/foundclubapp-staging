import {
  getAvailableRequestHubFilters,
  mapClubInterestRequestToHubItem,
  mapEventParticipationRequestToHubItem,
  mapTeamMembershipRequestToHubItem,
} from '@/domains/requests/requestMappers';

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

  test('maps owner-only team requests as informational for coaches', () => {
    const item = mapTeamMembershipRequestToHubItem({
      createdAt: '2026-05-18T10:00:00.000Z',
      documentId: 'request-1',
      permissions: {
        canManage: false,
        canView: true,
      },
      team: {
        documentId: 'team-1',
        membershipRequestManagementMode: 'CLUB_OWNER_ONLY',
        name: 'U18',
      },
      user: {
        avatar: { url: '/uploads/leo.jpg' },
        documentId: 'user-1',
        firstname: 'Leo',
        lastname: 'Martin',
      },
    });

    expect(item).toEqual(expect.objectContaining({
      actions: {},
      id: 'team:request-1',
      status: 'pending',
      subtitle: 'Leo Martin a demande a rejoindre U18. Votre equipe doit attendre la validation par votre/vos dirigeant(s).',
      title: 'Demande equipe en validation',
      type: 'team',
    }));
    expect(item.meta).toEqual(expect.objectContaining({
      canManage: false,
      governanceMode: 'CLUB_OWNER_ONLY',
      infoOnly: true,
      readOnlyReason: 'club_owner_only',
      requesterAvatarUrl: '/uploads/leo.jpg',
      requesterId: 'user-1',
      teamId: 'team-1',
    }));
  });

  test('maps club interest requests with requester and target team', () => {
    const item = mapClubInterestRequestToHubItem({
      club: {
        documentId: 'club-1',
        name: 'FC Test',
      },
      createdAt: '2026-06-01T09:00:00.000Z',
      documentId: 'interest-1',
      status: 'pending',
      team: {
        documentId: 'team-1',
        name: 'Senior 1',
      },
      user: {
        avatar: { url: '/uploads/player.jpg' },
        documentId: 'user-1',
        firstname: 'Mina',
        lastname: 'Diallo',
      },
    });

    expect(item).toEqual(expect.objectContaining({
      actions: { primary: 'respond', secondary: 'chat' },
      id: 'interest:interest-1',
      status: 'pending',
      subtitle: 'Mina Diallo est interesse par Senior 1.',
      title: 'Interet club',
      type: 'interest',
    }));
    expect(item.meta).toEqual(expect.objectContaining({
      clubId: 'club-1',
      requesterAvatarUrl: '/uploads/player.jpg',
      requesterId: 'user-1',
      requesterName: 'Mina Diallo',
      requestId: 'interest-1',
      teamId: 'team-1',
      teamName: 'Senior 1',
    }));
  });

  test('returns the team filter for training-team contexts', () => {
    expect(getAvailableRequestHubFilters({
      teamIds: ['team-1'],
    })).toEqual(['all', 'team', 'interest']);
  });

  test('returns club and event filters only when a club context exists', () => {
    expect(getAvailableRequestHubFilters({
      clubId: 'club-1',
    })).toEqual(['all', 'team', 'interest', 'club', 'event', 'featured']);
    expect(getAvailableRequestHubFilters({
      cmId: 'cm-1',
    })).toEqual(['all', 'featured']);
  });

  test('adds the installation filter only for installation managers', () => {
    expect(getAvailableRequestHubFilters({
      canManageInstallationRequests: true,
      clubId: 'club-1',
      teamIds: ['team-1'],
    })).toEqual(['all', 'team', 'interest', 'club', 'event', 'featured', 'installation']);
  });
});
