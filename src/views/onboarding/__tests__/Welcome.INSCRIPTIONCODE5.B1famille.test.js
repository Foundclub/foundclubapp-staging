/* eslint-disable max-len */
import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import Welcome from '../Welcome';

// INSCRIPTION-CODE-5 (20/11, point b du chef) — B1 (joueur avec club) par famille :
// « matchs et entraînements » ne se dit qu'en sport collectif (et en raquette, mots d'aujourd'hui) ;
// le judo et la natation disent les mots de leur famille. Doublures de Welcome.INSCRIPTIONCODE4.

const mockStartTour = jest.fn(() => true);
const mockMarkOnboardingComplete = jest.fn();
const mockInviter = jest.fn();
const mockRole = { current: 'player' };
const mockUser = { current: /** @type {any} */ ({}) };
const mockEnfants = { current: /** @type {any[]} */ ([]) };
const mockSubscriptionSummary = { current: /** @type {any} */ (null) };

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ key, /** @type {any} */ arg) => {
      const repli = typeof arg === 'string' ? arg : arg?.defaultValue;
      if (typeof repli !== 'string') return key;
      return repli.replace(/{{(\w+)}}/g, (_, k) => String(arg?.[k] ?? ''));
    },
  }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 0, left: 0, right: 0, top: 0,
  }),
}));
jest.mock('react-native-linear-gradient', () => 'LinearGradient');
jest.mock('@/theme/themeContext', () => {
  const leaf = {};
  const ramp = () => new Proxy({}, { get: () => leaf });
  const { colors } = jest.requireActual('@/theme/colors');
  return {
    __esModule: true,
    default: () => ({
      Alignments: ramp(),
      Colors: colors,
      Fonts: ramp(),
      Images: new Proxy({}, { get: () => 1 }),
      Spaces: new Proxy({}, { get: () => ramp() }),
    }),
  };
});
jest.mock('@/domains/auth/authUseCases', () => ({
  ...jest.requireActual('@/domains/auth/authUseCases'),
  getUserRoleKey: () => mockRole.current,
  markOnboardingComplete: (/** @type {string} */ id) => mockMarkOnboardingComplete(id),
}));
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({
    clubVerificationSummary: null,
    entitlementsSummary: null,
    getPostOnboardingHomeRoute: () => 'HomeTab',
    inviteTeamPlayers: (/** @type {any} */ x) => mockInviter(x),
    refetchUserData: jest.fn(),
    subscriptionAccessLevel: null,
    subscriptionSummary: mockSubscriptionSummary.current,
    userData: mockUser.current,
    userDataError: null,
    userDataLoading: false,
  }),
}));
jest.mock('@/services/declaredChild/declaredChildQueries', () => ({
  useGetMyDeclaredChildren: () => ({ data: mockEnfants.current }),
}));
jest.mock('@/store/appContext', () => ({
  storage: { getBoolean: () => false, set: jest.fn() },
  useAppContext: () => [{ auth: { user: { documentId: 'u-4' } } }, jest.fn()],
}));
jest.mock('@/context/TourContext', () => ({ useTour: () => ({ startTour: mockStartTour }) }));
jest.mock('@/components/atoms/button/Button', () => {
  const { Text: T, TouchableOpacity: P } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ onPress, title }) => <P accessibilityRole="button" onPress={onPress}><T>{title}</T></P>,
  };
});
jest.mock('@/components/templates/FormScreenContainer', () => {
  const { View: V } = jest.requireActual('react-native');
  return { __esModule: true, default: ({ children }) => <V>{children}</V> };
});

const ilYA = (/** @type {number} */ ans) => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - ans, 0, 1);
  return d.toISOString().slice(0, 10);
};
const LINA = {
  address: { city: 'Marseille' },
  birthdate: ilYA(30),
  documentId: 'u-4',
  firstname: 'Lina',
  lastname: 'Morel',
  position: 'Milieu',
  preferredSport: 'Football',
};
const DEMANDE = { club: { documentId: 'club-1', name: 'US Exemple Marseille' }, state: 'pending' };

const rendre = () => {
  const navigation = { navigate: jest.fn(), replace: jest.fn(), reset: jest.fn() };
  let arbre;
  act(() => { arbre = renderer.create(<Welcome navigation={/** @type {any} */ (navigation)} />); });
  return { navigation, tree: /** @type {any} */ (arbre) };
};
const textes = (tree) => tree.root.findAllByType(Text)
  .map((n) => n.props.children).flat().filter((v) => typeof v === 'string');
const presser = (tree, libelle) => {
  const cible = tree.root.findAllByType(TouchableOpacity)
    .find((n) => n.findAllByType(Text).some((x) => String(x.props.children) === libelle));
  if (!cible) throw new Error(`pas de bouton « ${libelle} »`);
  act(() => { cible.props.onPress(); });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockRole.current = 'player';
  mockUser.current = { ...LINA };
  mockEnfants.current = [];
  mockSubscriptionSummary.current = null;
});

describe('B1 — la ligne des rendez-vous dit les mots de la famille', () => {
  it.each([
    ['Football', 'Voir les matchs et les entraînements près de chez toi'],
    ['Tennis', 'Voir les matchs et les entraînements près de chez toi'],
    ['Judo', 'Voir les cours et les compétitions près de chez toi'],
    ['Natation', 'Voir les entraînements et les compétitions près de chez toi'],
  ])('%s : « %s »', (activite, ligne) => {
    mockUser.current = { ...LINA, clubMembershipRequests: [DEMANDE], preferredSport: activite };
    const lus = textes(rendre().tree);
    expect(lus).toContain(ligne);
    if (activite === 'Judo' || activite === 'Natation') {
      expect(lus).not.toContain('Voir les matchs et les entraînements près de chez toi');
    }
  });

  it('judo : la ligne mène toujours aux événements près de chez soi (rien ne change que les mots)', () => {
    mockUser.current = { ...LINA, clubMembershipRequests: [DEMANDE], preferredSport: 'Judo' };
    const { navigation, tree } = rendre();
    presser(tree, 'Voir les cours et les compétitions près de chez toi');
    expect(navigation.reset).toHaveBeenCalledWith({
      index: 1, routes: [{ name: 'HomeTab' }, { name: 'SearchEvents' }],
    });
  });
});
