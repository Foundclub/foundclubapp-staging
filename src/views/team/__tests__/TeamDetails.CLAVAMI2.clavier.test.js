import {
  LayoutAnimation, Modal, ScrollView, Text, TextInput,
} from 'react-native';
import renderer, { act } from 'react-test-renderer';

import Button from '@/components/atoms/button/Button';
import TeamDetails from '@/views/team/TeamDetails';

import {
  appuyer,
  cadre,
  clavierAndroid,
  clavierIOS,
  IPHONES,
  restaurerTelephone,
  style,
  telephone,
  verifierDefilement,
} from './helpers/clavami2ModalGeometry';

jest.setTimeout(30000);

const mockInsets = {
  bottom: 34,
  left: 0,
  right: 0,
  top: 59,
};
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => mockInsets }));
jest.mock('@react-navigation/native', () => ({ useFocusEffect: () => {} }));
jest.mock(
  'react-i18next',
  () => jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next,
);
jest.mock(
  'i18next',
  () => jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').i18next,
);
jest.mock('@/theme/themeContext', () => {
  const couleurs = jest.requireActual('@/theme/colors').default();
  return {
    __esModule: true,
    default: () => ({
      Alignments: jest.requireActual('@/theme/alignements').default,
      ApplicationStyle: jest.requireActual('@/theme/applicationStyle').default(couleurs),
      Colors: couleurs,
      Fonts: jest.requireActual('@/theme/fonts').default(couleurs),
      Images: new Proxy({}, { get: () => 1 }),
      Spaces: jest.requireActual('@/theme/spaces').default,
    }),
  };
});

const mockEquipe = {
  activities: [{ name: 'Football' }],
  club: { documentId: 'club-clavami2', name: 'Club test' },
  documentId: 'equipe-clavami2',
  externalCompetitionName: 'Championnat',
  name: 'U15',
  players: [],
  trainers: [],
};
const mockLecture = {
  data: mockEquipe,
  error: null,
  isFetching: false,
  isLoading: false,
  refetch: jest.fn(),
};
const mockVide = {
  data: null,
  error: null,
  isLoading: false,
  refetch: jest.fn(),
};
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({
    canEditClub: () => true,
    canJoinTeam: () => false,
    canManageTeam: true,
    entitlementsSummary: [],
    getNextOnboardingRoute: () => null,
    getPostOnboardingHomeRoute: () => null,
    inviteTeamPlayers: jest.fn(),
    refetchUserData: jest.fn(),
    subscriptionAccessLevel: 'FREE',
    USER_ROLES: { admin: 'Dirigeant', coach: 'Entraineur', player: 'Joueur' },
    userData: {
      club: mockEquipe.club,
      documentId: 'moi',
      myTeams: [{ documentId: mockEquipe.documentId }],
      role: { name: 'Dirigeant' },
      teamMembershipRequests: [],
      trainedTeams: [],
    },
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
jest.mock('@tanstack/react-query', () => ({
  useMutation: () => ({ isPending: false, mutate: jest.fn() }),
  useQueryClient: () => ({ invalidateQueries: jest.fn(), setQueryData: jest.fn() }),
}));
jest.mock('@/services/team/teamQueries', () => ({ useGetTeam: () => mockLecture }));
jest.mock('@/services/club/clubQueries', () => ({
  useGetClub: () => ({ ...mockVide, data: mockEquipe.club }),
}));
jest.mock('@/services/stats/statsQueries', () => ({ useGetTeamStats: () => mockVide }));
jest.mock('@/services/matchStats/matchStatsQueries', () => ({
  useGetTeamPerformanceStats: () => mockVide,
}));
jest.mock('@/services/team/teamService', () => ({
  connectExternalCompetition: jest.fn(),
  createFFBBErrorReport: jest.fn(),
  leaveTeam: jest.fn(),
  previewExternalCompetition: jest.fn(),
  refreshExternalCompetition: jest.fn(),
  removePlayerFromTeam: jest.fn(),
  updateTeam: jest.fn(),
}));
jest.mock('@/services/auth/authService', () => ({ removeTrainerFromClub: jest.fn() }));
jest.mock('@/services/stats/statsService', () => ({ resetTeamStats: jest.fn() }));
jest.mock('@/services/teamMembershipRequest/teamMembershipRequestService', () => ({
  acceptTeamInvitation: jest.fn(),
  createTeamMembershipRequest: jest.fn(),
  refuseTeamInvitation: jest.fn(),
}));
jest.mock('@/services/client', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));
jest.mock('@/services/teamInvite/teamInviteQueries', () => ({
  useSentTeamInvites: () => mockVide,
  useTeamInviteSuggestions: () => mockVide,
}));
jest.mock('@/services/teamInvite/teamInviteService', () => ({
  cancelTeamInvite: jest.fn(),
  createTeamInviteLink: jest.fn(),
  createTeamPhoneInvite: jest.fn(),
}));
jest.mock('@/services/teamInvite/teamInviteShare', () => ({
  buildTeamInviteMessage: () => '',
  buildTeamInviteUrl: () => '',
  openInviteSms: jest.fn(),
  shareExistingTeamInvite: jest.fn(),
}));
jest.mock('react-native-qrcode-svg', () => () => null);
jest.mock('@/utils/imageUrl', () => ({ getImageUrl: () => null }));
jest.mock(
  '@/components/templates/ScreenContainer',
  () => ({ children }) => children,
);
jest.mock(
  '@/components/molecules/withDataWrapper/WithDataWrapper',
  () => ({ children }) => children,
);
jest.mock('@/components/molecules/bottomModal/BottomModal', () => () => null);
jest.mock('@/components/molecules/input/Input', () => () => null);
jest.mock('@/components/molecules/profileAvatar/ProfileAvatar', () => () => null);
jest.mock('@/components/molecules/clubLogoMark/ClubLogoMark', () => () => null);
jest.mock(
  '@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet',
  () => () => null,
);
jest.mock('@/components/molecules/teamSlotList/TeamSlotList', () => () => null);
jest.mock('@/components/organisms/createTrainerModal/CreateTrainerModal', () => () => null);
jest.mock('@/components/organisms/eventListContent/EventListContent', () => () => null);
jest.mock('@/components/atoms/SvgIcon/SvgIcon', () => ({
  __esModule: true,
  default: () => null,
  SvgIcon: () => null,
}));
jest.mock('@/components/atoms/loader/Loader', () => () => null);
jest.mock('@/components/atoms/teamShield/TeamShield', () => () => null);
jest.mock('@/components/atoms/sponsorLogoTile/SponsorLogoTile', () => () => null);
jest.mock('@/components/atoms/checkable/Checkable', () => () => null);

let arbre;
const navigation = {
  addListener: () => () => {},
  getParent: () => null,
  goBack: jest.fn(),
  navigate: jest.fn(),
  setOptions: jest.fn(),
};
const monter = async () => {
  await act(async () => {
    arbre = renderer.create(
      <TeamDetails navigation={navigation} route={{ params: { teamId: mockEquipe.documentId } }} />,
    );
  });
};
const ouvrir = async () => {
  if (!arbre) await monter();
  // Chemin réel : Calendrier > source externe > Signaler.
  await appuyer(arbre.root, (n) => (
    n.findAllByType(Text).some((t) => t.props.children === 'Calendrier')
  ));
  await appuyer(arbre.root, (n) => n.props.title === 'Signaler');
  const fenetre = arbre.root
    .findAllByType(Modal)
    .find(
      (m) => m.props.visible
        && m.findAllByType(TextInput).some((n) => n.props.placeholder === 'Décris le problème...'),
    );
  expect(fenetre).toBeDefined();
  const [champ] = fenetre.findAllByType(TextInput);
  await act(async () => {
    champ.props.onChangeText('Le classement est incorrect.');
  });
  return { champ, fenetre };
};
afterEach(async () => {
  if (arbre) act(() => arbre.unmount());
  arbre = null;
  await clavierIOS(IPHONES[0], false);
  jest.restoreAllMocks();
  restaurerTelephone();
});

describe('CLAVAMI2 — Signaler un problème', () => {
  test.each(IPHONES)('$nom : la zone utile s arrête au-dessus du clavier', async (iphone) => {
    telephone('ios', '18.0', iphone.barre, mockInsets);
    const { fenetre } = await ouvrir();
    await clavierIOS(iphone, true);
    const { voile } = cadre(fenetre);
    expect(iphone.ecran - (style(voile).paddingBottom || 0)).toBeLessThanOrEqual(
      iphone.ecran - iphone.clavier,
    );
  });

  test.each(IPHONES)(
    '$nom : le contenu trop haut peut défiler jusqu aux boutons',
    async (iphone) => {
      telephone('ios', '18.0', iphone.barre, mockInsets);
      const { fenetre } = await ouvrir();
      await clavierIOS(iphone, true);
      // Une simple translation du panneau centré ne suffit pas : minimum 572 > 516/407 pt.
      verifierDefilement(fenetre, iphone, 0);
      const [defilement] = fenetre.findAllByType(ScrollView);
      expect(defilement.findAllByType(TextInput).map((n) => n.props.value)).toEqual([
        'Le classement est incorrect.',
      ]);
      expect(defilement.findAllByType(Button).map((n) => n.props.title)).toEqual([
        'Annuler',
        'Envoyer',
      ]);
    },
  );

  test('fenêtre fermée : aucune animation du clavier de la page', async () => {
    telephone('ios', '18.0', 34, mockInsets);
    await monter();
    const animation = jest.spyOn(LayoutAnimation, 'configureNext');
    await clavierIOS(IPHONES[0], true);
    expect(animation).not.toHaveBeenCalled();
  });

  test('fermée clavier ouvert puis rouverte clavier fermé : retrait nul', async () => {
    telephone('ios', '18.0', 34, mockInsets);
    const { fenetre } = await ouvrir();
    await clavierIOS(IPHONES[0], true);
    expect(style(cadre(fenetre).voile).paddingBottom).toBe(336);
    await act(async () => {
      fenetre.props.onRequestClose();
    });
    await clavierIOS(IPHONES[0], false);
    const { fenetre: rouverte } = await ouvrir();
    expect(style(cadre(rouverte).voile).paddingBottom || 0).toBe(0);
  });

  test.each(IPHONES)(
    '$nom : refermer le clavier restitue la géométrie initiale',
    async (iphone) => {
      telephone('ios', '18.0', iphone.barre, mockInsets);
      const { fenetre } = await ouvrir();
      const avant = style(cadre(fenetre).voile).paddingBottom || 0;
      await clavierIOS(iphone, true);
      await clavierIOS(iphone, false);
      expect(style(cadre(fenetre).voile).paddingBottom || 0).toBe(avant);
    },
  );

  test.each([34, 35, 36])(
    'Android API %s : aucun second retrait ni transparence système ajoutés',
    async (api) => {
      telephone('android', api, 48, mockInsets);
      const { fenetre } = await ouvrir();
      const avant = style(cadre(fenetre).voile).paddingBottom || 0;
      await clavierAndroid();
      expect(style(cadre(fenetre).voile).paddingBottom || 0).toBe(avant);
      expect(fenetre.props.statusBarTranslucent).toBeFalsy();
      expect(fenetre.props.navigationBarTranslucent).toBeFalsy();
    },
  );
});
