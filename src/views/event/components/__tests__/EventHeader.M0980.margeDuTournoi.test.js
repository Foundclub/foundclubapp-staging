import { ImageBackground, StyleSheet } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import EventHeader from '../EventHeader';

// RETOURS-TESTEUR-2 (06/11/2026, M0980, iPhone) — « Réduire le padding du titre en haut » de la
// fiche d'un tournoi : la carte d'en-tête du tournoi passe de 32 à 16 en haut et en bas. Les
// autres types gardent 32 (le testeur ne parle que du tournoi).

jest.mock('@/components/molecules/clubLogoMark/ClubLogoMark', () => () => null);

jest.mock('@/theme/themeContext', () => {
  const vide = {};
  const rampe = () => new Proxy({}, { get: () => vide });
  // Seuls les espacements verticaux portent leur valeur : c'est ce que ce témoin lit.
  const espaces = new Proxy({}, {
    get: (_cible, groupe) => new Proxy({}, {
      get: (_c, valeur) => (groupe === 'paddingVertical' ? { paddingVertical: Number(valeur) } : vide),
    }),
  });
  return {
    __esModule: true,
    default: () => ({
      Alignments: rampe(),
      ApplicationStyle: new Proxy({}, { get: () => rampe() }),
      Colors: new Proxy({}, { get: (_c, cle) => `couleur-${String(cle)}` }),
      Fonts: new Proxy({}, { get: () => vide }),
      Images: new Proxy({}, { get: () => 1 }),
      Spaces: espaces,
    }),
  };
});

jest.mock('react-i18next', () => ({
  initReactI18next: { init: jest.fn(), type: '3rdParty' },
  useTranslation: () => ({ t: (/** @type {string} */ cle, /** @type {any} */ repli) => (typeof repli === 'string' ? repli : cle) }),
}));

const evenement = (/** @type {string} */ typeName) => ({
  club: { name: 'FC Test' },
  date: '2026-11-20T18:00:00.000Z',
  documentId: 'e1',
  name: 'Coupe d automne',
  type: { name: typeName },
});

const margeDe = (/** @type {string} */ typeName) => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(<EventHeader event={evenement(typeName)} />);
  });
  const carte = arbre.root.findByType(ImageBackground);
  const marge = StyleSheet.flatten(carte.props.style).paddingVertical;
  act(() => arbre.unmount());
  return marge;
};

describe('M0980 — la marge du haut de la fiche d un tournoi', () => {
  it('tournoi : 16', () => {
    expect(margeDe('Tournoi')).toBe(16);
  });

  it('entraînement : 32, inchangé', () => {
    expect(margeDe('Entraînement')).toBe(32);
  });
});
