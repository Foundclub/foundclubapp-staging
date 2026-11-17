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

// T-PARCOURS-2, point 1 (tournée du 17/11, capture app-P1-01) : la fiche du tournoi au téléphone
// ne disait aucun prix, le site affiche « Prix / personne ». Un tournoi payant
// (`tournamentConfig.entryFeeCents` > 0) dit son prix par joueur ; un tournoi gratuit, rien.

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

const tournoi = (/** @type {any} */ config = {}) => ({
  club: { name: 'AR Soccer' },
  date: '2026-12-19T18:00:00.000Z',
  documentId: 'e1',
  name: 'Tournoi - 19/12/2026',
  tournamentConfig: config,
  type: { name: 'Tournoi' },
});

describe('T-PARCOURS-2 — le prix sur la fiche du tournoi, au téléphone', () => {
  it('tournoi payant (2000 centimes) : « 20 € par joueur »', () => {
    expect(textes(tournoi({ entryFeeCents: 2000 }))).toContain('20 € par joueur');
  });

  it('tournoi gratuit ou sans prix : aucune ligne de prix', () => {
    [tournoi({ entryFeeCents: 0 }), tournoi()].forEach((evenement) => {
      expect(textes(evenement).some((texte) => texte.includes('par joueur'))).toBe(false);
    });
  });
});
