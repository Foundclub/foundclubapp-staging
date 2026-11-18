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
jest.mock('@/platform/share', () => ({ __esModule: true, default: { share: jest.fn(() => Promise.resolve()) } }));
jest.mock('@/services/teamInvite/teamInviteService', () => ({ createTeamInviteLink: jest.fn() }));

const { buildTeamInviteUrl, resolveInviteLinkOrigin } = require('../teamInviteShare');

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
