import { Image, StyleSheet } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ClubLogoMark from '@/components/molecules/clubLogoMark/ClubLogoMark';

import TeamDetails from '../TeamDetails';

// AFFICHAGE (15/09, signalement d'Adel, iPhone build 1311) — sur la fiche de
// l'équipe « Aix-Perd en Buvette », onglet Infos, le logo du club est « entouré
// de blanc ». Sur « Modifier le club », le même logo s'affiche proprement.
//
// LA CAUSE, mesurée : le logo est un JPEG plein de 894 × 1000 (ratio 0,894).
// L'écran rangeait tout ratio entre 0,8 et 1,3 dans un cadre CARRÉ de 92 × 92,
// peint en blanc, cerclé d'un trait blanc. En « contain », l'image n'occupe que
// 82 px de large : il reste ~5 px de fond blanc de chaque côté, plus le trait.
//
// Le fond blanc, lui, est VOULU (`ClubLogoMark`) : un écusson PNG transparent
// disparaîtrait sur le fond sombre. On ne l'enlève donc pas — on donne au cadre
// la FORME du logo, comme « Modifier le club » (lot L15). Un logo plein couvre
// alors tout son cadre ; un logo transparent garde sa pastille blanche.
//
// Point d'observation : le `style` que `ProfileAvatar` reçoit à travers le VRAI
// `ClubLogoMark` — c'est lui qui dessine le cadre.

/** @type {any} */
let mockEquipe;
/** @type {any[]} */
const mockCadres = [];

const mockNavigation = {
  addListener: () => () => {},
  goBack: jest.fn(),
  navigate: jest.fn(),
  setOptions: jest.fn(),
};

jest.mock('@react-navigation/native', () => ({ useFocusEffect: () => {} }));
// Recolte INVIT2 (15/09) : la fiche d equipe charge desormais la feuille d invitation
// (views/team/invite/TeamInviteSheet.js), son QR et ses services -- memes doublures que
// TeamDetails.P10invitation.test.js, ecrites en entier.
jest.mock('@/services/teamInvite/teamInviteQueries', () => ({
  useSentTeamInvites: () => ({ data: [], refetch: jest.fn() }),
  useTeamInviteSuggestions: () => ({ data: undefined, refetch: jest.fn() }),
}));
jest.mock('@/services/teamInvite/teamInviteService', () => ({
  cancelTeamInvite: jest.fn(),
  createTeamInviteLink: jest.fn(),
  createTeamPhoneInvite: jest.fn(),
}));
jest.mock('react-native-qrcode-svg', () => function QRCodeMock() {
  return null;
});
jest.mock('@/services/teamInvite/teamInviteShare', () => ({
  buildTeamInviteMessage: () => '',
  buildTeamInviteUrl: () => '',
  openInviteSms: jest.fn(),
  shareExistingTeamInvite: jest.fn(),
}));

jest.mock('@tanstack/react-query', () => ({
  useMutation: () => ({ isPending: false, mutate: jest.fn() }),
  useQuery: () => ({ data: undefined, isLoading: false, refetch: jest.fn() }),
  useQueryClient: () => ({ invalidateQueries: jest.fn(), setQueryData: jest.fn() }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => {
      if (typeof repli === 'string') return repli;
      if (repli && typeof repli.defaultValue === 'string') return repli.defaultValue;
      return cle;
    },
  }),
}));

// Le thème double garde les deux styles qui font le trait blanc : sans eux, un
// cadre cerclé et un cadre nu seraient indiscernables.
jest.mock('@/theme/themeContext', () => {
  const feuilleDeStyle = {};
  const rampe = () => new Proxy({}, { get: () => feuilleDeStyle });
  return {
    __esModule: true,
    default: () => ({
      Alignments: rampe(),
      ApplicationStyle: new Proxy({}, {
        get: (_cible, cle) => {
          if (cle === 'borderWidth1') return { borderWidth: 1 };
          if (cle === 'borderColor') {
            return new Proxy({}, {
              get: (_c, teinte) => ({ borderColor: `couleur-${String(teinte)}` }),
            });
          }
          return feuilleDeStyle;
        },
      }),
      Colors: new Proxy({}, { get: (_cible, cle) => `couleur-${String(cle)}` }),
      Fonts: rampe(),
      Images: new Proxy({}, { get: () => 1 }),
      Spaces: new Proxy({}, { get: () => rampe() }),
    }),
  };
});

jest.mock('@/utils/imageUrl', () => ({
  getImageUrl: (/** @type {string} */ url) => (url ? `https://exemple.test${url}` : ''),
}));

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({
    canEditClub: () => false,
    canJoinTeam: () => false,
    canManageTeam: () => false,
    entitlementsSummary: null,
    getNextOnboardingRoute: () => null,
    getPostOnboardingHomeRoute: () => null,
    inviteTeamPlayers: jest.fn(),
    refetchUserData: jest.fn(),
    subscriptionAccessLevel: 'FREE',
    USER_ROLES: {},
    userData: { documentId: 'moi', myTeams: [], trainedTeams: [] },
  }),
}));

jest.mock('@/domains/club/useClub', () => ({
  __esModule: true,
  default: () => ({ getClubInitials: () => 'FC' }),
}));

jest.mock('@/domains/messaging/useMessaging', () => ({
  __esModule: true,
  default: () => ({ startTeamChat: jest.fn(), startWhisperChat: jest.fn() }),
}));

jest.mock('@/services/team/teamQueries', () => ({
  useGetTeam: () => ({
    data: mockEquipe, error: null, isLoading: false, refetch: jest.fn(),
  }),
}));
jest.mock('@/services/club/clubQueries', () => ({
  useGetClub: () => ({ data: undefined, error: null, refetch: jest.fn() }),
}));
jest.mock('@/services/stats/statsQueries', () => ({
  useGetTeamStats: () => ({ data: undefined, isLoading: false, refetch: jest.fn() }),
}));
jest.mock('@/services/stats/statsService', () => ({ resetTeamStats: jest.fn() }));
jest.mock('@/services/matchStats/matchStatsQueries', () => ({
  useGetTeamPerformanceStats: () => ({ data: undefined, isLoading: false, refetch: jest.fn() }),
}));
jest.mock('@/services/team/teamService', () => ({
  deleteTeam: jest.fn(),
  getTeamExternalCalendar: jest.fn(),
  previewTeamScraping: jest.fn(),
  quitTeam: jest.fn(),
  refreshTeamExternalData: jest.fn(),
  removePlayerFromTeam: jest.fn(),
  updateTeam: jest.fn(),
  updateTeamExternalConfig: jest.fn(),
}));
jest.mock('@/services/teamMembershipRequest/teamMembershipRequestService', () => ({
  createTeamMembershipRequest: jest.fn(),
}));
jest.mock('@/services/auth/authService', () => ({ removeTrainerFromClub: jest.fn() }));

jest.mock(
  '@/components/molecules/withDataWrapper/WithDataWrapper',
  () => function EnveloppeMock({ children }) { return children; },
);
jest.mock(
  '@/components/templates/ScreenContainer',
  () => function EcranMock({ children }) { return children; },
);
jest.mock(
  '@/components/organisms/eventListContent/EventListContent',
  () => function AgendaMock() { return null; },
);

// ⚠️ Une par une, jamais dans une boucle : Babel ne HISSE que les `jest.mock`
// écrits au premier niveau.
jest.mock(
  '@/components/atoms/checkable/Checkable',
  () => function FeuilleMock() { return null; },
);
jest.mock(
  '@/components/atoms/loader/Loader',
  () => function FeuilleMock() { return null; },
);
jest.mock(
  '@/components/atoms/sponsorLogoTile/SponsorLogoTile',
  () => function FeuilleMock() { return null; },
);
jest.mock(
  '@/components/atoms/SvgIcon/SvgIcon',
  () => function FeuilleMock() { return null; },
);
jest.mock(
  '@/components/atoms/teamShield/TeamShield',
  () => function FeuilleMock() { return null; },
);
jest.mock(
  '@/components/molecules/bottomModal/BottomModal',
  () => function FeuilleMock() { return null; },
);
jest.mock(
  '@/components/molecules/input/Input',
  () => function FeuilleMock() { return null; },
);
jest.mock(
  '@/components/molecules/memberAvatar/MemberAvatar',
  () => function FeuilleMock() { return null; },
);
// `ClubLogoMark` n'est PAS doublé : c'est lui qui pose le fond blanc. Son
// dessinateur, lui, l'est — et il note le cadre qu'on lui confie.
jest.mock(
  '@/components/molecules/profileAvatar/ProfileAvatar',
  () => function CadreMock(/** @type {any} */ props) {
    if (props.variant === 'logo') mockCadres.push(props);
    return null;
  },
);
jest.mock(
  '@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet',
  () => function FeuilleMock() { return null; },
);
jest.mock(
  '@/components/molecules/teamSlotList/TeamSlotList',
  () => function FeuilleMock() { return null; },
);
jest.mock(
  '@/components/organisms/createTrainerModal/CreateTrainerModal',
  () => function FeuilleMock() { return null; },
);

jest.mock('@/components/atoms/button/Button', () => function BoutonMock(/** @type {any} */ props) {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN } = jest.requireActual('react-native');
  return reactActuel.createElement(TexteRN, null, props.title);
});

/** @type {any} */
let arbre;

/**
 * Monte la fiche avec un logo de club aux dimensions données, et rend le cadre
 * du DERNIER rendu (celui qui connaît la vraie forme du logo).
 * @param {{ largeur: number, hauteur: number }} logo Dimensions réelles du fichier.
 * @returns {{ cadre: any, props: any }} Le style aplati du cadre, et les props reçues.
 */
const cadreDuLogo = ({ hauteur, largeur }) => {
  mockCadres.length = 0;
  jest.spyOn(Image, 'getSize').mockImplementation((_uri, succes) => succes(largeur, hauteur));
  mockEquipe = {
    activities: [],
    club: {
      documentId: 'club-aix',
      logo: { url: '/uploads/logo.jpg' },
      name: 'Aix-Perd',
    },
    documentId: 'equipe-aix',
    name: 'Aix-Perd en Buvette',
    players: [],
    trainers: [],
  };
  act(() => {
    arbre = renderer.create(
      <TeamDetails
        navigation={/** @type {any} */ (mockNavigation)}
        route={/** @type {any} */ ({ params: { teamId: 'equipe-aix' } })}
      />,
    );
  });
  const props = mockCadres[mockCadres.length - 1];
  return { cadre: StyleSheet.flatten(props.style), props };
};

afterEach(() => {
  if (arbre) act(() => arbre.unmount());
  arbre = null;
  jest.restoreAllMocks();
});

describe('AFFICHAGE — le logo du club sur la fiche d\'équipe, sans halo blanc', () => {
  test('le logo réel d\'Aix-Perd (894 × 1000) : le cadre prend SA forme, sans bandes', () => {
    const { cadre } = cadreDuLogo({ hauteur: 1000, largeur: 894 });

    // À l'arrondi du pixel près : le ratio du cadre est celui de l'image.
    expect(Math.abs((cadre.width / cadre.height) - 0.894)).toBeLessThan(0.01);
  });

  test('aucun trait blanc autour : le cadre n\'est pas cerclé', () => {
    const { cadre } = cadreDuLogo({ hauteur: 1000, largeur: 894 });

    expect(cadre.borderWidth || 0).toBe(0);
  });

  test('aucune marge intérieure : l\'image touche les bords de son cadre', () => {
    const { props } = cadreDuLogo({ hauteur: 1000, largeur: 894 });

    expect(props.safeInsetRatio || 0).toBe(0);
  });

  test('un logo TRANSPARENT reste lisible : le fond blanc de ClubLogoMark est gardé', () => {
    const { cadre } = cadreDuLogo({ hauteur: 1000, largeur: 1000 });

    // Référence : le fond que ClubLogoMark pose SEUL, sans aucun style d'écran.
    // (Comparé plutôt qu'écrit en dur : le contrat de thème compte aussi les
    // couleurs littérales des témoins.)
    mockCadres.length = 0;
    /** @type {any} */
    let reference;
    act(() => {
      reference = renderer.create(<ClubLogoMark logoUrl="/uploads/logo.png" />);
    });
    const fondDeReference = StyleSheet.flatten(mockCadres[0].style).backgroundColor;
    act(() => reference.unmount());

    expect(fondDeReference).toBeTruthy();
    expect(fondDeReference).not.toBe('transparent');
    expect(cadre.backgroundColor).toBe(fondDeReference);
  });

  test('un logo carré garde exactement son cadre de 92 × 92', () => {
    const { cadre } = cadreDuLogo({ hauteur: 512, largeur: 512 });

    expect(cadre).toMatchObject({ height: 92, width: 92 });
  });

  test('un logo hors bornes (bannière 3:1) est borné : le cadre ne déborde pas', () => {
    const { cadre } = cadreDuLogo({ hauteur: 100, largeur: 300 });

    // Mêmes bornes que les anciens cadres large (122 × 78) et haut (78 × 102).
    expect(cadre.width).toBeLessThanOrEqual(122);
    expect(cadre.height).toBeGreaterThanOrEqual(70);
  });
});
