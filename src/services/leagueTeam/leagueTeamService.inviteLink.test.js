const mockDelete = jest.fn();
const mockPost = jest.fn();

jest.mock('@/domains/auth/authUseCases', () => ({
  getAuthTokens: jest.fn(() => null),
}));

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: {
    delete: mockDelete,
    post: mockPost,
  },
}));

const { joinSquadViaInviteLink, leaveSquad, removeSquadMember } = require('./leagueTeamService');

describe('joinSquadViaInviteLink', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPost.mockResolvedValue({ data: { data: { documentId: 'squad-doc-1' } } });
  });

  test('posts to the invite-link join endpoint with legal acceptance', async () => {
    const legalAcceptance = {
      accepted: true,
      scope: 'league_team_invitation_accept',
    };

    await joinSquadViaInviteLink('squad-doc-1', 'user-doc-1', { legalAcceptance });

    expect(mockPost).toHaveBeenCalledWith('/league-teams/squad-doc-1/join-invite-link', {
      data: {
        legalAcceptance,
        userId: 'user-doc-1',
      },
    });
  });

  test('omits legal acceptance when none is provided', async () => {
    await joinSquadViaInviteLink('squad-doc-1', 'user-doc-1');

    expect(mockPost).toHaveBeenCalledWith('/league-teams/squad-doc-1/join-invite-link', {
      data: {
        userId: 'user-doc-1',
      },
    });
  });
});

describe('league squad membership service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPost.mockResolvedValue({ data: { data: { documentId: 'squad-doc-1' } } });
  });

  test('leaveSquad posts to the leave endpoint', async () => {
    await leaveSquad('squad-doc-1');

    expect(mockPost).toHaveBeenCalledWith('/league-teams/squad-doc-1/leave');
  });

  test('removeSquadMember posts target user id to the remove endpoint', async () => {
    await removeSquadMember('squad-doc-1', 'user-doc-1');

    expect(mockPost).toHaveBeenCalledWith('/league-teams/squad-doc-1/remove-member', {
      data: {
        userId: 'user-doc-1',
      },
    });
  });
});
