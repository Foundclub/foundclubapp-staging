import renderer, { act } from 'react-test-renderer';

import TeamDetails from '../TeamDetails';

// SPONSRV (14/10) — frère de SPONSOR-SUPPR (13/10, `ClubDetails.js`). Sur la fiche d'une
// équipe, onglet Infos, les partenaires du CLUB défilent en bandeau ; chaque rangée portait
// leur LIEN pour clé. Or le lien est FACULTATIF (`AddSponsor.js`) : le serveur rend `null`
// pour chaque partenaire sans site, et deux partenaires sans site (ou avec la même adresse)
// partageaient la même clé — React le signale (« same key ») et peut confondre les rangées
// au rendu suivant. Chaque entrée du composant `sponsor.sponsor` a un `id` : c'est lui la
// clé, et sa place dans la liste pour un ancien partenaire qui n'en aurait pas.
//
// Mêmes doublures que TeamDetails.AFFICHAGE.logoClub.test.js, sauf la tuile de partenaire,
// qui écrit ici son nom pour qu'on la voie.

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
  () => function TuileMock(/** @type {any} */ props) {
    const reactActuel = jest.requireActual('react');
    const { Text: TexteRN } = jest.requireActual('react-native');
    return reactActuel.createElement(TexteRN, null, props.title);
  },
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
 * Un partenaire du club tel que le serveur le rend.
 * @param {string} title - Son nom.
 * @param {string | null} link - Son site, facultatif.
 * @param {number} [id] - L'id de l'entrée ; absent chez un ancien partenaire.
 * @returns {any} Le partenaire.
 */
const partenaire = (title, link, id) => ({
  ...(id === undefined ? {} : { id }), link, logo: { url: '/uploads/logo.png' }, title,
});

/**
 * Monte la fiche d'une équipe dont le club a ces partenaires-là.
 * @param {any[]} partenaires - Le tableau `sponsor` du club.
 * @returns {string[]} Les avertissements de clé émis par React pendant le montage.
 */
const avertissementsDeCle = (partenaires) => {
  const erreurs = jest.spyOn(console, 'error').mockImplementation(() => {});
  mockEquipe = {
    activities: [],
    club: {
      documentId: 'club-aix', name: 'Aix-Perd', sponsor: partenaires,
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
  return erreurs.mock.calls
    .map((/** @type {any[]} */ appel) => appel.map(String).join(' '))
    .filter((/** @type {string} */ message) => /same key|unique "key"/.test(message));
};

/**
 * Les noms affichés par les tuiles de partenaires.
 * @returns {string[]} Les noms, dans l'ordre du bandeau.
 */
const nomsAffiches = () => arbre.root
  .findAll((/** @type {any} */ noeud) => noeud.type?.name === 'TuileMock')
  .map((/** @type {any} */ tuile) => tuile.props.title);

afterEach(() => {
  if (arbre) act(() => arbre.unmount());
  arbre = null;
  jest.restoreAllMocks();
});

describe('SPONSRV — les partenaires du club sur la fiche d équipe, une clé par rangée', () => {
  test('sans site, ou au MÊME site : une rangée par partenaire, aucune clé en double', () => {
    const avertissements = avertissementsDeCle([
      partenaire('Boulangerie Martin', null, 11),
      partenaire('Garage Durand', null, 12),
      partenaire('Mairie', 'https://mairie.fr', 13),
      partenaire('Office des sports', 'https://mairie.fr', 14),
    ]);

    expect(nomsAffiches())
      .toEqual(['Boulangerie Martin', 'Garage Durand', 'Mairie', 'Office des sports']);
    expect(avertissements).toEqual([]);
  });

  test('anciens partenaires SANS id : leur place dans la liste sert de clé', () => {
    const avertissements = avertissementsDeCle([
      partenaire('Boulangerie Martin', ''),
      partenaire('Garage Durand', ''),
    ]);

    expect(nomsAffiches()).toEqual(['Boulangerie Martin', 'Garage Durand']);
    expect(avertissements).toEqual([]);
  });
});
