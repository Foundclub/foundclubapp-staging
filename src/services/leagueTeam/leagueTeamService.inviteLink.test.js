const postMock = jest.fn();

jest.mock('@/domains/auth/authUseCases', () => ({
  getAuthTokens: jest.fn(() => null),
}));

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: {
    post: postMock,
  },
}));

const { joinSquadViaInviteLink } = require('./leagueTeamService');

describe('joinSquadViaInviteLink', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    postMock.mockResolvedValue({ data: { data: { documentId: 'squad-doc-1' } } });
  });

  test('posts to the invite-link join endpoint with legal acceptance', async () => {
    const legalAcceptance = {
      accepted: true,
      scope: 'league_team_invitation_accept',
    };

    await joinSquadViaInviteLink('squad-doc-1', 'user-doc-1', { legalAcceptance });

    expect(postMock).toHaveBeenCalledWith('/league-teams/squad-doc-1/join-invite-link', {
      data: {
        legalAcceptance,
        userId: 'user-doc-1',
      },
    });
  });

  test('omits legal acceptance when none is provided', async () => {
    await joinSquadViaInviteLink('squad-doc-1', 'user-doc-1');

    expect(postMock).toHaveBeenCalledWith('/league-teams/squad-doc-1/join-invite-link', {
      data: {
        userId: 'user-doc-1',
      },
    });
  });
});
