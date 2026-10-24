// BH10 P10-23 : l utilisateur est en equipe B ; la colonne de droite (equipe B)
// doit montrer le blason de B, pas celui de l adversaire (= A).
import renderer, { act } from 'react-test-renderer';

jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));
jest.mock('i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').i18next
));

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: {
    delete: jest.fn(), get: jest.fn(), post: jest.fn(), put: jest.fn(),
  },
}));

/** @type {{ bottom: number, left: number, right: number, top: number }} */
const mockInsets = {
  bottom: 34, left: 0, right: 0, top: 59,
};
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

jest.mock('@/components/atoms/button/Button', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
  return function ButtonMock(/** @type {any} */ props) {
    return reactActuel.createElement(
      PressableRN,
      { disabled: props.disabled, onPress: props.onPress, testID: `bouton-${props.title}` },
      reactActuel.createElement(TexteRN, null, props.title),
    );
  };
});

jest.mock('@/components/templates/ScreenContainer', () => {
  // eslint-disable-next-line global-require
  const { View } = require('react-native');
  return { __esModule: true, default: (/** @type {any} */ props) => <View>{props.children}</View> };
});
jest.mock('@/components/atoms/SvgIcon/SvgIcon', () => ({ SvgIcon: () => null }));
jest.mock('@/components/atoms/headerBackButton/HeaderBackButton', () => () => null);
jest.mock('@/navigation/useBottomDockLayout', () => ({
  __esModule: true, default: () => ({ sceneBottomInset: 0 }), useBottomDockLayout: () => ({ sceneBottomInset: 0 }),
}));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: jest.fn(), navigate: jest.fn(), setOptions: jest.fn() }),
  useRoute: () => ({ params: { matchId: 'match-1', myTeamId: 'team-b' } }),
}));
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true, default: () => ({ userData: { documentId: 'u-b' } }),
}));
const mockGetMatch = jest.fn();
jest.mock('@/services/league/leagueMatchService', () => ({
  getMatch: (...args) => mockGetMatch(...args),
}));
jest.mock('@/components/atoms/teamShield/TeamShield', () => {
  const reactActuel = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  return (/** @type {any} */ props) => reactActuel.createElement(View, { testID: `blason-${props.imageUrl}` });
});

const PastMatchDetails = require('../PastMatchDetails').default;

test('P10-23 : en equipe B, le blason de B est a droite, celui de A a gauche', async () => {
  mockGetMatch.mockResolvedValue({
    documentId: 'match-1',
    score_a: 1,
    score_b: 2,
    status: 'completed',
    team_a: { crest: { url: '/a.png' }, documentId: 'team-a', name: 'Equipe A' },
    team_b: { crest: { url: '/b.png' }, documentId: 'team-b', name: 'Equipe B' },
  });
  let tree;
  await act(async () => { tree = renderer.create(<PastMatchDetails />); });
  await act(async () => {});
  const images = tree.root.findAll((/** @type {any} */ node) => node.props?.source?.uri)
    .map((/** @type {any} */ node) => node.props.source.uri);
  expect(images.some((uri) => String(uri).includes('/a.png'))).toBe(false);
  expect(images.some((uri) => String(uri).includes('/b.png'))).toBe(true);
});
