// @ts-nocheck
/**
 * CARTECODE Q2 B (registre des mineurs ligne 44) — la vignette de la carte sur le profil d'un
 * AUTRE : majeur, compte non privé, membre connecté ; jamais pour un mineur. Elle ne montre que
 * ce que le profil public rend (ni numéro, ni nationalité, ni ville).
 */
import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

import ProfileCardThumb from '../ProfileCardThumb';

/** @type {any[]} */
const mockCartes = [];

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (cle, repli) => (typeof repli === 'string' ? repli : cle) }),
}));

jest.mock('@/components/organisms/playerCard/PlayerCard', () => ({
  __esModule: true,
  default: function PlayerCardMock(props) {
    mockCartes.push(props);
    return null;
  },
}));

const LEA = {
  age: 22,
  avatar: { url: '/lea.jpg' },
  club: { logo: { url: '/pab.png' }, name: "Pays d'Aix Basket" },
  documentId: 'lea',
  firstname: 'Léa',
  height: 170,
  isLookingForClub: true,
  lastname: 'Moreau',
  myTeams: [{ club: { name: "Pays d'Aix Basket" }, name: 'Séniors F' }],
  position: 'Meneuse',
  preferredSport: 'Basket',
  weight: 61,
};
const LECTEUR = { documentId: 'moi' };

const rendre = (profile, viewer = LECTEUR) => {
  mockCartes.length = 0;
  act(() => {
    renderer.create(createElement(ProfileCardThumb, { profile, viewer, width: 240 }));
  });
  return mockCartes[mockCartes.length - 1];
};

describe('CARTECODE Q2 B — la carte sur le profil d’un autre', () => {
  it('majeure, compte public, membre connecté : sa carte, son âge, son club et son équipe', () => {
    const carte = rendre(LEA);
    expect(carte).toEqual(
      expect.objectContaining({
        age: '22 ans',
        club: "Pays d'Aix Basket",
        equipe: 'Séniors F',
        mode: 'image',
        prenom: 'Léa',
      }),
    );
    expect(carte.qrValue).toContain('lea'); // adulte public : le code mène à son profil
  });

  it('ni numéro, ni nationalité, ni ville : le profil public ne les rend pas', () => {
    const carte = rendre(LEA);
    expect('numero' in carte).toBe(false);
    expect('nationalite' in carte).toBe(false);
    expect('ville' in carte).toBe(false);
  });

  it('jamais pour un mineur, un âge inconnu, un compte privé ou un visiteur', () => {
    expect(rendre({ ...LEA, age: 17 })).toBeUndefined();
    expect(rendre({ ...LEA, age: null })).toBeUndefined();
    expect(rendre({ ...LEA, isProfileVisible: false })).toBeUndefined();
    expect(rendre(LEA, null)).toBeUndefined();
  });
});
