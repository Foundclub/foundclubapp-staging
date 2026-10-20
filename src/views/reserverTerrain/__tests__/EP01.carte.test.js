import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import RechercheDeTerrains from '@/views/reserverTerrain/RechercheDeTerrains';

import { RouteNames } from '@/navigation/routeNames';

import {
  lisibles, parRepere, pressable,
} from '@/testSupport/temoinComplexe';
import { carteDeRecherche, complexePublic } from '@/testSupport/temoinReserver';

// RESA-CARTE (20/10/2026) — E-P01, LA VUE CARTE de la recherche de terrains (plan E-P01 points 4
// et 6, :1180 ; planches EP01 état 2 et OR2). L6A a construit la LISTE ; ce lot ajoute :
//   · la bascule « Liste » / « Carte » (téléphone) ; les filtres valent pour les deux vues ;
//   · une épingle par complexe proposé, avec son nombre de créneaux libres (« Tél. » si tout se
//     réserve par téléphone) ; la position vient de la page publique du complexe (la recherche du
//     serveur ne la rend pas) et n'est lue QU'EN vue Carte ;
//   · toucher une épingle ⇒ la carte DU COMPLEXE sous la carte (nom, créneaux libres à toucher)
//     ⇒ E-P02, ou E-P03 par un créneau ; toucher l'épingle déjà choisie ⇒ E-P02 ;
//   · sur ordinateur (OR2) : la liste à gauche, la carte à droite, pas de bascule ; toucher une
//     épingle met sa carte en tête de liste ;
//   · les états : chargement, aucune proposition (« Aucun terrain libre ici. Élargis la
//     distance. »), position refusée (la carte reste utilisable par ville), erreur.
// La carte elle-même (Leaflet dans une WebView ou une iframe) est doublée : ses props sont lues.

// La place de la barre d'onglets flottante : useBottomDockLayout tire @react-navigation/stack, que
// jest ne transforme pas ; doublé, comme dans les témoins de ClubListContent.
jest.mock('@/navigation/useBottomDockLayout', () => ({
  __esModule: true,
  default: () => ({ dockClearance: 0, floatingActionBottomOffset: 0, sceneBottomInset: 0 }),
}));

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

let mockRecherche = /** @type {any} */ ({});
const mockAppels = /** @type {any[]} */ ([]);
let mockPages = /** @type {Record<string, any>} */ ({});
const mockLecturesDePages = /** @type {any[]} */ ([]);
jest.mock('@/services/complexe/complexeJoueurQueries', () => ({
  usePagesDesComplexes: (/** @type {string[]} */ slugs, /** @type {any} */ options) => {
    mockLecturesDePages.push({ options, slugs });
    const actives = options?.enabled === false ? [] : slugs;
    return {
      enCours: false,
      pages: Object.fromEntries(actives.filter((slug) => mockPages[slug])
        .map((slug) => [slug, mockPages[slug]])),
    };
  },
  useRechercheDeTerrains: (/** @type {any} */ filtres, /** @type {any} */ options) => {
    mockAppels.push({ filtres, options });
    return mockRecherche;
  },
}));

const mockCartes = /** @type {any[]} */ ([]);
jest.mock('@/components/organisms/searchMap/SearchMap', () => ({
  __esModule: true,
  default: function FausseCarte(/** @type {any} */ props) {
    const { View: Vue } = jest.requireActual('react-native');
    mockCartes.push(props);
    return <Vue testID="fausse-carte" />;
  },
}));

let mockOrdinateur = false;
jest.mock('@/responsive', () => ({
  ...jest.requireActual('@/responsive'),
  useIsDesktop: () => mockOrdinateur,
}));

jest.mock('@/services/activity/activityQueries', () => ({
  useGetActivities: () => ({
    data: [
      { documentId: 'a-five', name: 'Football à 5' },
      { documentId: 'a-padel', name: 'Padel' },
    ],
  }),
}));

jest.mock('@/services/places/placesQueries', () => ({
  useGetPlaces: () => ({ data: [] }),
}));

let mockPositionAccordee = /** @type {any} */ (null);
let mockPositionDemandee = /** @type {any} */ (null);
jest.mock('@/platform/maps/searchMapGeolocation', () => ({
  readCurrentSearchMapLocationIfGranted: async () => mockPositionAccordee,
  requestCurrentSearchMapLocation: async () => mockPositionDemandee,
}));

const VALBRUNE = { lat: 48.9, lng: 1.5 };
jest.mock('@/components/organisms/autocompleteAddressInput/autocompleteAddressInput', () => (
  function FausseVille(/** @type {any} */ { placeholder, setAddress }) {
    const { Text: Texte, TouchableOpacity: Touche } = jest.requireActual('react-native');
    return (
      <Touche
        accessibilityLabel={placeholder}
        onPress={() => setAddress({
          city: 'Valbrune', label: 'Valbrune', lat: 48.9, lng: 1.5,
        })}
      >
        <Texte>{placeholder}</Texte>
      </Touche>
    );
  }
));

jest.mock('@/components/molecules/bottomModal/BottomModal', () => (
  function FausseFeuille(/** @type {any} */ { children, isVisible }) {
    return isVisible ? children : null;
  }
));
jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));
jest.mock('@/theme/themeContext', () => (
  jest.requireActual('@/testSupport/temoinComplexe').themeDeTemoin()
));

const refetch = jest.fn();

const FIVE = carteDeRecherche();
const PADEL = carteDeRecherche({
  distanceKm: 8.1,
  freeSlotsCount: 2,
  name: 'Padel Club Valbrune',
  phoneOnly: true,
  slots: [{
    from: '18:00',
    price: { amount: 24, perPlayer: 6, unit: 'creneau' },
    startsAt: '2026-10-20T16:00:00.000Z',
    terrain: { bookingMode: 'telephone', documentId: 't-padel', name: 'Padel A' },
    to: '19:30',
  }],
  slug: 'padel-club-valbrune',
  sports: ['Padel'],
});

const lue = (/** @type {any[]} */ complexes) => ({
  data: { complexes, date: '2026-10-20' },
  error: null,
  isLoading: false,
  isRefetching: false,
  refetch,
});

// Les arbres montés : démontés après chaque témoin (sinon le minuteur de frappe d'un arbre
// précédent relance SA recherche pendant le témoin suivant).
const montes = /** @type {any[]} */ ([]);

/**
 * Monte le panneau et laisse passer la lecture de la position.
 * @returns {Promise<any>} L'arbre.
 */
const monter = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<RechercheDeTerrains screenActive />);
  });
  montes.push(arbre);
  await act(async () => {
    await Promise.resolve();
  });
  return arbre;
};

/**
 * Appuie sur un élément pressable.
 * @param {any} noeud - Le nœud.
 * @returns {Promise<void>} Fini.
 */
const toucher = async (noeud) => {
  await act(async () => {
    noeud.props.onPress();
  });
  await act(async () => {
    await Promise.resolve();
  });
};

// Le bouton de la bascule tel que le lecteur d'écran le lit (son état « choisi »).
const vue = (/** @type {any} */ arbre, /** @type {'liste' | 'carte'} */ nom) => arbre.root.findAll(
  (/** @type {any} */ noeud) => noeud.props?.testID === `reserver-recherche-vue-${nom}`
    && noeud.props?.accessibilityState,
)[0] || null;
const derniereCarte = () => mockCartes[mockCartes.length - 1];
const derniersFiltres = () => mockAppels[mockAppels.length - 1]?.filtres;

/**
 * Passe en vue Carte.
 * @param {any} arbre - L'arbre.
 * @returns {Promise<void>} Fini.
 */
const passerEnCarte = async (arbre) => {
  const bouton = vue(arbre, 'carte');
  if (!bouton) throw new Error('Aucune bascule « Carte »');
  await toucher(bouton);
};

/**
 * Touche une épingle de la carte (doublée) : ce que la carte rend quand on touche un repère.
 * @param {string} slug - L'épingle.
 * @returns {Promise<void>} Fini.
 */
const toucherLEpingle = async (slug) => {
  await act(async () => {
    derniereCarte().onSelectItem(slug);
  });
};

// Le premier montage paie la mise en route du panneau (cf. EP01.recherche.test.js).
beforeAll(async () => {
  mockPositionAccordee = { lat: 48.83, lng: 1.48 };
  mockRecherche = lue([FIVE]);
  await monter();
  act(() => {
    montes.splice(0).forEach((arbre) => arbre.unmount());
  });
}, 30000);

afterEach(() => {
  act(() => {
    montes.splice(0).forEach((arbre) => arbre.unmount());
  });
});

beforeEach(() => {
  mockNavigate.mockClear();
  mockAppels.length = 0;
  mockCartes.length = 0;
  mockLecturesDePages.length = 0;
  mockOrdinateur = false;
  mockPositionAccordee = { lat: 48.83, lng: 1.48 };
  mockPositionDemandee = null;
  mockPages = {
    [FIVE.slug]: complexePublic({
      address: { label: '12 allée des Sports', lat: 48.8365, lng: 1.484 },
    }),
    [PADEL.slug]: complexePublic({
      address: { label: '1 allée des Pins', lat: 48.9, lng: 1.5 }, slug: PADEL.slug,
    }),
  };
  mockRecherche = lue([FIVE, PADEL]);
});

describe('RESA-CARTE — E-P01, la bascule Liste / Carte (téléphone)', () => {
  it('la bascule est là, « Liste » choisie ; la liste ne lit AUCUNE position', async () => {
    const arbre = await monter();
    expect(vue(arbre, 'liste')?.props.accessibilityState).toEqual({ selected: true });
    expect(vue(arbre, 'carte')?.props.accessibilityState).toEqual({ selected: false });
    expect(parRepere(arbre, 'carte-complexe-le-five-de-montrivage')).not.toBeNull();
    expect(parRepere(arbre, 'fausse-carte')).toBeNull();
    expect(mockLecturesDePages.every(({ options, slugs }) => options?.enabled === false
      || slugs.length === 0)).toBe(true);
  });

  it('« Carte » : une épingle par complexe, ses créneaux libres, « Tél. » sinon', async () => {
    const arbre = await monter();
    await passerEnCarte(arbre);
    expect(vue(arbre, 'carte')?.props.accessibilityState).toEqual({ selected: true });
    expect(parRepere(arbre, 'fausse-carte')).not.toBeNull();
    expect(parRepere(arbre, 'carte-complexe-le-five-de-montrivage')).toBeNull();
    const carte = derniereCarte();
    expect(carte.scope).toBe('complexes');
    expect(carte.showPreviewCard).toBe(false);
    expect(carte.totalCount).toBe(2);
    expect(carte.items.map((/** @type {any} */ item) => [
      item.id, item.markerLabel, item.lat, item.lng,
    ])).toEqual([
      ['le-five-de-montrivage', '3', 48.8365, 1.484],
      ['padel-club-valbrune', 'Tél.', 48.9, 1.5],
    ]);
    // Les positions : les pages publiques des complexes proposés, lues en vue Carte.
    const lecture = mockLecturesDePages[mockLecturesDePages.length - 1];
    expect(lecture.options?.enabled).not.toBe(false);
    expect(lecture.slugs).toEqual(['le-five-de-montrivage', 'padel-club-valbrune']);
  });

  it('toucher une épingle : la carte du complexe en bas ⇒ E-P02, ou E-P03', async () => {
    const arbre = await monter();
    await passerEnCarte(arbre);
    expect(parRepere(arbre, 'reserver-recherche-carte-choisie')).toBeNull();
    await toucherLEpingle('le-five-de-montrivage');
    expect(derniereCarte().selectedItemId).toBe('le-five-de-montrivage');
    const choisie = parRepere(arbre, 'reserver-recherche-carte-choisie');
    expect(choisie).not.toBeNull();
    expect(choisie.findAll((/** @type {any} */ noeud) => (
      noeud.props?.testID === 'carte-complexe-le-five-de-montrivage'
    )).length).toBeGreaterThan(0);

    // Compacte, comme la planche EP01 état 2 : « distance · sports » sur une ligne, sans la
    // pastille « Complexe de réservation » ni le prix (la carte reste visible au-dessus).
    const textesChoisie = choisie.findAllByType(Text).map((/** @type {any} */ noeud) => (
      [].concat(noeud.props.children).join('').split(String.fromCharCode(160)).join(' ')
    ));
    expect(textesChoisie).toContain('2,4 km · Foot à 5 · Padel');
    expect(textesChoisie.join('|')).not.toMatch(/Complexe de réservation|par joueur/);

    await toucher(pressable(arbre, 'Le Five de Montrivage : voir le complexe'));
    expect(mockNavigate).toHaveBeenLastCalledWith(RouteNames.ReserverComplexe, {
      slug: 'le-five-de-montrivage',
    });
    await toucher(pressable(arbre, 'Terrain 1, 19 h'));
    expect(mockNavigate).toHaveBeenLastCalledWith(RouteNames.ReserverCreneau, {
      date: '2026-10-20',
      from: '19:00',
      slug: 'le-five-de-montrivage',
      terrainId: 't-1',
    });
  });

  it('toucher l’épingle déjà choisie ouvre la page du complexe (E-P02)', async () => {
    const arbre = await monter();
    await passerEnCarte(arbre);
    await toucherLEpingle('padel-club-valbrune');
    await act(async () => {
      derniereCarte().onOpenItem(derniereCarte().items[1]);
    });
    expect(mockNavigate).toHaveBeenLastCalledWith(RouteNames.ReserverComplexe, {
      slug: 'padel-club-valbrune',
    });
  });

  it('les filtres valent pour les deux vues : la carte suit la recherche', async () => {
    const arbre = await monter();
    await passerEnCarte(arbre);
    await toucher(pressable(arbre, 'Filtrer'));
    await toucher(pressable(arbre, 'Après 18 h'));
    mockRecherche = lue([PADEL]);
    await toucher(pressable(arbre, 'Voir les terrains'));
    expect(derniersFiltres()).toEqual(expect.objectContaining({ apres: '18:00' }));
    expect(parRepere(arbre, 'fausse-carte')).not.toBeNull();
    expect(derniereCarte().items.map((/** @type {any} */ item) => item.id))
      .toEqual(['padel-club-valbrune']);
    // Et la liste aussi.
    await toucher(vue(arbre, 'liste'));
    expect(parRepere(arbre, 'carte-complexe-padel-club-valbrune')).not.toBeNull();
    expect(parRepere(arbre, 'carte-complexe-le-five-de-montrivage')).toBeNull();
  });

  it('un complexe dont la page n’a pas (encore) de position n’a pas d’épingle', async () => {
    mockPages = { [FIVE.slug]: mockPages[FIVE.slug] };
    const arbre = await monter();
    await passerEnCarte(arbre);
    expect(derniereCarte().items.map((/** @type {any} */ item) => item.id))
      .toEqual(['le-five-de-montrivage']);
    expect(derniereCarte().totalCount).toBe(2);
  });
});

describe('RESA-CARTE — E-P01, les états de la vue Carte', () => {
  it('aucune proposition : « Aucun terrain libre ici… » et « Élargir »', async () => {
    mockRecherche = lue([]);
    const arbre = await monter();
    await passerEnCarte(arbre);
    expect(lisibles(arbre)).toContain('Aucun terrain libre ici. Élargis la distance.');
    await toucher(pressable(arbre, 'Élargir à 20 km'));
    expect(derniersFiltres()).toEqual(expect.objectContaining({ rayon: 20 }));
  });

  it('chargement : pas de carte vide, un squelette', async () => {
    mockRecherche = {
      data: undefined, error: null, isLoading: true, isRefetching: false, refetch,
    };
    const arbre = await monter();
    await passerEnCarte(arbre);
    expect(parRepere(arbre, 'fausse-carte')).toBeNull();
    expect(parRepere(arbre, 'reserver-recherche-squelette')).not.toBeNull();
  });

  it('erreur : « Réessayer » relit, en vue Carte aussi', async () => {
    mockRecherche = {
      data: undefined, error: new Error('réseau'), isLoading: false, isRefetching: false, refetch,
    };
    const arbre = await monter();
    await passerEnCarte(arbre);
    expect(lisibles(arbre)).toContain('Impossible de charger les terrains.');
    refetch.mockClear();
    await toucher(pressable(arbre, 'Réessayer'));
    expect(refetch).toHaveBeenCalled();
  });

  it('position refusée : on choisit une ville, et la carte se pose autour d’elle', async () => {
    mockPositionAccordee = null;
    mockPositionDemandee = null;
    const arbre = await monter();
    await toucher(pressable(arbre, 'Autoriser ma position'));
    await passerEnCarte(arbre);
    expect(lisibles(arbre)).toContain(
      'Localisation refusée : choisis une ville pour voir les terrains. '
        + 'Tu peux l’autoriser dans les réglages de ton téléphone.',
    );
    expect(parRepere(arbre, 'fausse-carte')).toBeNull();
    await toucher(pressable(arbre, 'Tape une ville'));
    expect(derniersFiltres()).toEqual(expect.objectContaining(VALBRUNE));
    expect(parRepere(arbre, 'fausse-carte')).not.toBeNull();
    expect(vue(arbre, 'carte')?.props.accessibilityState).toEqual({ selected: true });
  });
});

describe('RESA-CARTE — E-P01 sur ordinateur (planche OR2)', () => {
  it('la liste à gauche, la carte à droite, pas de bascule', async () => {
    mockOrdinateur = true;
    const arbre = await monter();
    expect(vue(arbre, 'liste')).toBeNull();
    expect(vue(arbre, 'carte')).toBeNull();
    expect(parRepere(arbre, 'fausse-carte')).not.toBeNull();
    expect(parRepere(arbre, 'carte-complexe-le-five-de-montrivage')).not.toBeNull();
    expect(parRepere(arbre, 'carte-complexe-padel-club-valbrune')).not.toBeNull();
  });

  it('toucher une épingle met sa carte en tête de liste', async () => {
    mockOrdinateur = true;
    const arbre = await monter();
    const ordre = () => arbre.root.findAll((/** @type {any} */ noeud) => (
      typeof noeud.props?.testID === 'string' && noeud.props.testID.startsWith('carte-complexe-')
        && typeof noeud.type === 'string'
    )).map((/** @type {any} */ noeud) => noeud.props.testID);
    const five = 'carte-complexe-le-five-de-montrivage';
    const padel = 'carte-complexe-padel-club-valbrune';
    expect(ordre()).toEqual([five, padel]);
    await toucherLEpingle('padel-club-valbrune');
    expect(ordre()).toEqual([padel, five]);
  });
});
