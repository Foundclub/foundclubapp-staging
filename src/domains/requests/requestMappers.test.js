import {
  getAvailableRequestHubFilters,
  mapClubInterestRequestToHubItem,
  mapClubMembershipRequestToHubItem,
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
      title: 'Validation événement',
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
      subtitle: 'Leo Martin a demandé à rejoindre U18. Ton équipe doit attendre la validation par ton ou tes dirigeant(s).',
      title: 'Demande équipe en validation',
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

  test('maps club claim requests as read only for non superadmin viewers', () => {
    const item = mapClubMembershipRequestToHubItem({
      club: {
        documentId: 'club-1',
        name: 'FC Test',
      },
      createdAt: '2026-06-10T09:00:00.000Z',
      documentId: 'claim-1',
      type: 'claim',
      user: {
        documentId: 'user-1',
        firstname: 'Leo',
        lastname: 'Martin',
      },
    });

    expect(item).toEqual(expect.objectContaining({
      actions: {},
      id: 'club:claim-1',
      subtitle: 'Leo Martin veut revendiquer la gestion du club FC Test. Revendication en cours de vérification FoundClub.',
      title: 'Revendication club en vérification',
      type: 'club',
    }));
    expect(item.meta).toEqual(expect.objectContaining({
      infoOnly: true,
      readOnlyReason: 'superadmin_required',
      requestType: 'claim',
    }));
  });

  test('keeps claim actions for superadmin viewers', () => {
    const item = mapClubMembershipRequestToHubItem(
      {
        club: {
          documentId: 'club-1',
          name: 'FC Test',
        },
        documentId: 'claim-1',
        type: 'claim',
        user: {
          documentId: 'user-1',
          firstname: 'Leo',
          lastname: 'Martin',
        },
      },
      { isSuperAdmin: true },
    );

    expect(item.actions).toEqual({ primary: 'accept', secondary: 'reject' });
    expect(item.title).toBe('Revendication club');
    expect(item.meta.infoOnly).toBe(false);
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
      subtitle: 'Mina Diallo est intéressé par Senior 1.',
      title: 'Intérêt club',
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

  // V01 (2026-08-18) — l'interet porte AU CLUB, sans equipe nommee. Il
  // n'existait qu'en theorie tant que le serveur le refusait des qu'un club
  // avait une equipe ; il arrive desormais chez les dirigeants, et le repli
  // « Equipe » leur mentait : personne n'a nomme d'equipe.
  test('V01 — un interet AU CLUB nomme le club, jamais une equipe fantome', () => {
    const item = mapClubInterestRequestToHubItem({
      club: {
        documentId: 'club-1',
        name: 'FC Test',
      },
      createdAt: '2026-08-18T09:00:00.000Z',
      documentId: 'interest-2',
      status: 'pending',
      user: {
        documentId: 'user-2',
        firstname: 'Mina',
        lastname: 'Diallo',
      },
    });

    expect(item.subtitle).toBe('Mina Diallo est intéressé par le club FC Test.');
    // 🔒 Aucune equipe inventee dans les metadonnees non plus : c'est cette
    // absence qui distingue les deux intentions, ici comme cote serveur.
    expect(item.meta.teamId).toBe('');
    expect(item.meta.teamName).toBe('');
    // La conversation reste atteignable : elle ne depend que du demandeur.
    expect(item.actions).toEqual({ primary: 'respond', secondary: 'chat' });
    expect(item.meta.requesterId).toBe('user-2');
  });

  test('returns the team filter for training-team contexts', () => {
    // D92 — « friendly » entre ici : une proposition de match amical se recoit
    // et s envoie d equipe a equipe, jamais au nom d un club seul.
    expect(getAvailableRequestHubFilters({
      teamIds: ['team-1'],
    })).toEqual(['all', 'team', 'interest', 'friendly']);
  });

  // 🎁 Y04 — LE TEMOIN QUE R02 A LAISSE, RETOURNE. Il disait « sans equipe
  // ENTRAINEE, pas de filtre amical » et decrivait le defaut : un dirigeant qui
  // gere son club sans en entrainer aucune n avait aucun onglet « Amicaux »,
  // alors que le serveur lui accorde la gestion de ces equipes.
  test('Y04 — un dirigeant sans equipe entrainee a bien le filtre amical', () => {
    expect(getAvailableRequestHubFilters({ clubId: 'club-1' })).toContain('friendly');
    // Le contre-temoin : sans club NI equipe, il n y a toujours rien a filtrer.
    expect(getAvailableRequestHubFilters({ cmId: 'cm-1' })).not.toContain('friendly');
  });

  test('returns club and event filters only when a club context exists', () => {
    expect(getAvailableRequestHubFilters({
      clubId: 'club-1',
    })).toEqual(['all', 'team', 'interest', 'friendly', 'club', 'event', 'featured']);
    expect(getAvailableRequestHubFilters({
      cmId: 'cm-1',
    })).toEqual(['all', 'featured']);
  });

  test('adds the installation filter only for installation managers', () => {
    expect(getAvailableRequestHubFilters({
      canManageInstallationRequests: true,
      clubId: 'club-1',
      teamIds: ['team-1'],
    })).toEqual(['all', 'team', 'interest', 'friendly', 'club', 'event', 'featured', 'installation']);
  });
});
