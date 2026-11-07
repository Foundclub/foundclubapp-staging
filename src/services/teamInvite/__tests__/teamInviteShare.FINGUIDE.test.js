// FIN-GUIDE, point 4 (recette d'Adel sur iPhone, 02/11) : « quand on invite les joueurs et qu'on
// revient sur l'app, rien ne se passe ». Le repartage d'un lien existant et le SMS ne disaient
// rien au guide : son étape restait sans issue.
import {
  resetGuidanceRuntimeForTests,
  subscribeToGuidanceSignals,
} from '@/domains/guidance/guidanceRuntime';

const mockShare = jest.fn();
const mockOpenURL = jest.fn(() => Promise.resolve());
const mockPlatform = { OS: 'ios' };
// GUIDE-E-CORR (TG-14) : sur Android et pour le SMS, le guide demande au RETOUR dans l'app.
const mockAppState = { currentState: 'active', listeners: [] };
const backInApp = () => {
  ['background', 'active'].forEach((state) => {
    mockAppState.currentState = state;
    [...mockAppState.listeners].forEach((listener) => listener(state));
  });
};

jest.mock('react-native', () => ({
  AppState: {
    addEventListener: (type, listener) => {
      mockAppState.listeners.push(listener);
      return { remove: () => { mockAppState.listeners = []; } };
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

const { openInviteSms, shareExistingTeamInvite } = require('../teamInviteShare');

let signals;
let unsubscribe;
beforeEach(() => {
  resetGuidanceRuntimeForTests();
  signals = [];
  unsubscribe = subscribeToGuidanceSignals(
    (signal) => signals.push(`${signal.kind}:${signal.key}`),
  );
  mockShare.mockReset();
  mockPlatform.OS = 'ios';
});
afterEach(() => unsubscribe?.());

const existing = () => shareExistingTeamInvite({ code: 'C1', teamId: 'team-1', teamName: 'U13' });

describe('repartage d’un lien existant', () => {
  it('iPhone, envoyé : le guide le sait', async () => {
    mockShare.mockResolvedValue({ action: 'sharedAction' });
    await existing();
    expect(signals).toContain('action:team.invite.shared');
  });

  it('iPhone, annulé : le guide le sait', async () => {
    mockShare.mockResolvedValue({ action: 'dismissedAction' });
    await existing();
    expect(signals).toContain('interaction:team.invite.dismissed');
  });

  it('Android ne sait jamais : le guide demande', async () => {
    mockPlatform.OS = 'android';
    mockShare.mockResolvedValue({ action: 'sharedAction' });
    await existing();
    backInApp();
    expect(signals).toContain('interaction:team.invite.returned');
  });
});

describe('SMS d’invitation', () => {
  it('au retour, le guide demande : l’app ne sait pas si le SMS est parti', async () => {
    await openInviteSms({ message: 'Viens', phoneNumber: '0612345678', url: 'https://x' });
    backInApp();
    expect(signals).toContain('interaction:team.invite.returned');
  });
});
