// GUIDES-SITE-CORR-2 (M1096, testeur 10/11, Windows + Chrome) : sur un ordinateur, « Partager un
// lien d'invitation » ouvrait la fenêtre Partager de Windows, impossible à fermer, et le guide
// passait à la mission 3 avant tout envoi. Décision du chef : sur ordinateur, le bouton COPIE le
// lien et le dit ; le partage du système reste au téléphone ; le guide n'avance qu'après la copie
// (et demande « Tu l'as envoyé ? », sans valider seul).
import {
  resetGuidanceRuntimeForTests,
  subscribeToGuidanceSignals,
} from '@/domains/guidance/guidanceRuntime';

const mockShare = jest.fn();
const mockCopier = jest.fn();
const mockPlatform = { OS: 'web' };

jest.mock('react-native', () => ({
  AppState: { addEventListener: () => ({ remove: () => {} }), currentState: 'active' },
  Linking: { openURL: () => Promise.resolve() },
  Platform: mockPlatform,
  Share: { dismissedAction: 'dismissedAction', sharedAction: 'sharedAction' },
}));
jest.mock('@/platform/share', () => ({
  __esModule: true,
  default: {
    copier: (...args) => mockCopier(...args),
    share: (...args) => mockShare(...args),
  },
}));
jest.mock('@/services/teamInvite/teamInviteService', () => ({
  createTeamInviteLink: () => Promise.resolve({ code: 'ABC123' }),
}));
jest.mock('@/utils/shareLinks', () => ({ resolveShareEnvironment: () => 'staging' }));

const { shareExistingTeamInvite, shareTeamInviteLink } = require('../teamInviteShare');

let signals;
let unsubscribe;
const largeurAvant = global.window;
const poserLargeur = (width) => { global.window = { innerWidth: width }; };

beforeEach(() => {
  resetGuidanceRuntimeForTests();
  signals = [];
  unsubscribe = subscribeToGuidanceSignals(
    (signal) => signals.push(`${signal.kind}:${signal.key}`),
  );
  mockShare.mockReset().mockResolvedValue({ action: 'partage' });
  mockCopier.mockReset().mockResolvedValue(true);
  mockPlatform.OS = 'web';
});
afterEach(() => {
  unsubscribe?.();
  global.window = largeurAvant;
});

describe('M1096 — site sur un ordinateur : le lien est copié, pas partagé', () => {
  it('1280 px : aucune fenêtre de partage ; message et lien au presse-papiers', async () => {
    poserLargeur(1280);
    const result = await shareTeamInviteLink({ teamId: 'team-1', teamName: 'U13' });
    expect(mockShare).not.toHaveBeenCalled();
    expect(mockCopier).toHaveBeenCalledTimes(1);
    expect(mockCopier.mock.calls[0][0]).toContain('https://staging.foundclub.app/i/team/team-1');
    expect(result.envoi).toBe('copie');
  });

  it('1280 px : le guide ne valide pas la mission, il demande (« returned »)', async () => {
    poserLargeur(1280);
    await shareTeamInviteLink({ teamId: 'team-1', teamName: 'U13' });
    expect(signals).toEqual(['interaction:team.invite.returned']);
  });

  it('1280 px, copie refusée par le navigateur : l’écran le sait (« echec »)', async () => {
    poserLargeur(1280);
    mockCopier.mockResolvedValue(false);
    const result = await shareTeamInviteLink({ teamId: 'team-1', teamName: 'U13' });
    expect(mockShare).not.toHaveBeenCalled();
    expect(result.envoi).toBe('echec');
  });

  it('le repartage d’une invitation existante copie aussi, sur ordinateur', async () => {
    poserLargeur(1280);
    await shareExistingTeamInvite({ code: 'XYZ', teamId: 'team-1', teamName: 'U13' });
    expect(mockShare).not.toHaveBeenCalled();
    expect(mockCopier.mock.calls[0][0]).toContain('/i/team/team-1');
  });
});

describe('Le partage du système reste là où il marche', () => {
  it('site sur un téléphone (390 px) : la feuille de partage du navigateur', async () => {
    poserLargeur(390);
    const result = await shareTeamInviteLink({ teamId: 'team-1', teamName: 'U13' });
    expect(mockShare).toHaveBeenCalledTimes(1);
    expect(mockCopier).not.toHaveBeenCalled();
    expect(result.envoi).toBe('');
  });

  it('application iPhone, même large (iPad) : la feuille de partage', async () => {
    mockPlatform.OS = 'ios';
    poserLargeur(1280);
    await shareTeamInviteLink({ teamId: 'team-1', teamName: 'U13' });
    expect(mockShare).toHaveBeenCalledTimes(1);
    expect(mockCopier).not.toHaveBeenCalled();
  });
});
