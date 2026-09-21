const mockGetInstallReferrer = jest.fn();
const mockHasWebURL = jest.fn();
const mockGetString = jest.fn();
const mockValues = new Map();

jest.mock('react-native', () => ({
  NativeModules: {
    FoundClubInstallReferrer: { getInstallReferrer: (...args) => mockGetInstallReferrer(...args) },
  },
  Platform: { OS: 'android' },
}));

jest.mock('@react-native-clipboard/clipboard', () => ({
  __esModule: true,
  default: {
    getString: (...args) => mockGetString(...args),
    hasWebURL: (...args) => mockHasWebURL(...args),
  },
}));

jest.mock('@/store/appContext', () => ({
  storage: {
    getString: (key) => mockValues.get(key),
    set: (key, value) => mockValues.set(key, value),
  },
}));

const { Platform } = require('react-native');

const {
  readAndroidDeferredInviteUrl,
  readIOSClipboardInviteUrl,
  shouldOfferIOSClipboardInvite,
} = require('./deferredInviteRecovery');

const CODE = 'AbCdEfGhIjKlMnOpQrStUv12';

describe('INVIT3 — reprise differee par plateforme', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockValues.clear();
    Platform.OS = 'android';
  });

  it('Android : importe le referrer Play une seule fois', async () => {
    mockGetInstallReferrer.mockResolvedValue(
      `fc_invite=1&subject=team&id=team-senior&c=${CODE}`,
    );

    await expect(readAndroidDeferredInviteUrl())
      .resolves.toBe(`https://foundclub.app/i/team/team-senior?c=${CODE}`);
    await expect(readAndroidDeferredInviteUrl()).resolves.toBeNull();
    expect(mockGetInstallReferrer).toHaveBeenCalledTimes(1);
  });

  it('Android : une indisponibilite Play reste retentable', async () => {
    mockGetInstallReferrer
      .mockRejectedValueOnce(new Error('service unavailable'))
      .mockResolvedValueOnce('fc_invite=1&subject=team&id=team-senior');

    await expect(readAndroidDeferredInviteUrl()).resolves.toBeNull();
    await expect(readAndroidDeferredInviteUrl())
      .resolves.toBe('https://foundclub.app/i/team/team-senior');
    expect(mockGetInstallReferrer).toHaveBeenCalledTimes(2);
  });

  it('iOS : detecte une URL sans la lire, puis ne lit qu apres le geste utilisateur', async () => {
    Platform.OS = 'ios';
    mockHasWebURL.mockResolvedValue(true);
    mockGetString.mockResolvedValue(
      `https://foundclub.app/i/team/team-senior?c=${CODE}`,
    );

    await expect(shouldOfferIOSClipboardInvite()).resolves.toBe(true);
    expect(mockGetString).not.toHaveBeenCalled();
    await expect(readIOSClipboardInviteUrl())
      .resolves.toBe(`https://foundclub.app/i/team/team-senior?c=${CODE}`);
    expect(mockGetString).toHaveBeenCalledTimes(1);
  });

  it(
    'iOS : refuse le contenu du presse-papiers qui n est pas une invitation FoundClub',
    async () => {
      Platform.OS = 'ios';
      mockGetString.mockResolvedValue('https://example.test/i/team/team-senior');

      await expect(readIOSClipboardInviteUrl()).resolves.toBeNull();
    },
  );
});
