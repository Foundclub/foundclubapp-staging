/**
 * INVIT2 · C — LE LIEN PARTAGE : il dit qui invite, il ouvre l'app, il porte un code.
 *
 * Mesure du 15/09 (curl, recette ET production) : le lien d'avant partait sur le
 * domaine de l'API, dont les fichiers de reconnaissance repondent 404 — le
 * telephone ouvrait donc le NAVIGATEUR avant de rebondir sur l'app, et la
 * fenetre ne nommait personne. `foundclub.app/.well-known/apple-app-site-association`
 * repond 200 et reclame deja `/i/*`.
 */
import i18next from 'i18next';

import fr from '@/theme/strings/translations/fr';

const mockCreateLink = jest.fn();
const mockShare = jest.fn(() => Promise.resolve());
const mockOpenUrl = jest.fn(() => Promise.resolve());

jest.mock('react-native', () => ({
  Linking: { openURL: (...args) => mockOpenUrl(...args) },
  Platform: { OS: 'android' },
}));
jest.mock('@/platform/share', () => ({
  __esModule: true,
  default: { share: (...args) => mockShare(...args) },
}));
// ⚠️ Ecrite EN ENTIER : le vrai service importe `client`, qui exige un `.env`.
jest.mock('@/services/teamInvite/teamInviteService', () => ({
  createTeamInviteLink: (...args) => mockCreateLink(...args),
}));
jest.mock('@/utils/shareLinks', () => ({
  resolveShareEnvironment: (appEnv) => (
    String(appEnv || 'staging') === 'production' ? 'production' : 'staging'
  ),
}));

const {
  buildTeamInviteUrl,
  openInviteSms,
  shareTeamInviteLink,
} = require('../teamInviteShare');

const CODE = 'AbCdEfGhIjKlMnOpQrStUv12';

beforeAll(async () => {
  await i18next.init({
    compatibilityJSON: 'v4', fallbackLng: 'fr', lng: 'fr', resources: { fr: { translation: fr } },
  });
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('INVIT2 · C — le lien d invitation d equipe', () => {
  test('🔴 production : foundclub.app/i/team/<id>?c=<code> (plus de detour par l API)', () => {
    expect(buildTeamInviteUrl({ appEnv: 'production', code: CODE, teamId: 'team-senior' }))
      .toBe(`https://foundclub.app/i/team/team-senior?c=${CODE}`);
  });

  test('recette : le code n existe qu en recette, le lien y reste', () => {
    expect(buildTeamInviteUrl({ appEnv: 'staging', code: CODE, teamId: 'team-senior' }))
      .toBe(`https://staging.foundclub.app/i/team/team-senior?c=${CODE}`);
  });

  test('🔴 le partage nomme invitant, equipe et club, puis le lien avec son code', async () => {
    mockCreateLink.mockResolvedValue({ code: CODE, expiresAt: '2026-10-15T00:00:00Z' });

    const result = await shareTeamInviteLink({
      clubName: 'FoundClub', inviterName: 'Adel', teamId: 'team-senior', teamName: 'SENIOR',
    });

    expect(mockCreateLink).toHaveBeenCalledWith('team-senior');
    expect(mockShare).toHaveBeenCalledTimes(1);
    const [{ message, url }] = mockShare.mock.calls[0];
    expect(url).toContain(`/i/team/team-senior?c=${CODE}`);
    expect(message).toBe(
      'Adel t\'invite à rejoindre l\'équipe SENIOR (FoundClub) sur FoundClub.'
      + ' Ouvre ce lien pour voir l\'invitation :'
      + `\n${url}`,
    );
    expect(result.code).toBe(CODE);
  });

  test('🔒 sans reseau, le lien part quand meme — sans code, donc en DEMANDE', async () => {
    mockCreateLink.mockRejectedValue(new Error('hors ligne'));

    const result = await shareTeamInviteLink({ teamId: 'team-senior', teamName: 'SENIOR' });

    expect(mockShare).toHaveBeenCalledTimes(1);
    expect(result.url).toMatch(/\/i\/team\/team-senior$/);
  });

  test('l invitation par numero ouvre le SMS avec le message', async () => {
    await openInviteSms({ message: 'Bonjour\nhttps://x', phoneNumber: '06 12 34 56 78', url: 'https://x' });
    expect(mockOpenUrl).toHaveBeenCalledWith(`sms:0612345678?body=${encodeURIComponent('Bonjour\nhttps://x')}`);
  });
});
