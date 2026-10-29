import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import MatchCallUpSelection from '../MatchCallUpSelection';

jest.setTimeout(30000);

// ==========================================================================
// GUIDE-PETIT-ECRAN (rejeu 3, 29/10, 720×1280 px, texte 1,3, R3-21 / R3-22) :
// sur « Convoqués », la bulle du guide (b2-list) couvrait toutes les lignes de
// joueurs, et « 0 convoqué » se coupait en plein mot (« 0 conv-oqué »).
// L'écran garde à la bulle une place sous son titre (comme « Partir de… ») ;
// le compteur du bas tient sur une ligne.
// ==========================================================================

/** @type {any} */
let mockTour = { isGuide: false };
jest.mock('@/context/useTour', () => ({ useTour: () => mockTour }));

const mockNavigate = jest.fn();
/** @type {any} */
let mockRouteParams = {};
/** @type {any} */
let mockAuth = {};

jest.mock(
  '@/components/atoms/skeletonLoader/SkeletonLoader',
  () => function SkeletonLoaderMock() { return null; },
);

// 🧨 Objet FIGE : le recreer a chaque rendu relance les effets qui en dependent.
const mockNavigation = { goBack: jest.fn(), navigate: mockNavigate, setParams: jest.fn() };

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => ({ params: mockRouteParams }),
}));

// Le VRAI fr.js : le temoin lit les phrases que l ecran montre.
jest.mock('react-i18next', () => {
  const traductions = jest.requireActual('@/theme/strings/translations/fr').default;
  return {
    initReactI18next: { init: () => {}, type: '3rdParty' },
    useTranslation: () => ({
      t: (/** @type {string} */ cle, /** @type {any} */ options) => {
        const valeur = cle.split('.').reduce(
          (/** @type {any} */ noeud, /** @type {string} */ segment) => (
            noeud && typeof noeud === 'object' ? noeud[segment] : undefined
          ),
          traductions,
        );
        if (typeof valeur !== 'string') return typeof options === 'string' ? options : cle;
        return valeur.replace(/{{(\w+)}}/g, (_c, nom) => String(options?.[nom] ?? ''));
      },
    }),
  };
});

jest.mock('@/domains/auth/useAuth', () => ({ __esModule: true, default: () => mockAuth }));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 0, left: 0, right: 0, top: 0,
  }),
}));

jest.mock('@/services/event/eventQueries', () => ({
  useGetEvent: () => ({ data: { team: { club: { documentId: 'club-aiki' } } }, isFetching: false }),
}));

jest.mock('@/services/team/teamQueries', () => ({
  useGetTeams: () => ({ data: { pages: [] }, isFetching: false }),
}));

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
    Images: { arrowLeft: 1, chevronLeft: 1 },
    Spaces: espaces,
  };
  return { __esModule: true, default: () => theme };
});

jest.mock('@/components/templates/ScreenContainer', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { children }) => <View>{children}</View>,
  };
});

jest.mock('@/components/atoms/headerBackButton/HeaderBackButton', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return { __esModule: true, default: () => <TexteRN>RETOUR</TexteRN> };
});

jest.mock('@/components/molecules/profileAvatar/ProfileAvatar', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { name }) => <TexteRN>{`AVATAR:${name}`}</TexteRN>,
  };
});

jest.mock('@/components/atoms/button/Button', () => {
  const { Text: TexteRN, TouchableOpacity } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { onPress, title }) => (
      <TouchableOpacity onPress={onPress}>
        <TexteRN>{title}</TexteRN>
      </TouchableOpacity>
    ),
  };
});

jest.mock('@/components/molecules/bottomModal/BottomModal', () => {
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { children, footerComponent, isVisible }) => (
      isVisible ? (
        <VueRN>
          {children}
          {footerComponent}
        </VueRN>
      ) : null
    ),
  };
});

const EFFECTIF = [
  { documentId: 'p1', firstname: 'Moussa', lastname: 'Diallo' },
  { documentId: 'p2', firstname: 'Hugo', lastname: 'Fofana' },
];

/** @type {any[]} */
const arbresMontes = [];

const rendre = async () => {
  mockAuth = {
    getSubscriptionAccessLevelForClub: () => 'TEAM',
    subscriptionAccessLevel: 'TEAM',
  };
  mockRouteParams = {
    canEdit: true,
    clubId: 'club-aiki',
    eventId: 'evt-3047',
    players: EFFECTIF,
    sport: 'football',
    teamId: 'team_1',
    teamName: 'COMPO-Foot-U15',
  };
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<MatchCallUpSelection />);
  });
  arbresMontes.push(arbre);
  return arbre;
};

const parTestId = (/** @type {any} */ arbre, /** @type {string} */ id) => arbre.root
  .findAll((/** @type {any} */ noeud) => noeud.props?.testID === id
    && typeof noeud.type === 'string');

afterEach(async () => {
  mockTour = { isGuide: false };
  await act(async () => {
    arbresMontes.splice(0).forEach((arbre) => arbre.unmount());
  });
});

describe('GUIDE-PETIT-ECRAN — « Convoqués » pendant b2-list', () => {
  test('la place de la bulle est gardée sous le titre, au-dessus des lignes', async () => {
    const { COACH_GUIDE } = jest.requireActual('@/domains/tour/coachGuide');
    mockTour = {
      currentStep: COACH_GUIDE.steps.find((step) => step.id === 'b2-list'),
      isGuide: true,
      tourStatus: 'active',
    };
    const arbre = await rendre();
    expect(parTestId(arbre, 'tour.bubbleSlot')).toHaveLength(1);
  });

  test('témoin : hors guide, aucune place réservée', async () => {
    const arbre = await rendre();
    expect(parTestId(arbre, 'tour.bubbleSlot')).toHaveLength(0);
  });

  test('« 0 convoqué » tient sur une ligne (la police rapetisse au besoin)', async () => {
    const arbre = await rendre();
    // La doublure de traduction ne gère pas le pluriel : elle rend la clé.
    const compteur = arbre.root.findAll((/** @type {any} */ noeud) => noeud.type === Text
      && [].concat(noeud.props.children).join('') === 'matchCallUp.selection.footer.calledUp')[0];
    expect(compteur).toBeTruthy();
    expect(compteur.props.numberOfLines).toBe(1);
    expect(compteur.props.adjustsFontSizeToFit).toBe(true);
  });
});
