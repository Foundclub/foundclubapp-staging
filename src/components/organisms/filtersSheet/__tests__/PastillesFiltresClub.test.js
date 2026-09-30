import { Platform } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import {
  chercherUnSport,
  choisirLeSport,
  lignesDeSport,
  POPULAIRES_EN_TETE,
  SPORTS_A09,
} from '../../../../testSupport/temoinChoixDuSport';
import PastillesFiltresClub from '../PastillesFiltresClub';

// A09 — la base de sports que rend la doublure : celle des tests d'avant par défaut, la petite
// base du témoin A09 dans son bloc.
const SPORTS_PAR_DEFAUT = [
  { documentId: 'sport-foot', name: 'Football' },
  { documentId: 'sport-basket', name: 'Basketball' },
  { documentId: 'sport-tennis', name: 'Tennis' },
  { documentId: 'sport-hand', name: 'Handball' },
  { documentId: 'sport-rugby', name: 'Rugby' },
  { documentId: 'sport-escrime', name: 'Escrime' },
];
let mockSports = SPORTS_PAR_DEFAUT;

// ANNUAIRE-E1 (maquette validée par Adel le 29/09) — les deux pastilles écrites de la recherche de
// clubs. Ce que ce filet garde :
//   1. les libellés (le sport, le lieu et son rayon, « Tous les sports », « Toutes les villes ») —
//      ceux de la ligne-résumé D6 qu'elles remplacent ;
//   2. UN geste : choisir un sport l'applique aussitôt, sans « Voir les résultats » ;
//   3. le lieu garde la règle de la feuille « Filtrer » (zone recalculée, territoire sans rayon) ;
//   4. l'emplacement du choix : un panneau du bas au téléphone, une liste SOUS la pastille sur le
//      site en grand écran (jamais une fenêtre centrée).

jest.setTimeout(30000);

jest.mock('@/components/molecules/bottomModal/BottomModal', () => {
  // eslint-disable-next-line global-require
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { children, headerComponent, isVisible }) => (
      isVisible ? (
        <View testID="panneau-du-bas">
          {headerComponent}
          {children}
        </View>
      ) : null
    ),
  };
});

jest.mock('@/components/molecules/input/Input', () => {
  // eslint-disable-next-line global-require
  const { View } = require('react-native');
  return {
    __esModule: true,
    // eslint-disable-next-line react/jsx-props-no-spreading -- doublure : garde toutes les props
    default: (/** @type {any} */ props) => <View testID="recherche-du-panneau" {...props} />,
  };
});

jest.mock('@/components/organisms/autocompleteAddressInput/autocompleteAddressInput', () => {
  // eslint-disable-next-line global-require
  const { View } = require('react-native');
  return {
    __esModule: true,
    // eslint-disable-next-line react/jsx-props-no-spreading -- doublure : garde toutes les props
    default: (/** @type {any} */ props) => <View testID="adresse" {...props} />,
  };
});

jest.mock('@react-native-community/slider', () => {
  // eslint-disable-next-line global-require
  const { View } = require('react-native');
  return {
    __esModule: true,
    // eslint-disable-next-line react/jsx-props-no-spreading -- doublure : garde toutes les props
    default: (/** @type {any} */ props) => <View testID="rayon" {...props} />,
  };
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {string} */ repli) => repli || cle,
  }),
}));

const mockGeohash = jest.fn(
  (/** @type {number} */ lat, /** @type {number} */ lon, /** @type {number} */ rayon) => (
    `gh(${String(lat)},${String(lon)},${String(rayon)})`
  ),
);

jest.mock('@/domains/places/usePlaces', () => ({
  __esModule: true,
  default: () => ({ getGeohashForPointAndRadius: mockGeohash }),
}));

jest.mock('@/services/activity/activityQueries', () => ({
  useGetActivities: () => ({ data: mockSports }),
}));

jest.mock('@/services/annuaire/annuaireQueries', () => ({
  useGetTerritoires: () => ({
    data: {
      departments: [{ code: '13', name: 'Bouches-du-Rhône', slug: 'bouches-du-rhone' }],
      regions: [],
    },
  }),
}));

const mockDimensions = { height: 812, width: 375 };
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockDimensions,
}));

jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const alignements = jest.requireActual('@/theme/alignements').default;
  const espaces = jest.requireActual('@/theme/spaces').default;
  const couleurs = genererCouleurs();
  return {
    __esModule: true,
    default: () => ({
      Alignments: alignements, Colors: couleurs, Fonts: genererPolices(couleurs), Spaces: espaces,
    }),
  };
});

const LYON = { label: 'Lyon', value: '4.83|45.76' };

/** @type {any} */
let arbre = null;
const onApply = jest.fn();

const rendre = (/** @type {Record<string, any> | null} */ filters) => {
  act(() => {
    arbre = renderer.create(<PastillesFiltresClub filters={filters} onApply={onApply} />);
  });
  return arbre;
};

const pastille = (/** @type {string} */ debut) => arbre.root.findAll(
  (/** @type {any} */ noeud) => noeud.props?.accessibilityRole === 'button'
    && typeof noeud.props?.onPress === 'function'
    && String(noeud.props?.accessibilityLabel || '').startsWith(debut),
)[0];
const choix = (/** @type {string} */ libelle) => arbre.root.findAll(
  (/** @type {any} */ noeud) => noeud.props?.accessibilityRole === 'radio'
    && typeof noeud.props?.onPress === 'function'
    && noeud.props?.accessibilityLabel === libelle,
)[0];
const texte = () => JSON.stringify(arbre.toJSON());
const nomSport = () => pastille('Filtrer par sport — ').props.accessibilityLabel;
const nomLieu = () => pastille('Filtrer par lieu — ').props.accessibilityLabel;
const panneauOuvert = (/** @type {string} */ testID) => arbre.root.findAll(
  (/** @type {any} */ noeud) => noeud.props?.testID === testID && typeof noeud.type === 'string',
).length > 0;

beforeEach(() => {
  onApply.mockClear();
  mockGeohash.mockClear();
  mockDimensions.width = 375;
  Platform.OS = 'ios';
});

afterEach(() => {
  if (arbre) act(() => { arbre.unmount(); });
  arbre = null;
});

describe('PastillesFiltresClub — les libellés (ceux de la ligne D6 qu elles remplacent)', () => {
  test('📌 sans filtre : « Tous les sports » et « Toutes les villes »', () => {
    rendre({});
    expect(nomSport()).toBe('Filtrer par sport — Tous les sports');
    expect(nomLieu()).toBe('Filtrer par lieu — Toutes les villes');
  });

  test('✅ un sport et une ville : le sport, puis la ville avec son rayon', () => {
    rendre({ activity: 'sport-foot', city: LYON, radius: 10 });
    expect(nomSport()).toBe('Filtrer par sport — Football');
    expect(nomLieu()).toBe('Filtrer par lieu — Lyon · 10 km');
    expect(texte()).toContain('Lyon · 10 km');
  });

  test('✅ un département : son nom seul, sans rayon', () => {
    rendre({
      city: {
        label: 'Bouches-du-Rhône (département)', nom: 'Bouches-du-Rhône', territoire: 'departement',
      },
    });
    expect(nomLieu()).toBe('Filtrer par lieu — Bouches-du-Rhône');
  });

  test('📌 filtres absents (null) : la pastille se lit quand même', () => {
    rendre(null);
    expect(nomSport()).toBe('Filtrer par sport — Tous les sports');
  });
});

describe('PastillesFiltresClub — le sport, en UN geste', () => {
  test('✅ la pastille ouvre DIRECTEMENT le choix du sport, le sport actuel coché', () => {
    rendre({ activity: 'sport-foot', city: LYON, radius: 10 });
    expect(panneauOuvert('choix-sport')).toBe(false);

    act(() => { pastille('Filtrer par sport — ').props.onPress(); });

    expect(panneauOuvert('choix-sport')).toBe(true);
    expect(choix('Football').props['aria-checked']).toBe(true);
    expect(choix('Basketball').props['aria-checked']).toBe(false);
  });

  test('✅ appuyer sur « Basketball » l applique aussitôt et referme le choix', () => {
    rendre({
      activity: 'sport-foot', city: LYON, name: 'stade', radius: 10,
    });
    act(() => { pastille('Filtrer par sport — ').props.onPress(); });

    act(() => { choix('Basketball').props.onPress(); });

    expect(onApply).toHaveBeenCalledTimes(1);
    // Le nom tapé et le lieu restent : seul le sport change.
    expect(onApply).toHaveBeenCalledWith({
      activity: 'sport-basket', city: LYON, name: 'stade', radius: 10,
    });
    expect(panneauOuvert('choix-sport')).toBe(false);
  });

  test('📌 appuyer sur le sport déjà choisi referme sans rien relancer', () => {
    rendre({ activity: 'sport-foot' });
    act(() => { pastille('Filtrer par sport — ').props.onPress(); });

    act(() => { choix('Football').props.onPress(); });

    expect(onApply).not.toHaveBeenCalled();
    expect(panneauOuvert('choix-sport')).toBe(false);
  });

  test('✅ la recherche du panneau filtre les sports', () => {
    rendre({ activity: 'sport-foot' });
    act(() => { pastille('Filtrer par sport — ').props.onPress(); });

    const recherche = arbre.root.findByProps({ testID: 'recherche-du-panneau' });
    act(() => { recherche.props.onChangeText('escr'); });

    expect(choix('Escrime')).toBeDefined();
    expect(choix('Basketball')).toBeUndefined();
  });

  test('✅ « Tous les sports, de A à Z » déplie la liste entière, avec « Tous les sports »', () => {
    rendre({ activity: 'sport-foot' });
    act(() => { pastille('Filtrer par sport — ').props.onPress(); });
    expect(choix('Escrime')).toBeUndefined();

    const TOUT = 'Tous les sports, de A à Z';
    const deplier = arbre.root.findAll(
      (/** @type {any} */ noeud) => noeud.props?.accessibilityRole === 'button'
        && typeof noeud.props?.onPress === 'function'
        && noeud.findAll((/** @type {any} */ enfant) => enfant.props?.children === TOUT).length > 0,
    )[0];
    act(() => { deplier.props.onPress(); });
    act(() => { choix('Tous les sports').props.onPress(); });

    expect(onApply).toHaveBeenCalledWith({ activity: '' });
  });

  test('📌 téléphone : pas de focus automatique (le clavier couvrirait la liste)', () => {
    rendre({ activity: 'sport-foot' });
    act(() => { pastille('Filtrer par sport — ').props.onPress(); });
    expect(arbre.root.findByProps({ testID: 'recherche-du-panneau' }).props.autoFocus).toBe(false);
  });
});

describe('PastillesFiltresClub — le lieu, avec la règle de la feuille « Filtrer »', () => {
  test('✅ une autre ville choisie : zone recalculée au rayon actuel, choix refermé', () => {
    rendre({ activity: 'sport-foot', city: LYON, radius: 10 });
    act(() => { pastille('Filtrer par lieu — ').props.onPress(); });

    const adresse = arbre.root.findByProps({ testID: 'adresse' });
    act(() => { adresse.props.setAddress({ label: 'Nice', value: '7.26|43.7' }); });

    expect(onApply).toHaveBeenCalledWith({
      activity: 'sport-foot',
      city: { label: 'Nice', value: '7.26|43.7' },
      geohash: 'gh(43.7,7.26,10)',
      lat: 43.7,
      lon: 7.26,
      radius: 10,
    });
    expect(panneauOuvert('choix-lieu')).toBe(false);
  });

  test('✅ le rayon se règle sur place : appliqué au lâcher, le choix reste ouvert', () => {
    rendre({ activity: 'sport-foot', city: LYON, radius: 10 });
    act(() => { pastille('Filtrer par lieu — ').props.onPress(); });

    act(() => { arbre.root.findByProps({ testID: 'rayon' }).props.onSlidingComplete(25); });

    expect(onApply).toHaveBeenCalledWith(expect.objectContaining({
      geohash: 'gh(45.76,4.83,25)', radius: 25,
    }));
    expect(panneauOuvert('choix-lieu')).toBe(true);
  });

  test('✅ « Toute la France » retire le lieu ET sa zone', () => {
    rendre({
      activity: 'sport-foot', city: LYON, geohash: 'ancien', radius: 10,
    });
    act(() => { pastille('Filtrer par lieu — ').props.onPress(); });

    act(() => { choix('Toute la France').props.onPress(); });

    expect(onApply).toHaveBeenCalledWith({
      activity: 'sport-foot',
      city: { label: '', value: '' },
      geohash: undefined,
      lat: undefined,
      lon: undefined,
      radius: 10,
    });
  });
});

describe('PastillesFiltresClub — où s ouvre le choix', () => {
  test('✅ téléphone (natif) : dans un panneau du bas', () => {
    rendre({ activity: 'sport-foot' });
    act(() => { pastille('Filtrer par sport — ').props.onPress(); });
    expect(panneauOuvert('panneau-du-bas')).toBe(true);
  });

  test('✅ site sous 1 024 px : panneau du bas aussi, et la recherche prend le focus', () => {
    Platform.OS = 'web';
    rendre({ activity: 'sport-foot' });
    act(() => { pastille('Filtrer par sport — ').props.onPress(); });
    expect(panneauOuvert('panneau-du-bas')).toBe(true);
    expect(arbre.root.findByProps({ testID: 'recherche-du-panneau' }).props.autoFocus).toBe(true);
  });

  test('✅ site à 1 280 px : une liste SOUS la pastille (≤ 340 px), pas de panneau du bas', () => {
    Platform.OS = 'web';
    mockDimensions.width = 1280;
    rendre({ activity: 'sport-foot' });
    act(() => { pastille('Filtrer par sport — ').props.onPress(); });

    expect(panneauOuvert('panneau-du-bas')).toBe(false);
    const liste = arbre.root.findAll(
      (/** @type {any} */ noeud) => noeud.props?.testID === 'choix-sport'
        && typeof noeud.type === 'string',
    )[0];
    const style = Object.assign({}, ...[liste.props.style].flat(Infinity).filter(Boolean));
    expect(style).toEqual(expect.objectContaining({
      left: 0, position: 'absolute', top: '100%', width: 340,
    }));
  });
});

describe('A09 — le sport : populaires en haut, recherche dans TOUS les sports', () => {
  beforeEach(() => { mockSports = SPORTS_A09; });
  afterEach(() => { mockSports = SPORTS_PAR_DEFAUT; });

  test('✅ populaires en tête (ordre d Adel), recherche sans accent, un geste applique', async () => {
    rendre(null);
    act(() => { pastille('Filtrer par sport — ').props.onPress(); });

    // Décision d'Adel (30/09) : football, basketball, handball, rugby, volleyball.
    expect(lignesDeSport(arbre)).toEqual(POPULAIRES_EN_TETE);
    await chercherUnSport(arbre, 'equit');
    expect(lignesDeSport(arbre)).toEqual(['Équitation']);

    await choisirLeSport(arbre, 'Équitation');
    expect(onApply).toHaveBeenCalledWith({ activity: 'a-equit' });
  });
});
