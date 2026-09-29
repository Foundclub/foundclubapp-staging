import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { canManageCompositionForClub } from '@/domains/subscription/subscriptionDecision';

import { RouteNames } from '@/navigation/routeNames';

import MatchCallUpSelection from '../MatchCallUpSelection';

jest.setTimeout(30000);

// ==========================================================================
// ✂️ FINITIONS3 (29/09, tournee 5, defaut 2) — LE MUR « APRES COUP » SUR « MODIFIER ».
//
// 🎬 Vu a l ecran : compo DEJA publiee, club devenu non couvert. « Modifier la
// composition » ouvrait la selection sans aucun mur ; le coach refaisait tout, puis
// `POST …/composition/draft` rendait 403 `SUBSCRIPTION_PERMISSION_DENIED` et le mur
// « reservee a l offre Equipe » tombait APRES le travail.
//
// ⚖️ Decision du chef (A) : le MEME mur d avance qu une premiere compo (« La
// convocation est incluse dans l offre Equipe — Voir l offre Equipe »), a l entree.
// 🚪 Toutes les portes « Modifier » menent a CET ecran (fiche du match, plateau,
// ecran des reponses, menu « Convocation », site) : la garde y est posee UNE fois,
// et c est celle d EventDetails, sortie dans `subscriptionDecision.js`.
// Le refus du serveur ne change pas.
// ROUGE avant : la selection s affichait, « Suivant » menait au terrain.
// ==========================================================================

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

/**
 * Tout le texte visible de l arbre rendu.
 * @param {any} arbre
 * @returns {string}
 */
const texteVisible = (arbre) => arbre.root.findAllByType(Text)
  .map((/** @type {any} */ noeud) => [].concat(noeud.props.children).join(''))
  .join(' | ');

/**
 * Le pressable le plus profond qui porte ce libelle, ou undefined.
 * @param {any} arbre
 * @param {string} libelle
 * @returns {any}
 */
const bouton = (arbre, libelle) => arbre.root
  .findAll((/** @type {any} */ noeud) => typeof noeud.props?.onPress === 'function'
    && texteVisible({ root: noeud }).includes(libelle))
  .pop();

const EFFECTIF = [
  { documentId: 'p1', firstname: 'Moussa', lastname: 'Diallo' },
  { documentId: 'p2', firstname: 'Hugo', lastname: 'Fofana' },
];

// La compo PUBLIEE que « Modifier la composition » renvoie ici
// (MatchConvocationPublished.js, `handleEdit`) : tout le monde au banc.
const PACK_PUBLIE = {
  manualPlayers: [],
  reservePlayerIds: ['p1', 'p2'],
  schemaVersion: 3,
  selectedPlayerIds: ['p1', 'p2'],
  sportContext: 'football',
  teams: [{ id: 'team_1', name: 'COMPO-Foot-U15', placements: [] }],
};

// Le cas de la recette : le compte paie une offre Club qui couvre UN AUTRE club
// (FoundClub Demo) ; le club du match (AIKI) n a rien.
const AUTH_NON_COUVERT = {
  getSubscriptionAccessLevelForClub: (/** @type {string} */ club) => (
    club === 'club-aiki' ? 'FREE' : 'CLUB'),
  subscriptionAccessLevel: 'CLUB',
};

const MUR = 'La convocation est incluse dans l’offre Équipe';
const OFFRE = 'Voir l’offre Équipe';

/** @type {any[]} */
const arbresMontes = [];

const rendre = async (/** @type {any} */ auth) => {
  mockAuth = auth;
  mockRouteParams = {
    canEdit: true,
    clubId: 'club-aiki',
    eventId: 'evt-3047',
    existingComposition: PACK_PUBLIE,
    players: EFFECTIF,
    publishedComposition: PACK_PUBLIE,
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

beforeEach(() => {
  mockNavigate.mockClear();
});

afterEach(async () => {
  await act(async () => {
    arbresMontes.splice(0).forEach((arbre) => arbre.unmount());
  });
});

describe('FINITIONS3 2 — « Modifier la composition » d un club non couvert', () => {
  test('le mur d avance s affiche a l entree, et rien ne mene au terrain', async () => {
    const arbre = await rendre(AUTH_NON_COUVERT);

    expect(texteVisible(arbre)).toContain(MUR);
    // Aucun travail possible : ni « Suivant », ni joueur a cocher.
    expect(bouton(arbre, 'Suivant')).toBeUndefined();
    expect(texteVisible(arbre)).not.toContain('Moussa');
    // ⇒ aucun chemin vers le terrain, donc aucun `composition/draft`.
    const destinations = mockNavigate.mock.calls.map(([route]) => route);
    expect(destinations).not.toContain(RouteNames.MatchCompositionBoard);
    expect(destinations).not.toContain(RouteNames.MatchCompositionStart);
  });

  test('« Voir l offre Équipe » mene aux offres, avec retour sur la fiche du match', async () => {
    const arbre = await rendre(AUTH_NON_COUVERT);

    await act(async () => { bouton(arbre, OFFRE).props.onPress(); });

    expect(mockNavigate).toHaveBeenCalledWith(RouteNames.ProfileStack, {
      params: {
        resumeRouteName: RouteNames.EventStack,
        resumeRouteParams: { params: { eventId: 'evt-3047' }, screen: RouteNames.EventDetails },
      },
      screen: RouteNames.SubscriptionOffers,
    });
  });

  test('club couvert (offre Équipe) : la sélection s ouvre comme avant, sans mur', async () => {
    const arbre = await rendre({
      getSubscriptionAccessLevelForClub: () => 'TEAM', subscriptionAccessLevel: 'TEAM',
    });

    expect(texteVisible(arbre)).not.toContain(MUR);
    expect(texteVisible(arbre)).toContain('Moussa');
    expect(bouton(arbre, 'Suivant')).toBeDefined();
  });

  test('niveau pas encore connu : aucun argument de vente, la sélection s ouvre', async () => {
    const arbre = await rendre({ subscriptionAccessLevel: null });

    expect(texteVisible(arbre)).not.toContain(MUR);
    expect(bouton(arbre, 'Suivant')).toBeDefined();
  });
});

describe('FINITIONS3 2 — une seule garde, celle d EventDetails', () => {
  test('le niveau du club NOMME fait foi, avec repli sur le club affiche', () => {
    expect(canManageCompositionForClub(AUTH_NON_COUVERT, 'club-aiki')).toBe(false);
    expect(canManageCompositionForClub(AUTH_NON_COUVERT, 'club-demo')).toBe(true);
    expect(canManageCompositionForClub({ subscriptionAccessLevel: 'TEAM' }, 'x')).toBe(true);
    const clubNonCertifie = { subscriptionAccessLevel: 'CLUB_UNVERIFIED' };
    expect(canManageCompositionForClub(clubNonCertifie, '')).toBe(true);
    expect(canManageCompositionForClub({ subscriptionAccessLevel: 'FREE' }, '')).toBe(false);
  });
});
