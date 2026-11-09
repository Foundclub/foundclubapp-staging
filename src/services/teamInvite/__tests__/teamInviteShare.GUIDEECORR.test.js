// GUIDE-E-CORR (TG-14, tournée du 07/11) : sur Android, la question « Tu l'as envoyé ? »
// s'affichait feuille de partage encore ouverte (le module rend « partagé » dès l'ouverture du
// sélecteur) ; et un partage sans réponse passait pour « annulé ».
import {
  resetGuidanceRuntimeForTests,
  subscribeToGuidanceSignals,
} from '@/domains/guidance/guidanceRuntime';

const mockShare = jest.fn();
const mockOpenURL = jest.fn(() => Promise.resolve());
const mockPlatform = { OS: 'android' };
const mockAppState = { currentState: 'active', listeners: [] };

jest.mock('react-native', () => ({
  AppState: {
    addEventListener: (type, listener) => {
      mockAppState.listeners.push(listener);
      return {
        remove: () => {
          mockAppState.listeners = mockAppState.listeners.filter((one) => one !== listener);
        },
      };
    },
    get currentState() { return mockAppState.currentState; },
  },
  Linking: { openURL: (...args) => mockOpenURL(...args) },
  Platform: mockPlatform,
  Share: { dismissedAction: 'dismissedAction', sharedAction: 'sharedAction' },
}));
jest.mock('@/platform/share', () => ({
  __esModule: true,
  default: { share: (...args) => mockShare(...args) },
}));
jest.mock('@/services/teamInvite/teamInviteService', () => ({
  createTeamInviteLink: () => Promise.resolve({ code: 'ABC123' }),
}));
jest.mock('@/utils/shareLinks', () => ({ resolveShareEnvironment: () => 'staging' }));

const { openInviteSms, shareTeamInviteLink } = require('../teamInviteShare');

const setAppState = (state) => {
  mockAppState.currentState = state;
  [...mockAppState.listeners].forEach((listener) => listener(state));
};

let signals;
let unsubscribe;
beforeEach(() => {
  resetGuidanceRuntimeForTests();
  signals = [];
  unsubscribe = subscribeToGuidanceSignals(
    (signal) => signals.push(`${signal.kind}:${signal.key}`),
  );
  mockShare.mockReset();
  mockAppState.currentState = 'active';
  mockAppState.listeners = [];
  mockPlatform.OS = 'android';
});
afterEach(() => unsubscribe?.());

const share = () => shareTeamInviteLink({ teamId: 'team-1', teamName: 'U13' });

describe('Android : la question attend le retour dans l’app', () => {
  it('sélecteur ouvert : aucun signal ; revenu dans l’app : « returned »', async () => {
    mockShare.mockResolvedValue({ action: 'sharedAction' });
    await share();
    expect(signals).toEqual([]);
    setAppState('background');
    expect(signals).toEqual([]);
    setAppState('active');
    expect(signals).toEqual(['interaction:team.invite.returned']);
    setAppState('background');
    setAppState('active');
    expect(signals).toHaveLength(1);
  });

  it('SMS : la question attend aussi le retour de l’app SMS', async () => {
    await openInviteSms({ message: 'Viens', phoneNumber: '0612345678', url: 'https://x' });
    expect(signals).toEqual([]);
    setAppState('background');
    setAppState('active');
    expect(signals).toEqual(['interaction:team.invite.returned']);
  });
});

describe('iPhone et site : ce que dit la plateforme', () => {
  beforeEach(() => { mockPlatform.OS = 'ios'; });

  it('« partagé » : envoi certain', async () => {
    mockShare.mockResolvedValue({ action: 'sharedAction' });
    await share();
    expect(signals).toEqual(['action:team.invite.shared']);
  });

  it('« annulé » : annulé', async () => {
    mockShare.mockResolvedValue({ action: 'dismissedAction' });
    await share();
    expect(signals).toEqual(['interaction:team.invite.dismissed']);
  });

  it('erreur, sans réponse : inconnu, le guide demande (pas « annulé »)', async () => {
    mockShare.mockRejectedValue(new Error('x'));
    await share();
    expect(signals).toEqual(['interaction:team.invite.returned']);
  });

  it('site, lien seulement copié : inconnu, le guide demande', async () => {
    mockPlatform.OS = 'web';
    mockShare.mockResolvedValue({ action: 'copie' });
    await share();
    expect(signals).toEqual(['interaction:team.invite.returned']);
  });
});
