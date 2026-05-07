const mockStorage = {
  delete: jest.fn(),
  getString: jest.fn(),
  set: jest.fn(),
};

jest.mock('@/store/appContext', () => ({
  storage: mockStorage,
}));

const {
  clearPendingSquadInviteLink,
  readPendingSquadInviteLink,
  savePendingSquadInviteLink,
} = require('./pendingSquadInviteLink');

describe('pendingSquadInviteLink', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('saves a normalized pending squad invite', () => {
    savePendingSquadInviteLink(' squad-doc-1 ');

    expect(mockStorage.set).toHaveBeenCalledWith(
      'pendingLeagueSquadInviteLink',
      JSON.stringify({
        createdAt: 1_700_000_000_000,
        teamId: 'squad-doc-1',
      }),
    );
  });

  test('does not save an empty squad id', () => {
    savePendingSquadInviteLink('   ');

    expect(mockStorage.set).not.toHaveBeenCalled();
  });

  test('reads a recent pending invite', () => {
    mockStorage.getString.mockReturnValue(JSON.stringify({
      createdAt: 1_700_000_000_000,
      teamId: 'squad-doc-1',
    }));

    expect(readPendingSquadInviteLink()).toEqual({
      createdAt: 1_700_000_000_000,
      teamId: 'squad-doc-1',
    });
    expect(mockStorage.delete).not.toHaveBeenCalled();
  });

  test('drops an expired pending invite', () => {
    mockStorage.getString.mockReturnValue(JSON.stringify({
      createdAt: 1_700_000_000_000 - (8 * 24 * 60 * 60 * 1000),
      teamId: 'squad-doc-1',
    }));

    expect(readPendingSquadInviteLink()).toBeNull();
    expect(mockStorage.delete).toHaveBeenCalledWith('pendingLeagueSquadInviteLink');
  });

  test('clears the pending invite', () => {
    clearPendingSquadInviteLink();

    expect(mockStorage.delete).toHaveBeenCalledWith('pendingLeagueSquadInviteLink');
  });
});
