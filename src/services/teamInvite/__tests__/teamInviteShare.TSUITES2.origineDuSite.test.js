/* eslint-disable max-len -- les témoins se lisent en entier. */
/**
 * T-SUITES-TOURNOI (18/11, décision du chef « 1- B ») — LE LIEN D'INVITATION VISE LE SITE DE LA BUILD.
 *
 * La build iOS de recette écrit `APP_ENV=production` (scripts/ci/ios/preparer_build.py) : le lien
 * d'invitation, qui ne lisait que `APP_ENV`, partait sur foundclub.app, où le code (créé dans la base
 * de la recette) n'existe pas. Il lit maintenant `WEB_APP_URL` d'abord, comme `resolveAppSiteOrigin`
 * (utils/shareLinks.js, la règle des liens vers le site) ; sans lui, la règle d'avant.
 * `@/utils/shareLinks` n'est PAS doublé ici : c'est la vraie règle qui est jugée.
 */
jest.mock('react-native', () => ({
  AppState: { addEventListener: () => ({ remove: () => {} }), currentState: 'active' },
  Linking: { openURL: jest.fn(() => Promise.resolve()) },
  Platform: { OS: 'ios' },
}));
const mockCopier = jest.fn(() => Promise.resolve(true));
const mockShare = jest.fn(() => Promise.resolve());
jest.mock('@/platform/share', () => ({ __esModule: true, default: { copier: (...a) => mockCopier(...a), share: (...a) => mockShare(...a) } }));
jest.mock('@/services/teamInvite/teamInviteService', () => ({ createTeamInviteLink: jest.fn() }));
jest.mock('@/services/tournamentTeam/tournamentTeamService', () => ({
  createTournamentTeamInviteLink: jest.fn(async () => ({ code: 'CODE123', eventDocumentId: 'evt-1' })),
}));

const { buildTeamInviteUrl, resolveInviteLinkOrigin, shareTournamentTeamInviteLink } = require('../teamInviteShare');

const avant = { FRONTEND_URL: process.env.FRONTEND_URL, WEB_APP_URL: process.env.WEB_APP_URL };
afterEach(() => {
  Object.entries(avant).forEach(([cle, valeur]) => {
    if (valeur === undefined) delete process.env[cle];
    else process.env[cle] = valeur;
  });
});

describe('T-SUITES-2 (1- B) — le lien d invitation suit WEB_APP_URL', () => {
  test('🔴 build iOS de recette (APP_ENV production, WEB_APP_URL de la recette) : le lien vise la recette', () => {
    process.env.WEB_APP_URL = 'https://staging.foundclub.app';
    expect(resolveInviteLinkOrigin('production')).toBe('https://staging.foundclub.app');
    expect(buildTeamInviteUrl({ appEnv: 'production', code: 'CODE123', teamId: 'team-1' }))
      .toMatch(/^https:\/\/staging\.foundclub\.app\//);
  });

  test('build de prod (WEB_APP_URL de la prod) : foundclub.app, comme avant', () => {
    process.env.WEB_APP_URL = 'https://foundclub.app';
    expect(resolveInviteLinkOrigin('production')).toBe('https://foundclub.app');
  });

  test('sans WEB_APP_URL : la règle d avant (production => foundclub.app, sinon la recette)', () => {
    delete process.env.WEB_APP_URL;
    delete process.env.FRONTEND_URL;
    expect(resolveInviteLinkOrigin('production')).toBe('https://foundclub.app');
    expect(resolveInviteLinkOrigin('staging')).toBe('https://staging.foundclub.app');
  });
});

// T-SUITES-TOURNOI (18/11, point 13) : « Copier le lien » copie le lien SEUL, sans le message.
describe('T-SUITES-2 (13) — copier le lien seul', () => {
  test('🔴 lienSeul : le presse-papiers reçoit l adresse, pas le message ; aucune feuille de partage', async () => {
    process.env.WEB_APP_URL = 'https://staging.foundclub.app';
    const { envoi, url } = await shareTournamentTeamInviteLink({
      eventId: 'evt-1', eventName: 'TEST 3442', lienSeul: true, teamId: 'tt-1', teamName: 'Recette Site 333',
    });
    expect(envoi).toBe('copie');
    expect(mockCopier).toHaveBeenCalledWith(url);
    expect(String(url)).toMatch(/^https:\/\/staging\.foundclub\.app\//);
    expect(mockShare).not.toHaveBeenCalled();
  });
});
