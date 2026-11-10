// @ts-nocheck
/**
 * RARETE-SERVEUR (10/11/2026, Adel « 213- A ») — la vignette de la carte d'un AUTRE joueur ne voit
 * ni ses cases privées (date, nationalité, numéro, ville) ni ses matchs (403 hors encadrants) :
 * elle affichait une rareté plus basse que la vraie. Le serveur rend le palier calculé sur le
 * profil complet (`cardRarity`) ; la vignette l'affiche. Sans palier (ancien serveur, panne), ou
 * avec une valeur inconnue, elle garde le calcul du téléphone.
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

// Ce que le profil public rend d'une joueuse dont la carte est complète en base : 7 cases
// lisibles (photo, nom, âge, poids, taille, sport, poste) = 22, + son équipe 15 = 37 : commune
// pour le téléphone. Le serveur, qui voit les 13 cases et son parcours, dit légendaire.
const SAMIA = {
  age: 24,
  avatar: { url: '/samia.jpg' },
  documentId: 'samia',
  firstname: 'Samia',
  height: 172,
  lastname: 'Benali',
  myTeams: [{ club: { name: 'BC Gardanne' }, name: 'Séniors F' }],
  position: 'Meneuse',
  preferredSport: 'Basketball',
  weight: 63,
};

const rendre = (profile) => {
  mockCartes.length = 0;
  act(() => {
    renderer.create(createElement(ProfileCardThumb, {
      profile, viewer: { documentId: 'moi' }, width: 240,
    }));
  });
  return mockCartes[mockCartes.length - 1];
};

describe('RARETE-SERVEUR — la vignette affiche le palier du serveur', () => {
  it('un joueur Légendaire vu par un autre : LEGENDARY, pas le calcul partiel du téléphone', () => {
    expect(rendre({ ...SAMIA, cardRarity: 'legendary' }).rarity).toBe('LEGENDARY');
  });

  it('chaque palier du serveur passe tel quel', () => {
    expect(rendre({ ...SAMIA, cardRarity: 'epic' }).rarity).toBe('EPIC');
    expect(rendre({ ...SAMIA, cardRarity: 'rare' }).rarity).toBe('RARE');
    expect(rendre({ ...SAMIA, cardRarity: 'common' }).rarity).toBe('COMMON');
  });

  it('ancien serveur sans palier : le calcul du téléphone (repli)', () => {
    expect(rendre(SAMIA).rarity).toBe('COMMON');
    expect(rendre({ ...SAMIA, cardRarity: null }).rarity).toBe('COMMON');
  });

  it('une valeur inconnue du serveur : le calcul du téléphone, jamais une carte cassée', () => {
    expect(rendre({ ...SAMIA, cardRarity: 'mythique' }).rarity).toBe('COMMON');
    expect(rendre({ ...SAMIA, cardRarity: 85 }).rarity).toBe('COMMON');
  });

  it('le palier ne fait pas apparaître la vignette d’un mineur', () => {
    expect(rendre({ ...SAMIA, age: 16, cardRarity: 'legendary' })).toBeUndefined();
  });
});
