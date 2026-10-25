import renderer, { act } from 'react-test-renderer';

// C07 / P10-22 — tableau de bord de la ligue, deux defauts :
// 1. l equipe active retenue (`activeSquadId`) restait celle d avant quand
//    elle avait disparu du contexte (equipe quittee) : les actions en attente
//    etaient lues pour une equipe qui n est plus la sienne ;
// 2. les reponses (historique, classement) n etaient pas protegees contre
//    l ordre d arrivee : passer de A a B, puis recevoir A en retard, affichait
//    l historique de A sous l equipe B.
// Banc de rendu : le VRAI ecran, ses enfants lourds en doublures.

jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));
jest.mock('i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').i18next
));

/** @type {any} */
let mockLastFocusEffect = null;
jest.mock('@react-navigation/native', () => {
  const { useEffect: mockUseEffect } = jest.requireActual('react');
  return {
    useFocusEffect: (/** @type {any} */ effet) => {
      mockLastFocusEffect = effet;
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
jest.mock('@/views/league/components/LeagueStateView', () => () => null);

const LeagueDashboard = require('../LeagueDashboard').default;

/**
 * Une promesse et sa resolution, pour choisir l ordre des reponses.
 * @returns {{ p: Promise<any>, r: (value: any) => void }}
 */
const deferred = () => {
  /** @type {any} */
  let r;
  const p = new Promise((res) => { r = res; });
  return { p, r };
};

const squadA = { division: 1, documentId: 'A', name: 'Squad A' };
const squadB = { division: 1, documentId: 'B', name: 'Squad B' };

/**
 * Le bouton d une squad dans le selecteur.
 * @param {any} tree
 * @param {string} nom
 * @returns {any}
 */
const boutonSquad = (tree, nom) => tree.root.findAll((/** @type {any} */ n) => (
  typeof n.props?.onPress === 'function'
  && n.findAll((/** @type {any} */ e) => e.props?.text === nom).length > 0
)).pop();

beforeEach(() => {
  mockLastFocusEffect = null;
  mockPendingTeamIds.length = 0;
  mockHistories.length = 0;
  mockGetMatchHistory.mockReset();
  mockLoadContext.mockReset();
});

test('P10-22 : une reponse en retard de A n ecrase pas l historique de B', async () => {
  mockLoadContext.mockResolvedValue({ defaultSquadId: 'A', squads: [squadA, squadB] });
  const histA = deferred();
  mockGetMatchHistory.mockImplementation((/** @type {string} */ id) => (
    id === 'A' ? histA.p : Promise.resolve([{ documentId: 'match-de-B' }])
  ));
  /** @type {any} */
  let tree;
  await act(async () => { tree = renderer.create(<LeagueDashboard />); });
  await act(async () => { await boutonSquad(tree, 'Squad B').props.onPress(); });
  await act(async () => { histA.r([{ documentId: 'match-de-A' }]); });
  expect(mockHistories[mockHistories.length - 1]).toEqual([{ documentId: 'match-de-B' }]);
});

test('P10-22 : une equipe active disparue du contexte n est plus retenue', async () => {
  mockGetMatchHistory.mockResolvedValue([]);
  mockLoadContext.mockResolvedValueOnce({ defaultSquadId: 'A', squads: [squadA, squadB] });
  /** @type {any} */
  let tree;
  await act(async () => { tree = renderer.create(<LeagueDashboard />); });
  // Le lecteur quitte A ; le prochain chargement ne connait plus que B.
  mockLoadContext.mockResolvedValue({ defaultSquadId: 'B', squads: [squadB] });
  // Retour sur l ecran plus de 2 min apres : le tableau se recharge.
  const realNow = Date.now;
  Date.now = () => realNow() + 10 * 60 * 1000;
  try {
    await act(async () => { mockLastFocusEffect(); });
  } finally {
    Date.now = realNow;
  }
  expect(tree.root).toBeTruthy();
  expect(mockPendingTeamIds[mockPendingTeamIds.length - 1]).toBe('B');
});
