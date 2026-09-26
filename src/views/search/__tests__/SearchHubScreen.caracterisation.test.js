import { AppState, StyleSheet } from 'react-native';
import renderer, { act } from 'react-test-renderer';

// 📌 PREMIER FILET de `SearchHubScreen.js` (259 lignes, AUCUN témoin jusqu'ici).
//
// Posé en PHASE 1 du lot RECHERCHE-UNIQUE (25/09), en application de E6 : la
// phase 2 va faire de cet écran LA recherche unique, servie aussi par le site
// sur /annuaire/<sport>/<ville>/. Avant qu'elle y touche, on décrit ce qu'il
// fait AUJOURD'HUI, pour qu'un déplacement non voulu se voie tout de suite.
//
// Ce que ce fichier verrouille :
//  1. sans `activeType`, l'onglet ouvert est « events » et SEUL son panneau est monté ;
//  2. la liste et l'ORDRE des 5 onglets (events, clubs, reservations, recruitment, amicaux) ;
//  3. l'onglet clubs monte ClubListContent, carte comprise (`enableMapMode`), et actif ;
//  4. changer d'onglet écrit l'onglet dans les paramètres de route et GARDE le
//     panneau quitté monté mais caché (display none, pointerEvents none,
//     screenActive false) — c'est ce qui conserve la liste et sa position ;
//  5. un `activeType` inconnu ou alias est ramené à un type canonique ;
//  6. « reservations » affiche « Bientôt disponible », sans aucune liste ;
//  7. aller sur « recruitment » ajoute `initialRecruitmentTab` aux paramètres ;
//  8. la liste d'événements reçoit ses filtres par défaut (hors réservations,
//     sessions ouvertes).
// En plus : les amicaux, la navigation venue d'ailleurs, les marqueurs de
// performance, le signal de guidage et le rafraîchissement après 30 s en
// arrière-plan.
//
// 🎛️ Les 4 panneaux et la coquille sont DOUBLÉS : ils gardent leurs dernières
// props et comptent leurs montages. Ce témoin ne dit donc rien de ce que les
// panneaux affichent — seulement de ce que l'écran leur DONNE.

/** @type {any} */
let mockUserData = null;

// La coquille doublée garde ses dernières props (activeType, onTypeChange,
// navigation) et rend ses enfants dans une vue repérable.
const mockCoquille = { props: /** @type {any} */ (null) };

// Chaque panneau doublé garde ses DERNIÈRES props et compte ses MONTAGES : un
// montage de plus = un panneau démonté puis remonté (état de la liste perdu).
const mockPanneaux = {
  amicaux: { montages: 0, props: /** @type {any} */ (null) },
  clubs: { montages: 0, props: /** @type {any} */ (null) },
  events: { montages: 0, props: /** @type {any} */ (null) },
  recruitment: { montages: 0, props: /** @type {any} */ (null) },
};

/**
 * Fabrique le double d'un panneau de liste : il enregistre ce que l'écran lui
 * donne et se rend sous la forme d'une vue marquée `panneau:<type>`.
 * @param {'amicaux' | 'clubs' | 'events' | 'recruitment'} type - l'onglet servi
 * @returns {any} le module doublé, prêt pour `jest.mock`
 */
function mockPanneauEnregistreur(type) {
  const React = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: function PanneauDouble(/** @type {any} */ props) {
      mockPanneaux[type].props = props;
      React.useEffect(() => { mockPanneaux[type].montages += 1; }, []);
      return <View testID={`panneau:${type}`} />;
    },
  };
}

jest.mock(
  '@/components/organisms/clubListContent/ClubListContent',
  () => mockPanneauEnregistreur('clubs'),
);
jest.mock(
  '@/components/organisms/eventListContent/EventListContent',
  () => mockPanneauEnregistreur('events'),
);
jest.mock(
  '@/components/organisms/friendlyMatchListContent/FriendlyMatchListContent',
  () => mockPanneauEnregistreur('amicaux'),
);
jest.mock(
  '@/components/organisms/recrutementListContent/RecrutementListContent',
  () => mockPanneauEnregistreur('recruitment'),
);

jest.mock('../components/SearchScreenShell', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: function CoquilleDouble(/** @type {any} */ props) {
      mockCoquille.props = props;
      return <View testID="coquille">{props.children}</View>;
    },
  };
});

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: mockUserData }),
}));

jest.mock('@/domains/guidance/guidanceRuntime', () => ({ emitGuidanceInteraction: jest.fn() }));
jest.mock('@/utils/performance/searchPerformance', () => ({ markSearchPerf: jest.fn() }));

// L'écran appelle `i18next.t` directement : la doublure rend le texte de `fr.js`
// (une clef inexistante rendrait son repli, pas la clef — cf. doublureTraduction).
jest.mock('i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').i18next
));

// Le VRAI thème, sans le contexte React qui le porte.
jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const genererStyleApp = jest.requireActual('@/theme/applicationStyle').default;
  const Alignments = jest.requireActual('@/theme/alignements').default;
  const Spaces = jest.requireActual('@/theme/spaces').default;
  const Colors = genererCouleurs();
  return {
    __esModule: true,
    default: () => ({
      Alignments,
      ApplicationStyle: genererStyleApp(Colors),
      Colors,
      Fonts: genererPolices(Colors),
      Images: {},
      scheme: 'dark',
      Spaces,
    }),
  };
});

// ⚠️ `recruitmentFlow` et `searchRouteHelpers` restent RÉELS : ce sont eux qui
// décident de l'onglet par défaut, de la coercition et de l'onglet de recrutement.
const { emitGuidanceInteraction } = require('@/domains/guidance/guidanceRuntime');

const { markSearchPerf } = require('@/utils/performance/searchPerformance');

const SearchHubScreen = require('../SearchHubScreen').default;

const FILTRES_EVENEMENTS_PAR_DEFAUT = { excludeType: 'Réservation', sessionStatus: 'open' };

/** @type {any} */
let arbre = null;
/** @type {any} */
let navigation = null;
/** @type {any} */
let horloge = null;

const demonter = () => {
  if (!arbre) return;
  act(() => { arbre.unmount(); });
  arbre = null;
};

/**
 * Monte l'écran comme la pile de navigation le ferait.
 * @param {any} [params] - les paramètres de route (`undefined` = route sans paramètres)
 * @returns {Promise<void>} rien
 */
const monter = async (params) => {
  demonter();
  navigation = { navigate: jest.fn(), setParams: jest.fn() };
  await act(async () => {
    arbre = renderer.create(<SearchHubScreen navigation={navigation} route={{ params }} />);
  });
};

/**
 * Re-rend l'écran avec de NOUVEAUX paramètres de route, comme une navigation
 * venue d'ailleurs (`navigateToSearchHub`, un lien) le ferait.
 * @param {any} params - les nouveaux paramètres de route
 * @returns {Promise<void>} rien
 */
const naviguerDepuisAilleurs = async (params) => {
  await act(async () => {
    arbre.update(<SearchHubScreen navigation={navigation} route={{ params }} />);
  });
};

/**
 * Appuie sur un onglet du sélecteur, comme le doigt d'Adel.
 * @param {unknown} type - l'onglet demandé
 * @returns {Promise<void>} rien
 */
const changerOnglet = async (type) => {
  await act(async () => { mockCoquille.props.onTypeChange(type); });
};

/**
 * Lit les panneaux montés, DANS L'ORDRE de l'écran, avec leur visibilité.
 * @returns {Array<{ cache: boolean, pointerEvents: string, type: string }>} un
 *   élément par panneau monté
 */
const panneauxMontes = () => {
  const coquille = arbre.toJSON();
  const conteneur = coquille.children[0];
  return (conteneur.children || []).map((/** @type {any} */ enveloppe) => {
    const contenu = enveloppe.children[0];
    const testID = String(contenu?.props?.testID || '');
    let type = '?';
    if (testID.startsWith('panneau:')) {
      type = testID.slice('panneau:'.length);
    } else if (JSON.stringify(contenu).includes('Bientôt disponible')) {
      type = 'reservations';
    }
    return {
      cache: StyleSheet.flatten(enveloppe.props.style)?.display === 'none',
      pointerEvents: enveloppe.props.pointerEvents,
      type,
    };
  });
};

const visible = (/** @type {string} */ type) => ({ cache: false, pointerEvents: 'auto', type });
const cache = (/** @type {string} */ type) => ({ cache: true, pointerEvents: 'none', type });

const texteRendu = () => JSON.stringify(arbre.toJSON());

/**
 * L'écouteur que l'écran a branché sur les changements d'état de l'app.
 * @returns {(etat: string) => void} l'écouteur
 */
const ecouteurAppState = () => {
  const appels = /** @type {any} */ (AppState.addEventListener).mock.calls
    .filter((/** @type {any[]} */ [evenement]) => evenement === 'change');
  return appels[appels.length - 1][1];
};

beforeEach(() => {
  mockUserData = null;
  mockCoquille.props = null;
  Object.keys(mockPanneaux).forEach((type) => {
    mockPanneaux[/** @type {keyof typeof mockPanneaux} */ (type)] = { montages: 0, props: null };
  });
  markSearchPerf.mockClear();
  emitGuidanceInteraction.mockClear();
  /** @type {any} */ (AppState.addEventListener).mockClear();
});

afterEach(() => {
  demonter();
  if (horloge) {
    horloge.mockRestore();
    horloge = null;
  }
});

describe('SearchHubScreen — caractérisation (état au 25/09, avant RECHERCHE-UNIQUE)', () => {
  test.each([
    ['sans paramètres de route', undefined],
    ['avec des paramètres mais sans activeType', { origine: 'accueil' }],
  ])('✅ témoin 1 — %s : l onglet ouvert est « events » et SEUL son panneau est monté', async (
    _cas,
    params,
  ) => {
    await monter(params);

    expect(mockCoquille.props.activeType).toBe('events');
    expect(panneauxMontes()).toEqual([visible('events')]);
    expect(mockPanneaux.events.montages).toBe(1);
    expect(mockPanneaux.clubs.montages).toBe(0);
    expect(mockPanneaux.recruitment.montages).toBe(0);
    expect(mockPanneaux.amicaux.montages).toBe(0);
    expect(texteRendu()).not.toContain('Bientôt disponible');
    expect(navigation.setParams).not.toHaveBeenCalled();
  });

  test('✅ témoin 2 — les 5 onglets, dans CET ordre, quel que soit l ordre de visite', async () => {
    // 🔒 L'ordre vient de la constante SEARCH_TAB_TYPES, pas de l'ordre des clics :
    // on visite volontairement dans le désordre.
    await monter({});

    await changerOnglet('amicaux');
    await changerOnglet('reservations');
    await changerOnglet('clubs');
    await changerOnglet('recruitment');

    expect(panneauxMontes()).toEqual([
      cache('events'),
      cache('clubs'),
      cache('reservations'),
      visible('recruitment'),
      cache('amicaux'),
    ]);
    expect(navigation.setParams.mock.calls.map(([params]) => params.activeType)).toEqual([
      'amicaux',
      'reservations',
      'clubs',
      'recruitment',
    ]);
  });

  test('✅ témoin 3 — activeType « clubs » monte la liste de clubs, carte comprise', async () => {
    await monter({ activeType: 'clubs' });

    expect(mockCoquille.props.activeType).toBe('clubs');
    expect(panneauxMontes()).toEqual([visible('clubs')]);
    // 🔒 Props EXACTES : aujourd'hui l'écran ne passe ni sport, ni ville, ni nom
    // tapé à la liste de clubs — tout vit dans `clubFilters` du contexte.
    expect(mockPanneaux.clubs.props).toEqual({
      enableMapMode: true,
      refreshSignal: 0,
      screenActive: true,
    });
    expect(mockPanneaux.events.montages).toBe(0);
  });

  test('✅ témoin 4 — changer d onglet réécrit la route et CACHE l ancien panneau', async () => {
    await monter({ origine: 'accueil' });

    await changerOnglet('clubs');

    expect(navigation.setParams).toHaveBeenCalledTimes(1);
    expect(navigation.setParams).toHaveBeenCalledWith({ activeType: 'clubs', origine: 'accueil' });
    expect(mockCoquille.props.activeType).toBe('clubs');
    expect(panneauxMontes()).toEqual([cache('events'), visible('clubs')]);
    expect(mockPanneaux.events.props.screenActive).toBe(false);
    expect(mockPanneaux.clubs.props.screenActive).toBe(true);
    expect(mockPanneaux.events.montages).toBe(1);
    expect(mockPanneaux.clubs.montages).toBe(1);
  });

  test('✅ témoin 4 bis — sans paramètres de route, setParams ne reçoit que l onglet', async () => {
    await monter(undefined);

    await changerOnglet('clubs');

    expect(navigation.setParams).toHaveBeenCalledWith({ activeType: 'clubs' });
  });

  test('✅ témoin 4 ter — appuyer sur l onglet DÉJÀ ouvert ne fait rien', async () => {
    await monter({ activeType: 'clubs' });

    await changerOnglet('clubs');

    expect(navigation.setParams).not.toHaveBeenCalled();
    expect(panneauxMontes()).toEqual([visible('clubs')]);
  });

  test('✅ témoin 4 quater — des allers-retours ne REMONTENT aucun panneau', async () => {
    // 🔒 Le garde-fou de l'état des listes : un panneau remonté repartirait de
    // zéro (position de défilement, pages déjà chargées).
    await monter({});

    await changerOnglet('clubs');
    await changerOnglet('events');
    await changerOnglet('clubs');
    await changerOnglet('events');

    expect(mockPanneaux.events.montages).toBe(1);
    expect(mockPanneaux.clubs.montages).toBe(1);
    expect(panneauxMontes()).toEqual([visible('events'), cache('clubs')]);
    expect(mockPanneaux.clubs.props.screenActive).toBe(false);
  });

  test.each([
    ['un type inconnu', 'n-importe-quoi', 'events'],
    ['un nombre', 42, 'events'],
    ['le singulier « club »', 'club', 'clubs'],
    ['des majuscules « CLUBS »', 'CLUBS', 'clubs'],
    ['l alias « mercato »', 'mercato', 'recruitment'],
    ['l alias « recrutement »', 'recrutement', 'recruitment'],
    ['le singulier « reservation »', 'reservation', 'reservations'],
    ['l alias « friendly »', 'friendly', 'amicaux'],
  ])('✅ témoin 5 — %s (%p) à l entrée est ramené à « %s »', async (_cas, demande, attendu) => {
    await monter({ activeType: demande });

    expect(mockCoquille.props.activeType).toBe(attendu);
    expect(panneauxMontes().map((panneau) => panneau.type)).toEqual([attendu]);
  });

  test('✅ témoin 5 bis — un onglet inconnu au sélecteur ramène sur « events »', async () => {
    await monter({ activeType: 'clubs' });

    await changerOnglet('n-importe-quoi');

    expect(navigation.setParams).toHaveBeenCalledWith({ activeType: 'events' });
    expect(panneauxMontes()).toEqual([visible('events'), cache('clubs')]);
  });

  test('✅ témoin 6 — « reservations » affiche « Bientôt disponible » et AUCUNE liste', async () => {
    await monter({ activeType: 'reservations' });

    expect(mockCoquille.props.activeType).toBe('reservations');
    expect(texteRendu()).toContain('Bientôt disponible');
    expect(texteRendu()).toContain(
      "La réservation de terrains et d'installations arrive très vite.",
    );
    expect(panneauxMontes()).toEqual([visible('reservations')]);
    Object.values(mockPanneaux).forEach((panneau) => {
      expect(panneau.montages).toBe(0);
    });
  });

  test.each([
    ['un compte sans rôle', 'annonces', null],
    ['un joueur', 'annonces', { role: { name: 'Joueur' } }],
    ['un entraîneur', 'profils', { role: { name: 'Entraîneur' } }],
    ['un dirigeant', 'profils', { role: { name: 'Dirigeant' } }],
  ])('✅ témoin 7 — aller sur « recruitment » pour %s ajoute initialRecruitmentTab « %s »', async (
    _cas,
    ongletAttendu,
    utilisateur,
  ) => {
    mockUserData = utilisateur;
    await monter({ origine: 'accueil' });

    await changerOnglet('recruitment');

    expect(navigation.setParams).toHaveBeenCalledWith({
      activeType: 'recruitment',
      initialRecruitmentTab: ongletAttendu,
      origine: 'accueil',
    });
    expect(mockPanneaux.recruitment.props).toEqual({
      initialTab: ongletAttendu,
      refreshSignal: 0,
      screenActive: true,
    });
  });

  test.each([
    ['un dirigeant, qui y a droit, le garde', { role: { name: 'Dirigeant' } }, 'candidatures'],
    [
      'un joueur, qui n y a pas droit, retombe sur « annonces »',
      { role: { name: 'Joueur' } },
      'annonces',
    ],
  ])('✅ témoin 7 bis — initialRecruitmentTab « candidatures » en route : %s', async (
    _cas,
    utilisateur,
    ongletAttendu,
  ) => {
    mockUserData = utilisateur;
    await monter({ activeType: 'recruitment', initialRecruitmentTab: 'candidatures' });

    expect(mockPanneaux.recruitment.props.initialTab).toBe(ongletAttendu);
  });

  test('✅ témoin 8 — la liste d événements reçoit ses filtres par défaut', async () => {
    await monter({});

    expect(mockPanneaux.events.props).toEqual({
      additionalFilters: FILTRES_EVENEMENTS_PAR_DEFAUT,
      enableMapMode: true,
      refreshSignal: 0,
      screenActive: true,
      showFilters: true,
    });
  });

  test('✅ témoin 9 — les amicaux reçoivent leur sous-onglet depuis la route', async () => {
    await monter({ activeType: 'amicaux', initialFriendlyMatchTab: 'mes-annonces' });

    expect(mockPanneaux.amicaux.props).toEqual({
      initialTab: 'mes-annonces',
      refreshSignal: 0,
      screenActive: true,
    });
  });

  test('✅ témoin 10 — une navigation venue d ailleurs change l onglet SANS setParams', async () => {
    // 📌 C'est le chemin qu'emprunte `navigateToSearchHub` (et demain une URL) :
    // l'écran suit `route.params.activeType`, il n'appelle pas setParams.
    await monter({ activeType: 'events' });

    await naviguerDepuisAilleurs({ activeType: 'clubs' });

    expect(mockCoquille.props.activeType).toBe('clubs');
    expect(panneauxMontes()).toEqual([cache('events'), visible('clubs')]);
    expect(navigation.setParams).not.toHaveBeenCalled();
  });

  test('✅ témoin 11 — marqueurs de performance : ouverture, puis retour « restauré »', async () => {
    await monter({});
    await changerOnglet('clubs');
    await changerOnglet('events');

    expect(markSearchPerf.mock.calls).toEqual([
      ['search_tab_open_started', { fromCache: false, mode: 'list', type: 'events' }],
      ['search_tab_open_started', { fromCache: false, mode: 'list', type: 'clubs' }],
      ['search_tab_switch_restored', { fromCache: true, mode: 'list', type: 'events' }],
    ]);
  });

  test('✅ témoin 12 — le signal de guidage part UNE fois par onglet et par écran', async () => {
    await monter({});
    await changerOnglet('clubs');
    await changerOnglet('events');
    await changerOnglet('clubs');

    expect(emitGuidanceInteraction.mock.calls).toEqual([
      ['search.tab.events'],
      ['search.tab.clubs'],
    ]);
  });

  test.each([
    ['30 s en arrière-plan', 1, 'background', 30_000],
    ['30 s en inactif', 1, 'inactive', 30_000],
    ['29,999 s en arrière-plan', 0, 'background', 29_999],
  ])('✅ témoin 13 — retour au premier plan après %s : refreshSignal de l onglet actif = %p', async (
    _cas,
    signalAttendu,
    etatQuitte,
    duree,
  ) => {
    await monter({});
    await changerOnglet('clubs');
    const ecouteur = ecouteurAppState();
    horloge = jest.spyOn(Date, 'now');

    horloge.mockReturnValue(1_000_000);
    act(() => { ecouteur(etatQuitte); });
    horloge.mockReturnValue(1_000_000 + duree);
    act(() => { ecouteur('active'); });

    expect(mockPanneaux.clubs.props.refreshSignal).toBe(signalAttendu);
    // 🔒 Seul l'onglet ACTIF est rafraîchi : l'onglet caché garde son signal.
    expect(mockPanneaux.events.props.refreshSignal).toBe(0);
  });
});

// RECHERCHE-UNIQUE (phase 2, 25/09) — l'annuaire du site sert CET ecran avec deux
// reglages de route : `types` (les marches montres) et `enableMapMode`. Absents,
// les temoins ci-dessus prouvent que le telephone ne change pas.
describe('RECHERCHE-UNIQUE — les reglages de l annuaire', () => {
  const ANNUAIRE = { enableMapMode: false, types: ['clubs', 'events'] };

  test('✅ types = clubs + events : le selecteur ne recoit QUE ces deux marches, dans l ordre de l ecran', async () => {
    await monter({ ...ANNUAIRE, activeType: 'clubs' });

    expect(mockCoquille.props.types).toEqual(['events', 'clubs']);
    expect(mockCoquille.props.activeType).toBe('clubs');
  });

  test('✅ un marche hors liste demande par la route retombe sur le premier permis', async () => {
    await monter({ ...ANNUAIRE, activeType: 'recruitment' });

    expect(mockCoquille.props.activeType).toBe('events');
    expect(mockPanneaux.recruitment.montages).toBe(0);
  });

  test('✅ un appui sur un marche hors liste ne fait rien', async () => {
    await monter({ ...ANNUAIRE, activeType: 'clubs' });

    await changerOnglet('amicaux');

    expect(mockCoquille.props.activeType).toBe('clubs');
    expect(navigation.setParams).not.toHaveBeenCalled();
    expect(mockPanneaux.amicaux.montages).toBe(0);
  });

  test('✅ enableMapMode false eteint le bouton carte des deux listes', async () => {
    await monter({ ...ANNUAIRE, activeType: 'clubs' });
    await changerOnglet('events');

    expect(mockPanneaux.clubs.props.enableMapMode).toBe(false);
    expect(mockPanneaux.events.props.enableMapMode).toBe(false);
  });

  test('📌 types en chaine « clubs,events » (parametre d adresse) vaut la liste', async () => {
    await monter({ activeType: 'clubs', types: 'clubs,events' });

    expect(mockCoquille.props.types).toEqual(['events', 'clubs']);
  });

  test('📌 types vide ou inconnu : les cinq marches restent (rien ne se ferme par erreur)', async () => {
    await monter({ activeType: 'clubs', types: ['n-importe-quoi'] });

    expect(mockCoquille.props.types).toBeUndefined();
  });
});
