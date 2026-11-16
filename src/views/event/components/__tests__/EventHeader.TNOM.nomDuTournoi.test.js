import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import EventHeader from '../EventHeader';

jest.mock('@/components/molecules/clubLogoMark/ClubLogoMark', () => () => null);

jest.mock('@/theme/themeContext', () => {
  const vide = {};
  const rampe = () => new Proxy({}, { get: () => vide });
  const espaces = new Proxy({}, {
    get: (_cible, groupe) => new Proxy({}, {
      get: (_c, valeur) => (
        groupe === 'paddingVertical' ? { paddingVertical: Number(valeur) } : vide
      ),
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
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => (
      typeof repli === 'string' ? repli : cle
    ),
  }),
}));

// T-NOM (16/11) — le titre de la fiche d'un tournoi nommé est son nom donné (« FoundClub x AR
// Soccer »), même quand `name` porte encore le nom machine (tournoi relu avant son prochain
// enregistrement). Sans nom donné : `name`, comme avant.

const textes = (/** @type {any} */ evenement) => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(<EventHeader event={evenement} />);
  });
  const tous = arbre.root.findAllByType(Text)
    .map((noeud) => [].concat(noeud.props.children).join(''));
  act(() => arbre.unmount());
  return tous;
};

const tournoi = (/** @type {any} */ surcharges = {}) => ({
  club: { name: 'AR Soccer' },
  date: '2026-12-19T18:00:00.000Z',
  documentId: 'e1',
  name: 'Tournoi - 19/12/2026',
  type: { name: 'Tournoi' },
  ...surcharges,
});

describe('T-NOM — le titre de la fiche d un tournoi', () => {
  it('tournoi nommé : son nom donné', () => {
    const vus = textes(tournoi({ customName: 'FoundClub x AR Soccer' }));
    expect(vus).toContain('FoundClub x AR Soccer');
  });

  it('tournoi sans nom donné : name, inchangé', () => {
    const vus = textes(tournoi());
    expect(vus).toContain('Tournoi - 19/12/2026');
    expect(vus).not.toContain('FoundClub x AR Soccer');
  });
});
