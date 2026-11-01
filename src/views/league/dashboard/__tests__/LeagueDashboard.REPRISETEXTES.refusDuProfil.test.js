import renderer, { act } from 'react-test-renderer';

// REPRISE-TEXTES, point 25 (contre-recette du parent, 01/11) — la League refusée au parent (403)
// disait « Impossible de charger le dashboard League pour le moment. » avec « Réessayer »,
// comme une panne. ROUGE avant : un refus dit « Cette page n’est pas ouverte à ton profil. »,
// sans bouton ; une vraie panne garde son message et son « Réessayer ».

jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));
jest.mock('i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').i18next
));

jest.mock('@react-navigation/native', () => {
  const { useEffect: mockUseEffect } = jest.requireActual('react');
  return {
    useFocusEffect: (/** @type {any} */ effet) => {
      mockUseEffect(effet, [effet]);
    },
    useIsFocused: () => true,
    useNavigation: () => ({ navigate: jest.fn() }),
  };
});
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({}),
}));

jest.mock('@/domains/auth/useAuth', () => () => ({ userData: { documentId: 'u1' } }));
jest.mock('@/navigation/useBottomDockLayout', () => () => ({ sceneBottomInset: 0 }));

const mockPendingTeamIds = /** @type {any[]} */ ([]);
jest.mock('@/services/league/leagueActionQueries', () => ({
  usePendingLeagueAction: (/** @type {any} */ teamId) => {
    mockPendingTeamIds.push(teamId);
    return { data: null };
  },
}));
const mockGetMatchHistory = jest.fn();
jest.mock('@/services/league/leagueMatchService', () => ({
  getMatch: jest.fn(),
  getMatchHistory: (/** @type {any[]} */ ...args) => mockGetMatchHistory(...args),
}));
const mockLoadContext = jest.fn();
jest.mock('@/services/leagueTeam/leagueTeamQueries', () => ({
  loadLeagueTeamContextWithCache: (/** @type {any[]} */ ...args) => mockLoadContext(...args),
}));
jest.mock('@/services/leagueTeam/leagueTeamService', () => ({
  getRanking: () => Promise.resolve([]),
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
      Images: {},
      Spaces: espaces,
    }),
  };
});

/** @type {any[]} */
const mockHistories = [];
jest.mock('@/components/organisms/league/MatchHistory', () => function MatchHistoryMock(
  /** @type {any} */ props,
) {
  mockHistories.push(props.matches);
  return null;
});
jest.mock('@/components/molecules/bottomModal/BottomModal', () => function BottomModalMock(
  /** @type {any} */ props,
) {
  return props.children;
});
jest.mock('@/components/atoms/button/Button', () => () => null);
jest.mock('@/components/atoms/league/LeagueCard', () => function LeagueCardMock(
  /** @type {any} */ props,
) {
  return props.children;
});
jest.mock('@/components/atoms/marqueeText/MarqueeText', () => () => null);
jest.mock('@/components/atoms/SectionHeader/SectionHeader', () => () => null);
jest.mock('@/components/atoms/teamShield/TeamShield', () => () => null);
jest.mock('@/components/molecules/header/LeagueHeaderSwitch', () => () => null);
jest.mock('@/components/molecules/notificationBadge/NotificationBadge', () => () => null);
jest.mock('@/components/molecules/profileAvatar/ProfileAvatar', () => () => null);
jest.mock('@/components/molecules/profileButton/ProfileButton', () => () => null);
jest.mock('@/components/organisms/league/CompetitiveHero', () => () => null);
jest.mock('@/components/templates/ScreenContainer', () => function ScreenContainerMock(
  /** @type {any} */ props,
) {
  return props.children;
});
/** @type {any[]} */
const mockEtats = [];
jest.mock('@/views/league/components/LeagueStateView', () => function LeagueStateViewMock(
  /** @type {any} */ props,
) {
  mockEtats.push(props);
  return null;
});

const LeagueDashboard = require('../LeagueDashboard').default;

beforeEach(() => {
  mockEtats.length = 0;
  mockGetMatchHistory.mockResolvedValue([]);
});

/**
 * Monte le tableau de bord avec un chargement des squads en erreur.
 * @param {any} erreur l'erreur du chargement
 * @returns {Promise<any>} le dernier état affiché
 */
const monterEnErreur = async (erreur) => {
  mockLoadContext.mockRejectedValue(erreur);
  let arbre;
  await act(async () => {
    arbre = renderer.create(<LeagueDashboard navigation={{ navigate: jest.fn() }} />);
  });
  await act(async () => { await Promise.resolve(); });
  act(() => arbre.unmount());
  return mockEtats[mockEtats.length - 1];
};

test('REPRISE-25 🔴 la League refusée au profil le dit, sans bouton', async () => {
  const etat = await monterEnErreur(Object.assign(new Error('Forbidden'), { status: 403 }));
  expect(etat.title).toBe('Cette page n’est pas ouverte à ton profil.');
  expect(etat.description).toBe('Ton profil ne donne pas accès à la League.');
  expect(etat.onAction).toBeUndefined();
});

test('REPRISE-25 une vraie panne garde son message et son « Réessayer »', async () => {
  const etat = await monterEnErreur(Object.assign(new Error('Network Error'), { status: 503 }));
  expect(etat.description).toBe('Impossible de charger le dashboard League pour le moment.');
  expect(typeof etat.onAction).toBe('function');
});
