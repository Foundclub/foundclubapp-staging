import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import FacilityList from '../FacilityList';

// 🏛️ TEXTES-COLLECTIVITES (lot 1, 01/10/2026) — LA LISTE DES INSTALLATIONS, côté mairie et
// côté club. Le VRAI i18next (fr.js, pluriels et interpolations compris) écrit les phrases :
// le témoin historique double `t()` et rend le texte de repli brut, il ne voit donc ni un
// pluriel ni un nom interpolé.
//
// Ce que ce témoin exige (ROUGE avant le lot) :
//   - mairie : le titre « Installations de la Ville » s’écrivait DEUX FOIS (en-tête de
//     l’écran + titre de la page) ; la page porte désormais le NOM de la collectivité ;
//   - mairie : la liste vide la vouvoie ;
//   - club : « Tes installations · 4 » comptait celles de la Ville comme les siennes : les
//     deux nombres se disent séparément ;
//   - club : « Installation de Ville de Montrivage » (article manquant) devient « gérée par
//     la Ville de Montrivage ».

/** @type {any} */
let mockRoute;
/** @type {any} */
let mockFacilityContext;
/** @type {any} */
let mockCollectiviteInstallations;
/** @type {any} */
let mockMesCollectivites;

const mockSetOptions = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: jest.fn(),
  useNavigation: () => ({ goBack: jest.fn(), navigate: jest.fn(), setOptions: mockSetOptions }),
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

// COLL-C2B (02/10) : la liste de la Ville lit la semaine de chaque installation (son planning) et
// range ses gestes dans une feuille du bas ; deux doublures, sans effet cote club.
jest.mock('@/services/seasonSlot/seasonSlotQueries', () => ({
  useInstallationsWeekSummary: () => ({}),
}));
jest.mock('@/components/molecules/bottomModal/BottomModal', () => function BottomModalMock(
  /** @type {any} */ { children, isVisible },
) {
  return isVisible ? children : null;
});

jest.mock('@/services/collectivite/collectiviteQueries', () => ({
  useCollectiviteInstallations: () => mockCollectiviteInstallations,
  useMyCollectivites: () => mockMesCollectivites,
}));

// Le service est double ENTIEREMENT (il importe le client HTTP, qui refuse de se charger
// sans `API_URL`) ; les sections sont celles de la source, recopiees au plus court.
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

const dispositionFigee = { sceneBottomInset: 24 };
jest.mock('@/navigation/useBottomDockLayout', () => ({
  __esModule: true,
  default: () => dispositionFigee,
}));

jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) { return children; },
);
jest.mock('@/components/atoms/loader/Loader', () => function LoaderMock() { return null; });
// La liste vide se lit dans ce que l ecran confie a l etat vide.
/** @type {any[]} */
const mockEtatsVides = [];
jest.mock('@/components/atoms/emptyState/EmptyState', () => function EmptyStateMock(
  /** @type {any} */ props,
) {
  mockEtatsVides.push(props);
  return null;
});
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
jest.mock(
  '@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet',
  () => function SubscriptionPaywallSheetMock() { return null; },
);

const GYMNASE_VILLE = {
  address: { description: '1 avenue du Stade, Montrivage' },
  capacityConflictMode: 'pending_validation',
  documentId: 'gymnase-ville',
  maxSlots: 2,
  name: 'Gymnase Jean-Moulin',
  type: 'Gymnase',
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
const aplatirTexte = (/** @type {any} */ enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatirTexte).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatirTexte(enfants?.props?.children);
  return String(enfants);
};
const textes = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text)
  .map((/** @type {any} */ noeud) => aplatirTexte(noeud.props.children).trim());

beforeEach(() => {
  mockEtatsVides.length = 0;
  mockMesCollectivites = {
    data: [{ documentId: 'ville-montrivage', name: 'Ville de Montrivage', type: 'commune' }],
    isLoading: false,
  };
  mockCollectiviteInstallations = {
    data: [GYMNASE_VILLE], error: null, isLoading: false, isRefetching: false, refetch: jest.fn(),
  };
  mockFacilityContext = {
    // eslint-disable-next-line max-len
    data: { allFacilities: [], cmId: null }, error: null, isLoading: false, isRefetching: false, refetch: jest.fn(),
  };
});

afterEach(() => {
  act(() => { arbresMontes.splice(0).forEach((arbre) => arbre.unmount()); });
});

describe('TEXTES-COLLECTIVITES — la liste, côté MAIRIE', () => {
  beforeEach(() => {
    mockRoute = { params: { collectiviteId: 'ville-montrivage' } };
  });

  // COLL-C2B (02/10, design P4 « un seul titre ») : la PAGE porte « Installations de la Ville »,
  // une fois, et l en-tete de navigation se tait. Avant : la page portait le nom de la Ville.
  it('un seul titre : la page dit « Installations de la Ville » une fois, l en-tête se tait', () => {
    const lus = textes(rendre());
    expect(lus.filter((texte) => texte === 'Installations de la Ville')).toHaveLength(1);
    expect(mockSetOptions).toHaveBeenCalledWith({ headerTitle: '' });
    expect(lus).toContain('1 installation');
  });

  it('la liste vide vouvoie la mairie', () => {
    mockCollectiviteInstallations = { ...mockCollectiviteInstallations, data: [] };
    rendre();
    expect(mockEtatsVides.pop()?.description)
      // eslint-disable-next-line max-len
      .toBe('Ajoutez les gymnases, terrains et salles de la Ville : les clubs verront leur planning.');
  });
});

describe('TEXTES-COLLECTIVITES — la liste, côté CLUB', () => {
  const SALLE_DU_CLUB = {
    // eslint-disable-next-line max-len
    documentId: 'salle-club', isReadOnly: false, isShared: false, maxSlots: 1, name: 'Salle du club', ownerType: 'club', type: 'Gymnase',
  };
  const DE_LA_VILLE = (/** @type {string} */ id) => ({
    ...GYMNASE_VILLE,
    collectivite: { documentId: 'ville-montrivage', name: 'Ville de Montrivage' },
    documentId: id,
    isReadOnly: true,
    isShared: true,
    name: `Gymnase ${id}`,
    ownerName: 'Ville de Montrivage',
    ownerType: 'collectivite',
  });

  beforeEach(() => {
    mockRoute = { params: { clubId: 'as-montrivage' } };
    mockFacilityContext = {
      ...mockFacilityContext,
      data: { allFacilities: [SALLE_DU_CLUB, DE_LA_VILLE('a'), DE_LA_VILLE('b')], cmId: null },
    };
  });

  it('les installations du club et celles de la Ville se comptent SÉPARÉMENT', () => {
    const lus = textes(rendre());
    expect(lus).toContain('Tes installations');
    expect(lus).not.toContain('3 installations');
    // COLL-C2C (02/10) — design P8v2 valide (vague 2) : les installations de la Ville se rangent
    // en groupes ; le compte dit « au club » et « à demander » (aucune n a de créneau du club ici).
    expect(lus).toContain('1 au club · 2 à demander');
  });

  // eslint-disable-next-line max-len
  it('la carte d une installation de la Ville dit « gérée par la Ville de … » (l article ne manque plus)', () => {
    const lus = textes(rendre());
    // COLL-C2C (02/10) — design P8v2 : la phrase n est plus REPETEE sur chaque carte ; la Ville est
    // nommee une fois, dans la ligne du groupe, AVEC son article.
    // eslint-disable-next-line max-len
    expect(lus).not.toContain('Installation gérée par la Ville de Montrivage : planning en lecture seule.');
    // eslint-disable-next-line max-len
    expect(lus).toContain('La Ville de Montrivage : ton club n’y a pas de créneau. Regarde les heures libres et demande.');
    expect(lus.join(' ')).not.toMatch(/de Ville de Montrivage/);
  });

  it('sans installation de la Ville, le compte reste celui d avant', () => {
    // eslint-disable-next-line max-len
    mockFacilityContext = { ...mockFacilityContext, data: { allFacilities: [SALLE_DU_CLUB], cmId: null } };
    expect(textes(rendre())).toContain('1 installation');
  });
});

// TEXTES-COLLECTIVITES (tranche du chef, 01/10 ~16h55) — « 1 installation » etait ecrit EN DUR
// en francais (`getListSubtitle`) : un telephone en anglais le lisait en francais. Le compte
// passe par le dictionnaire ; le temoin le prouve en anglais.
describe('TEXTES-COLLECTIVITES — le compte des installations passe par le dictionnaire', () => {
  const i18next = jest.requireActual('i18next');

  beforeAll(() => {
    i18next.addResourceBundle(
      'en',
      'translation',
      jest.requireActual('@/theme/strings/translations/en').default,
      true,
      true,
    );
  });

  afterEach(async () => {
    await i18next.changeLanguage('fr');
  });

  it('en anglais : « 1 facility », plus « 1 installation »', async () => {
    mockRoute = { params: { collectiviteId: 'ville-montrivage' } };
    await i18next.changeLanguage('en');
    const lus = textes(rendre());
    expect(lus).toContain('1 facility');
    expect(lus).not.toContain('1 installation');
  });

  it('en français, 2 installations : le pluriel du dictionnaire', () => {
    mockRoute = { params: { collectiviteId: 'ville-montrivage' } };
    mockCollectiviteInstallations = {
      ...mockCollectiviteInstallations,
      data: [GYMNASE_VILLE, { ...GYMNASE_VILLE, documentId: 'gymnase-2', name: 'Gymnase 2' }],
    };
    expect(textes(rendre())).toContain('2 installations');
  });
});

jest.mock(
  '@/components/atoms/skeletonLoader/SkeletonLoader',
  () => function SkeletonMock({ children }) { return children; },
);
jest.mock('@/context/AppFeedbackContext', () => ({
  useAppFeedback: () => ({ showBanner: jest.fn() }),
}));
