import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import UserTrainedTeams from '../UserTrainedTeams';

// FILET E6 — ecrit AVEC l'ecran (lot D16), pas apres.
//
// « Quelles equipes entraines-tu ? » est la derniere marche du parcours
// entraineur, et c'est le seul endroit de l'inscription qui envoie PLUSIEURS
// demandes d'un coup. Les tests visent des COMPORTEMENTS, pas des libelles :
//   1. les equipes du club sont listees,
//   2. le bouton d'envoi est mort tant que rien n'est coche, et il porte le
//      compte de ce qui l'est,
//   3. un envoi = une demande PAR equipe cochee, via la plomberie existante,
//   4. une equipe deja demandee ne se coche pas (decision n5 : on lit le
//      profil, on ne lit JAMAIS le code d'erreur de la policy),
//   5. « Passer » sort par la machine a etapes, jamais en dur.

const mockGetNextOnboardingRoute = jest.fn();
const mockCreateTeamMembershipRequest = jest.fn();
const mockUseGetTeams = jest.fn();
const mockUserData = {
  current: /** @type {any} */ ({
    club: { documentId: 'club-1' },
    documentId: 'coach-1',
    teamMembershipRequests: [],
  }),
};

jest.mock('@tanstack/react-query', () => ({
  // Doublure minimale : `mutate` appelle vraiment `mutationFn` puis `onSuccess`.
  // Sans ca, le test ne prouverait que le rendu, jamais l'envoi.
  useMutation: (/** @type {any} */ options) => ({
    isPending: false,
    mutate: (/** @type {any} */ variables) => Promise.resolve(options.mutationFn(variables))
      .then((data) => options.onSuccess?.(data))
      .catch((error) => options.onError?.(error)),
  }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ key, /** @type {any} */ fallback) => (
      typeof fallback === 'string' ? fallback : key
    ),
  }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 34, left: 0, right: 0, top: 59,
  }),
}));

jest.mock('@/theme/themeContext', () => {
  const styleLeaf = {};
  const makeRamp = () => new Proxy({}, { get: () => styleLeaf });
  return {
    __esModule: true,
    default: () => ({
      Alignments: makeRamp(),
      Colors: new Proxy({}, { get: (_target, key) => `couleur-${String(key)}` }),
      Fonts: makeRamp(),
      Spaces: new Proxy({}, { get: () => makeRamp() }),
    }),
  };
});

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({
    getNextOnboardingRoute: mockGetNextOnboardingRoute,
    getPostOnboardingHomeRoute: () => 'HomeTab',
    refetchUserData: jest.fn(),
    userData: mockUserData.current,
    userDataError: null,
    userDataLoading: false,
  }),
}));

jest.mock('@/services/team/teamQueries', () => ({
  useGetTeams: (/** @type {any} */ params, /** @type {any} */ options) => (
    mockUseGetTeams(params, options)
  ),
}));

jest.mock('@/services/teamMembershipRequest/teamMembershipRequestService', () => ({
  createTeamMembershipRequest: (/** @type {any} */ payload) => (
    mockCreateTeamMembershipRequest(payload)
  ),
}));

// Doublures d'affichage : un pressable qui PORTE son titre. Les tests peuvent
// alors viser le texte visible plutot que la forme de l'arbre.
jest.mock('@/components/atoms/button/Button', () => {
  const { Text: RNText, TouchableOpacity: RNTouchable } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({
      disabled, onPress, title,
    }) => (
      <RNTouchable accessibilityRole="button" disabled={disabled} onPress={onPress}>
        <RNText>{title}</RNText>
      </RNTouchable>
    ),
  };
});

jest.mock('@/components/templates/FormScreenContainer', () => {
  const { View: RNView } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ children }) => <RNView>{children}</RNView>,
  };
});

jest.mock('@/views/onboarding/components/OnboardingStickyFooter', () => {
  const { View: RNView } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ children }) => <RNView>{children}</RNView>,
  };
});

jest.mock('@/views/onboarding/components/OnboardingStateView', () => {
  const { Text: RNText } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ title }) => <RNText>{title}</RNText>,
  };
});

jest.mock('@/views/onboarding/components/OnboardingSkipLink', () => {
  const { Text: RNText, TouchableOpacity: RNTouchable } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ onPress }) => (
      <RNTouchable accessibilityRole="button" onPress={onPress}>
        <RNText>Passer</RNText>
      </RNTouchable>
    ),
  };
});

const EQUIPES = [
  { category: { name: 'U15' }, documentId: 'team-1', name: 'U15 Masculine' },
  { documentId: 'team-2', name: 'Seniors A' },
  { documentId: 'team-3', name: 'Seniors B' },
];

const teamsQuery = (/** @type {any[]} */ teams) => ({
  data: { pages: [{ data: teams }] },
  error: null,
  isLoading: false,
  refetch: jest.fn(),
});

const rendre = () => {
  const navigation = { navigate: jest.fn() };
  let arbre;
  act(() => {
    arbre = renderer.create(
      <UserTrainedTeams
        navigation={/** @type {any} */ (navigation)}
        route={/** @type {any} */ ({})}
      />,
    );
  });
  const tree = /** @type {any} */ (arbre);
  return { navigation, tree };
};

// Tous les textes rendus, a plat — le test lit ce que l'utilisateur lit.
const textes = (/** @type {any} */ tree) => tree.root
  .findAllByType(Text)
  .map((/** @type {any} */ node) => node.props.children)
  .flat()
  .filter((/** @type {any} */ value) => typeof value === 'string');

// Le pressable dont le libelle commence par `debut`.
const pressableIntitule = (/** @type {any} */ tree, /** @type {string} */ debut) => tree.root
  .findAllByType(TouchableOpacity)
  .find((/** @type {any} */ node) => {
    const contenu = node.findAllByType(Text)
      .map((/** @type {any} */ t) => t.props.children)
      .flat();
    return contenu.some((/** @type {any} */ v) => typeof v === 'string' && v.startsWith(debut));
  });

// Les rangees d'equipe : les pressables portant le role `checkbox`.
const rangees = (/** @type {any} */ tree) => tree.root
  .findAllByType(TouchableOpacity)
  .filter((/** @type {any} */ node) => node.props.accessibilityRole === 'checkbox');

beforeEach(() => {
  jest.clearAllMocks();
  mockUserData.current = {
    club: { documentId: 'club-1' },
    documentId: 'coach-1',
    teamMembershipRequests: [],
  };
  mockUseGetTeams.mockReturnValue(teamsQuery(EQUIPES));
  mockCreateTeamMembershipRequest.mockResolvedValue({ documentId: 'req' });
  mockGetNextOnboardingRoute.mockReturnValue(undefined);
});

describe('UserTrainedTeams — « Quelles equipes entraines-tu ? » (D16)', () => {
  it('liste les equipes du club de l entraineur', () => {
    const { tree } = rendre();

    expect(mockUseGetTeams).toHaveBeenCalledWith(
      expect.objectContaining({ clubId: 'club-1' }),
      expect.objectContaining({ enabled: true }),
    );
    expect(textes(tree))
      .toEqual(expect.arrayContaining(['U15 Masculine', 'Seniors A', 'Seniors B']));
    expect(rangees(tree)).toHaveLength(3);
  });

  // Le club n'est encore qu'une DEMANDE au moment de l'inscription : l'entraineur
  // vient de la poser, elle est `pending`. Si l'ecran ne lisait que `club`, il
  // n'aurait aucune equipe a proposer.
  it('retrouve le club meme quand l adhesion n est encore qu une demande en attente', () => {
    mockUserData.current = {
      clubMembershipRequests: [{ club: { documentId: 'club-9' }, state: 'pending' }],
      documentId: 'coach-1',
      teamMembershipRequests: [],
    };

    rendre();

    expect(mockUseGetTeams).toHaveBeenCalledWith(
      expect.objectContaining({ clubId: 'club-9' }),
      expect.anything(),
    );
  });

  it('le bouton d envoi est mort tant qu aucune equipe n est cochee', () => {
    const { tree } = rendre();

    expect(pressableIntitule(tree, 'Envoyer ma demande').props.disabled).toBe(true);
    expect(textes(tree)).toEqual(expect.arrayContaining(['Envoyer ma demande (0)']));
  });

  it('le compte du bouton suit les cases cochees', () => {
    const { tree } = rendre();

    act(() => { rangees(tree)[0].props.onPress(); });
    expect(textes(tree)).toEqual(expect.arrayContaining(['Envoyer ma demande (1)']));

    act(() => { rangees(tree)[2].props.onPress(); });
    expect(textes(tree)).toEqual(expect.arrayContaining(['Envoyer ma demande (2)']));
    expect(pressableIntitule(tree, 'Envoyer ma demande').props.disabled).toBe(false);

    // Recocher retire : sinon on enverrait une demande que l'entraineur a annulee.
    act(() => { rangees(tree)[0].props.onPress(); });
    expect(textes(tree)).toEqual(expect.arrayContaining(['Envoyer ma demande (1)']));
  });

  it('un seul envoi pose UNE demande par equipe cochee, sur la plomberie existante', async () => {
    const { navigation, tree } = rendre();

    act(() => { rangees(tree)[0].props.onPress(); });
    act(() => { rangees(tree)[1].props.onPress(); });

    await act(async () => {
      await pressableIntitule(tree, 'Envoyer ma demande').props.onPress();
    });

    expect(mockCreateTeamMembershipRequest).toHaveBeenCalledTimes(2);
    expect(mockCreateTeamMembershipRequest)
      .toHaveBeenCalledWith({ team: 'team-1', user: 'coach-1' });
    expect(mockCreateTeamMembershipRequest)
      .toHaveBeenCalledWith({ team: 'team-2', user: 'coach-1' });
    expect(navigation.navigate).toHaveBeenCalledWith('HomeTab');
  });

  // DECISION 5. La policy `had-pending-membership-request` refuse la seconde
  // demande, mais son `catch` englobant ecrase la cause : l'app ne peut PAS
  // distinguer « deja demande » d'une panne. On regarde donc le profil avant
  // d'afficher, jamais l'erreur apres coup.
  it('une equipe deja demandee est signalee et ne peut pas etre cochee', () => {
    mockUserData.current = {
      club: { documentId: 'club-1' },
      documentId: 'coach-1',
      teamMembershipRequests: [{ state: 'pending', team: { documentId: 'team-2' } }],
    };

    const { tree } = rendre();
    const rangeeDejaDemandee = rangees(tree)[1];

    expect(rangeeDejaDemandee.props.disabled).toBe(true);
    expect(textes(tree)).toEqual(expect.arrayContaining(['Demande déjà envoyée']));

    // Meme forcee, elle n'entre pas dans la selection.
    act(() => { rangeeDejaDemandee.props.onPress(); });
    expect(textes(tree)).toEqual(expect.arrayContaining(['Envoyer ma demande (0)']));
  });

  it('une demande refusee ou traitee ne bloque pas une nouvelle demande', () => {
    mockUserData.current = {
      club: { documentId: 'club-1' },
      documentId: 'coach-1',
      teamMembershipRequests: [{ state: 'refused', team: { documentId: 'team-2' } }],
    };

    const { tree } = rendre();

    expect(rangees(tree)[1].props.disabled).toBe(false);
  });

  it('« Passer » sort par la machine a etapes, pas par une route ecrite en dur', () => {
    mockGetNextOnboardingRoute.mockReturnValue('UneEtapeSuivante');
    const { navigation, tree } = rendre();

    act(() => { pressableIntitule(tree, 'Passer').props.onPress(); });

    expect(mockGetNextOnboardingRoute).toHaveBeenCalledWith('UserTrainedTeams');
    expect(navigation.navigate).toHaveBeenCalledWith('UneEtapeSuivante');
  });

  it('un club sans aucune equipe n affiche pas de liste vide muette', () => {
    mockUseGetTeams.mockReturnValue(teamsQuery([]));
    const { tree } = rendre();

    expect(rangees(tree)).toHaveLength(0);
    expect(textes(tree).some((/** @type {string} */ v) => v.includes('Aucune équipe'))).toBe(true);
  });
});
