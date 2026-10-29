// GUIDE-FINITIONS-3, n° 22 du rejeu : sur Android, fermer la feuille de partage
// sans rien envoyer comptait comme un envoi (M2 validée à tort). Android ne
// distingue pas l'abandon : le guide doit demander, pas conclure.
import {
  resetGuidanceRuntimeForTests,
  subscribeToGuidanceSignals,
} from '@/domains/guidance/guidanceRuntime';

const mockShare = jest.fn();
const mockPlatform = { OS: 'android' };

jest.mock('react-native', () => ({
  Linking: { openURL: jest.fn() },
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

const { shareTeamInviteLink } = require('../teamInviteShare');

let signals;
let unsubscribe;
beforeEach(() => {
  resetGuidanceRuntimeForTests();
  signals = [];
  unsubscribe = subscribeToGuidanceSignals(
    (signal) => signals.push(`${signal.kind}:${signal.key}`),
  );
  mockShare.mockReset();
});
afterEach(() => unsubscribe?.());

const share = () => shareTeamInviteLink({ teamId: 'team-1', teamName: 'U13' });

describe('n° 22 — feuille de partage et guide', () => {
  it('Android : la feuille revient « partagé » même abandonnée ⇒ pas d’envoi annoncé', async () => {
    mockPlatform.OS = 'android';
    mockShare.mockResolvedValue({ action: 'sharedAction' });
    await share();
    expect(signals).not.toContain('action:team.invite.shared');
    expect(signals).toContain('interaction:team.invite.returned');
  });

  it('iPhone : envoyé ⇒ envoi annoncé (témoin)', async () => {
    mockPlatform.OS = 'ios';
    mockShare.mockResolvedValue({ action: 'sharedAction' });
    await share();
    expect(signals).toContain('action:team.invite.shared');
  });

  it('iPhone : fermé sans envoyer ⇒ retour au lien (témoin)', async () => {
    mockPlatform.OS = 'ios';
    mockShare.mockResolvedValue({ action: 'dismissedAction' });
    await share();
    expect(signals).toEqual(['interaction:team.invite.dismissed']);
  });
});
