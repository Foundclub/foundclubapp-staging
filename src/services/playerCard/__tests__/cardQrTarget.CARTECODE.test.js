// CARTECODE (26/10/2026) — registre des mineurs ligne 39 (et 23, 46) : le code QR de la carte
// d'un 13-17 ans, et de tout compte privé, mène simplement à FoundClub, SANS l'identifiant ;
// moins de 13 ans : aucun code QR. Âge inconnu : traité comme un mineur (chemin le plus sûr).
jest.mock('@/utils/shareLinks', () => ({
  buildInstallLandingUrl: ({ id, source, type }) => `https://foundclub.com/install.html?type=${type}&id=${id}&source=${source}`,
  buildPublicWebUrl: ({ path }) => `https://foundclub.app${path}`,
}));

// eslint-disable-next-line import/first
import { buildCardQrTarget } from '../cardQrTarget';

const NOW = new Date('2026-10-26T12:00:00');
const qr = (user) => buildCardQrTarget({
  audience: 'player', now: NOW, user: { documentId: 'u1', ...user },
});

describe('CARTECODE — où mène le code QR de la carte', () => {
  test('adulte, compte public : son profil (avec l’identifiant)', () => {
    expect(qr({ birthdate: '2000-03-14' }).url).toContain('id=u1');
  });
  test.each([
    ['un ado de 16 ans', { birthdate: '2010-03-14' }],
    ['un adulte au compte privé', { birthdate: '2000-03-14', isProfileVisible: false }],
    ['un compte sans date de naissance', {}],
  ])('%s : FoundClub, sans l’identifiant', (_cas, user) => {
    const cible = qr(user);
    expect(cible.kind).toBe('install');
    expect(cible.url).not.toContain('u1');
  });
  test('moins de 13 ans : aucun code QR', () => {
    expect(qr({ birthdate: '2016-03-14' })).toEqual({ kind: 'none', url: '' });
  });
});
