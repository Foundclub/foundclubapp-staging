// Le VRAI i18next : le libelle vient de `fr.js` / `en.js`, pas d'un repli.
import '@/theme/strings';

import i18next from 'i18next';
import renderer, { act } from 'react-test-renderer';

import SearchComponent from '../searchComponent';

// RECRUTER-TUNNEL (audit V1, accessibilite) — le bouton de filtre des listes
// Evenement et Recrutement n'avait AUCUN libelle : `content-desc` vide dans
// l'arbre d'accessibilite Android. Un lecteur d'ecran annoncait « bouton », sans
// dire lequel. Ce bouton vit ICI, et 8 listes le partagent (evenements,
// recrutement, profils, clubs, equipes, matchs amicaux, reservations,
// historique) : un libelle pose une fois les couvre toutes.

jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const genererStyles = jest.requireActual('@/theme/applicationStyle').default;
  const alignements = jest.requireActual('@/theme/alignements').default;
  const espaces = jest.requireActual('@/theme/spaces').default;
  const couleurs = genererCouleurs();
  const theme = {
    Alignments: alignements,
    ApplicationStyle: genererStyles(couleurs),
    Colors: couleurs,
    Fonts: genererPolices(couleurs),
    Images: { filter: 1 },
    Spaces: espaces,
  };
  return { __esModule: true, default: () => theme };
});

jest.mock('@/components/molecules/input/Input', () => {
  // eslint-disable-next-line global-require
  const { TextInput } = require('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { onChangeText, placeholder, value }) => (
      <TextInput onChangeText={onChangeText} placeholder={placeholder} value={value} />
    ),
  };
});

/** @type {any} */
let arbre = null;

/**
 * Monte la barre de recherche et rend les elements qui ouvrent les filtres.
 * @param {number} [filterNumber] - Le nombre de filtres actifs.
 * @returns {any[]} Les noeuds dont l'appui ouvre les filtres.
 */
const boutonDeFiltre = (filterNumber) => {
  const ouvrir = jest.fn();
  act(() => {
    arbre = renderer.create(
      <SearchComponent
        filterNumber={filterNumber}
        handleSearchField={() => {}}
        openFilters={ouvrir}
        placeholder="Rechercher"
      />,
    );
  });
  const noeuds = arbre.root.findAll((/** @type {any} */ noeud) => noeud.props?.onPress === ouvrir);
  expect(noeuds.length).toBeGreaterThan(0);
  return noeuds;
};

/**
 * Le libelle annonce par le lecteur d'ecran : identique sur chaque noeud.
 * @param {number} [filterNumber] - Le nombre de filtres actifs.
 * @returns {string[]} Les libelles distincts.
 */
const libellesAnnonces = (filterNumber) => [
  ...new Set(boutonDeFiltre(filterNumber).map((noeud) => noeud.props.accessibilityLabel)),
];

afterEach(async () => {
  if (arbre) act(() => arbre.unmount());
  arbre = null;
  await i18next.changeLanguage('fr');
});

describe('RECRUTER-TUNNEL — le bouton de filtre se nomme', () => {
  it('LE TEMOIN : sans filtre actif, il s annonce « Filtrer »', () => {
    expect(libellesAnnonces()).toEqual(['Filtrer']);
  });

  it('avec des filtres actifs, il dit combien — la pastille seule ne se lit pas', () => {
    expect(libellesAnnonces(1)).toEqual(['Filtrer, 1 filtre actif']);
    expect(libellesAnnonces(3)).toEqual(['Filtrer, 3 filtres actifs']);
  });

  it('et en anglais', async () => {
    await i18next.changeLanguage('en');

    expect(libellesAnnonces()).toEqual(['Filter']);
    expect(libellesAnnonces(2)).toEqual(['Filter, 2 active filters']);
  });

  it('il reste annonce comme un bouton', () => {
    const roles = boutonDeFiltre().map((noeud) => noeud.props.accessibilityRole).filter(Boolean);

    expect(roles.length).toBeGreaterThan(0);
    expect(new Set(roles)).toEqual(new Set(['button']));
  });
});
