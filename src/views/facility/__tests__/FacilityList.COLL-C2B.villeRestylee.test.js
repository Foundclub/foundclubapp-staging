import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import FacilityList from '../FacilityList';

// 📐 COLL-C2B (02/10/2026), planche 1 du design HY521H1 : « P4-liste-tel » et « P4-ordi » —
// LES INSTALLATIONS DE LA VILLE, RESTYLEES. Le vrai i18next (fr.js) ecrit les phrases.
//
// Ce que ce temoin exige (ROUGE avant le lot) :
//   - l en-tete de la page : « Ma collectivite », « Installations de la Ville » UNE fois (l en-tete
//     de navigation est vide, « un seul titre »), le compte ;
//   - une carte par installation : le nom, « Type · 2 equipes a la fois · 08:00 – 22:00 »,
//     l adresse sur sa ligne, « Cette semaine : 9 seances · complet jeu. 18:00 – 19:30 » ;
//   - plus de pastille « Conflits : demande a valider » (le reglage par defaut) ; elle ne parait
//     que pour « Autoriser et notifier » ;
//   - toute la carte ouvre le planning ; « Modifier » et « GPS » sont dans le menu « Plus
//     d actions » ; aucun « Supprimer » ;
//   - le chargement dessine des cartes en squelette, plus une roue seule.
// Et le mode CLUB ne change pas (cartes, boutons, pastille, « equipes simultanees »).

/** @type {any} */
let mockRoute;
/** @type {any} */
let mockNavigation;
/** @type {any} */
let mockCollectiviteInstallations;
/** @type {any} */
let mockFacilityContext;
/** @type {any} */
let mockSemaines;
/** @type {any[]} */
const mockSemainesDemandees = [];

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: jest.fn(),
  useNavigation: () => mockNavigation,
  useRoute: () => mockRoute,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {any[]} */ ...args) => jest.requireActual('i18next').t(...args),
  }),
}));

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: { club: { documentId: 'as-montrivage' } } }),
}));

jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const genererStyles = jest.requireActual('@/theme/applicationStyle').default;
  const alignements = jest.requireActual('@/theme/alignements').default;
  const espaces = jest.requireActual('@/theme/spaces').default;
  const couleurs = genererCouleurs();
  return {
    __esModule: true,
    default: () => ({
      Alignments: alignements,
      ApplicationStyle: genererStyles(couleurs),
      Colors: couleurs,
      Fonts: genererPolices(couleurs),
      Images: { calendar: 3, edit: 2, pin: 1 },
      Spaces: espaces,
    }),
  };
});

jest.mock('@/services/facility/facilityQueries', () => ({
  useClubFacilityContext: () => mockFacilityContext,
}));

jest.mock('@/services/collectivite/collectiviteQueries', () => ({
  useCollectiviteInstallations: () => mockCollectiviteInstallations,
  useMyCollectivites: () => ({
    data: [{ documentId: 'ville-montrivage', name: 'Ville de Montrivage' }],
  }),
}));

jest.mock('@/services/seasonSlot/seasonSlotQueries', () => ({
  useInstallationsWeekSummary: (/** @type {any[]} */ installations) => {
    mockSemainesDemandees.push(installations);
    return mockSemaines;
  },
}));

// COLL-C4B-BIS (03/10) : la carte d une installation de la Ville lit sa fermeture (bandeau).
jest.mock('@/services/facilityClosure/facilityClosureQueries', () => ({
  useFacilityClosures: () => ({ data: null }),
}));
jest.mock('@/services/facility/facilityService', () => ({
  deleteFacility: jest.fn(),
  getFacilitySections: (/** @type {any[]} */ installations) => (
    Array.isArray(installations) && installations.length ? [{ data: installations, title: '' }] : []
  ),
}));

jest.mock('@/navigation/useBottomDockLayout', () => ({
  __esModule: true,
  default: () => ({ sceneBottomInset: 24 }),
}));

jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) { return children; },
);
jest.mock('@/components/atoms/loader/Loader', () => function LoaderMock() {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN } = jest.requireActual('react-native');
  return reactActuel.createElement(TexteRN, null, 'ROUE');
});
jest.mock(
  '@/components/atoms/emptyState/EmptyState',
  () => function EmptyStateMock() { return null; },
);
jest.mock('@/components/atoms/button/Button', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
  return function ButtonMock(/** @type {any} */ props) {
    return reactActuel.createElement(
      PressableRN,
      { onPress: props.onPress },
      reactActuel.createElement(TexteRN, null, props.title),
    );
  };
});
jest.mock('@/components/molecules/bottomModal/BottomModal', () => function BottomModalMock(
  /** @type {any} */ { children, isVisible },
) {
  return isVisible ? children : null;
});
jest.mock(
  '@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet',
  () => function SubscriptionPaywallSheetMock() { return null; },
);

const GYMNASE = {
  address: { description: '12 rue des Tilleuls, Montrivage' },
  capacityConflictMode: 'pending_validation',
  closingTime: '22:00:00.000',
  documentId: 'gym-tilleuls',
  maxSlots: 2,
  name: 'Gymnase des Tilleuls',
  openingTime: '08:00:00.000',
  type: 'Gymnase',
};
const DOJO = {
  capacityConflictMode: 'allow_and_notify',
  closingTime: '22:00:00.000',
  documentId: 'dojo',
  maxSlots: 1,
  name: 'Dojo municipal',
  openingTime: '08:00:00.000',
  type: 'Dojo',
};

/** @type {any[]} */
const arbresMontes = [];
const rendre = () => {
  /** @type {any} */
  let arbre;
  act(() => { arbre = renderer.create(<FacilityList />); });
  arbresMontes.push(arbre);
  return arbre;
};
const aplatir = (/** @type {any} */ enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatir).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatir(enfants?.props?.children);
  return String(enfants);
};
const textes = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text)
  .map((/** @type {any} */ noeud) => aplatir(noeud.props.children).trim());
const parLibelle = (/** @type {any} */ arbre, /** @type {string} */ libelle) => arbre.root
  .findAll((/** @type {any} */ noeud) => noeud.props?.accessibilityLabel === libelle
    && typeof noeud.props?.onPress === 'function')[0];
const parTexte = (/** @type {any} */ arbre, /** @type {string} */ libelle) => arbre.root
  .findAll((/** @type {any} */ noeud) => typeof noeud.props?.onPress === 'function')
  .find((/** @type {any} */ noeud) => noeud.findAllByType(Text)
    .some((/** @type {any} */ texte) => aplatir(texte.props.children).trim() === libelle));

beforeEach(() => {
  mockSemainesDemandees.length = 0;
  mockNavigation = { goBack: jest.fn(), navigate: jest.fn(), setOptions: jest.fn() };
  mockRoute = { params: { collectiviteId: 'ville-montrivage' } };
  mockCollectiviteInstallations = {
    data: [GYMNASE, DOJO], error: null, isLoading: false, isRefetching: false, refetch: jest.fn(),
  };
  mockFacilityContext = {
    data: { allFacilities: [], cmId: null },
    error: null,
    isLoading: false,
    isRefetching: false,
    refetch: jest.fn(),
  };
  mockSemaines = {
    dojo: { count: 0, full: null },
    'gym-tilleuls': {
      count: 9,
      full: { end: new Date(2026, 9, 1, 19, 30), start: new Date(2026, 9, 1, 18, 0) },
    },
  };
});

afterEach(() => {
  act(() => { arbresMontes.splice(0).forEach((arbre) => arbre.unmount()); });
});

describe('COLL-C2B planche 1 — l en-tete de la page de la Ville', () => {
  it('« Ma collectivite », « Installations de la Ville » une seule fois, et le compte', () => {
    const lus = textes(rendre());
    expect(lus).toContain('Ma collectivité');
    expect(lus.filter((texte) => texte === 'Installations de la Ville')).toHaveLength(1);
    expect(lus).toContain('2 installations');
    // Un seul titre : l en-tete de navigation se tait, la page porte le titre.
    expect(mockNavigation.setOptions).toHaveBeenCalledWith({ headerTitle: '' });
  });
});

describe('COLL-C2B planche 1 — la carte d une installation de la Ville', () => {
  it('nom, « Type · 2 equipes a la fois · horaires », adresse, et la semaine', () => {
    const lus = textes(rendre());
    expect(lus).toContain('Gymnase des Tilleuls');
    expect(lus).toContain('Gymnase · 2 équipes à la fois · 08:00 – 22:00');
    expect(lus).toContain('12 rue des Tilleuls, Montrivage');
    expect(lus).toContain('Cette semaine : 9 séances · complet jeu. 18:00 – 19:30');
    expect(lus).toContain('Dojo · 1 équipe à la fois · 08:00 – 22:00');
    expect(lus).toContain('Cette semaine : aucune séance');
    // La semaine se lit pour les installations de la Ville, pas pour un club.
    expect(mockSemainesDemandees.at(-1)).toEqual([
      expect.objectContaining({ documentId: 'gym-tilleuls' }),
      expect.objectContaining({ documentId: 'dojo' }),
    ]);
  });

  it('la pastille du conflit ne parait QUE pour « Autoriser et notifier »', () => {
    const lus = textes(rendre());
    expect(lus.join(' | ')).not.toMatch(/demande à valider/);
    expect(lus.filter((texte) => /autoriser et notifier/i.test(texte))).toHaveLength(1);
  });

  // Planche 3 (P4v2-creneaux) : la carte ouvre l INSTALLATION, sur son onglet « Creneaux » ;
  // le planning reste dans le menu « Plus d actions » (temoin suivant).
  it('toute la carte ouvre l installation (ses creneaux et son planning)', () => {
    const arbre = rendre();
    act(() => {
      parLibelle(arbre, 'Gymnase des Tilleuls : ses créneaux et son planning').props.onPress();
    });
    expect(mockNavigation.navigate).toHaveBeenCalledWith('CollectiviteInstallation', {
      collectiviteId: 'ville-montrivage',
      facilityId: 'gym-tilleuls',
    });
  });

  it('« Plus d actions » range Voir le planning, Modifier, GPS — et pas de Supprimer', () => {
    const arbre = rendre();
    expect(parTexte(arbre, 'Modifier')).toBeUndefined();
    expect(parTexte(arbre, 'Voir le planning')).toBeUndefined();

    act(() => { parLibelle(arbre, 'Plus d’actions pour Gymnase des Tilleuls').props.onPress(); });
    const lus = textes(arbre);
    expect(lus).toContain('Voir le planning');
    expect(lus).toContain('Modifier l’installation');
    expect(lus).toContain('Ouvrir dans le GPS');
    expect(lus.join(' | ')).not.toMatch(/Supprimer/);

    act(() => { parTexte(arbre, 'Voir le planning').props.onPress(); });
    expect(mockNavigation.navigate).toHaveBeenCalledWith('PlanningWeekFullscreen', {
      contextDetailLabel: 'Gymnase des Tilleuls',
      facilityId: 'gym-tilleuls',
      sourceType: 'facility',
    });

    act(() => { parLibelle(arbre, 'Plus d’actions pour Gymnase des Tilleuls').props.onPress(); });
    act(() => { parTexte(arbre, 'Modifier l’installation').props.onPress(); });
    expect(mockNavigation.navigate).toHaveBeenCalledWith('CollectiviteInstallationForm', {
      collectiviteId: 'ville-montrivage',
      facility: expect.objectContaining({ documentId: 'gym-tilleuls' }),
      facilityId: 'gym-tilleuls',
    });
  });

  it('sans adresse, le menu ne propose pas le GPS', () => {
    const arbre = rendre();
    act(() => { parLibelle(arbre, 'Plus d’actions pour Dojo municipal').props.onPress(); });
    expect(textes(arbre)).not.toContain('Ouvrir dans le GPS');
  });

  it('pendant le chargement : des cartes en squelette, sous l en-tete', () => {
    mockCollectiviteInstallations = {
      ...mockCollectiviteInstallations, data: undefined, isLoading: true,
    };
    const arbre = rendre();
    const squelettes = arbre.root.findAll(
      (/** @type {any} */ noeud) => noeud.props?.testID === 'installation-squelette',
    );
    expect(squelettes).not.toHaveLength(0);
    expect(textes(arbre)).toContain('Installations de la Ville');
    expect(textes(arbre)).not.toContain('ROUE');
  });
});

describe('COLL-C2B planche 1 — le mode CLUB ne change pas', () => {
  beforeEach(() => {
    mockRoute = { params: {} };
    mockFacilityContext = {
      ...mockFacilityContext,
      data: {
        allFacilities: [{
          ...GYMNASE,
          documentId: 'salle-club',
          isReadOnly: false,
          isShared: false,
          name: 'Salle du club',
          ownerType: 'club',
        }],
        cmId: null,
      },
    };
  });

  it('sa carte garde ses boutons, sa pastille et « equipes simultanees », sans semaine', () => {
    const arbre = rendre();
    const lus = textes(arbre);
    expect(lus).toContain('Tes installations');
    expect(lus.join(' | ')).toMatch(/2 équipes simultanées/);
    expect(lus).toContain('Conflits : demande à valider');
    expect(parTexte(arbre, 'Voir le planning')).toBeDefined();
    expect(parTexte(arbre, 'Modifier')).toBeDefined();
    // COLL-C2C (02/10) — planche P8-installations-tel (lot C2C, proprietaire du mode club) : le
    // « Supprimer » rouge est range dans « Plus d actions ».
    expect(parTexte(arbre, 'Supprimer')).toBeUndefined();
    expect(arbre.root.findAll((/** @type {any} */ n) => /^Plus d’actions/.test(String(n.props?.accessibilityLabel || '')), { deep: false }).length).toBeGreaterThan(0);
    expect(lus.join(' | ')).not.toMatch(/Cette semaine/);
    expect(lus).not.toContain('Ma collectivité');
    expect(mockNavigation.setOptions).not.toHaveBeenCalled();
    expect(mockSemainesDemandees.at(-1) || []).toEqual([]);
  });
});
