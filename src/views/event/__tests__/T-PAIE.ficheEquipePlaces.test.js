/* eslint-disable max-len -- les témoins se lisent en entier. */
import renderer, { act } from 'react-test-renderer';

import TournamentTeamDetails from '../TournamentTeamDetails';

// T-PAIE (15/11) — la fiche d'une équipe d'un tournoi payant : « Place payée » / « Place à payer » par membre,
// « Copier le lien de paiement » pour le capitaine, « Payer ma place » pour le joueur connecté. Le bloc
// `payment` vient du serveur (contrôleur tournament-team) ; sans lui (tournoi gratuit), rien ne change.

/** @type {any} */
let mockTeam = null;
/** @type {any} */
let mockAuth = {};
const mockCopier = jest.fn(async () => true);
const mockOpenUrl = jest.fn(async () => true);
// T-PAGES-2 (R8) : « Payer ma place » passe par openUrlHere (même onglet sur le site) ; même espion.
const mockOpenUrlInPlace = (...args) => mockOpenUrl(...args);

jest.mock('@tanstack/react-query', () => ({
  useMutation: () => ({ isPending: false, mutate: jest.fn() }),
  useQuery: () => ({ data: [], isFetching: false }),
  useQueryClient: () => ({ invalidateQueries: jest.fn(() => Promise.resolve()) }),
}));
jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));
jest.mock('@/theme/themeContext', () => {
  const generateColors = jest.requireActual('@/theme/colors').default;
  const generateFonts = jest.requireActual('@/theme/fonts').default;
  const Colors = generateColors();
  return {
    __esModule: true,
    default: () => ({
      Alignments: jest.requireActual('@/theme/alignements').default,
      ApplicationStyle: jest.requireActual('@/theme/applicationStyle').default(Colors),
      Colors,
      Fonts: generateFonts(Colors),
      Images: new Proxy({}, { get: () => 1 }),
      Spaces: jest.requireActual('@/theme/spaces').default,
    }),
  };
});
jest.mock('@/domains/auth/useAuth', () => ({ __esModule: true, default: () => mockAuth }));
jest.mock('@/components/atoms/button/Button', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function ButtonDouble(/** @type {any} */ props) {
    return react.createElement(rn.TouchableOpacity, { accessibilityLabel: props.title, disabled: props.disabled, onPress: props.onPress }, react.createElement(rn.Text, null, props.title || ''));
  };
});
jest.mock('@/components/molecules/profileAvatar/ProfileAvatar', () => () => null);
jest.mock('@/components/organisms/joinEventModal/JoinEventModal', () => () => null);
jest.mock('@/components/molecules/withDataWrapper/WithDataWrapper', () => (/** @type {any} */ { children }) => children);
jest.mock('@/components/templates/ScreenContainer', () => (/** @type {any} */ { children }) => children);
jest.mock('@/services/tournamentTeam/tournamentTeamQueries', () => ({
  useGetTournamentTeam: () => ({
    data: mockTeam, error: null, isLoading: false, refetch: jest.fn(),
  }),
}));
jest.mock('@/services/tournamentTeam/tournamentTeamService', () => ({}));
jest.mock('@/services/user/userService', () => ({ searchScopedUsers: jest.fn(), searchUsers: jest.fn() }));
jest.mock('@/platform/share', () => ({ __esModule: true, copier: (...args) => mockCopier(...args), default: { copier: (...args) => mockCopier(...args) } }));
jest.mock('@/platform/links', () => ({ __esModule: true, default: { openUrl: (...args) => mockOpenUrl(...args), openUrlHere: (...args) => mockOpenUrlInPlace(...args) } }));

const LIEN_2 = 'https://foundclub.app/licenses/pay/jeton-joueur-2';
const LIEN_3 = 'https://foundclub.app/licenses/pay/jeton-joueur-3';

/**
 * Une équipe de tournoi payant, vue par `lecteur`.
 * @param {'capitaine' | 'joueur' | 'gratuit'} lecteur - Qui lit.
 * @returns {any} L'équipe.
 */
const equipe = (lecteur) => ({
  adminUsers: [{ documentId: 'u-cap' }],
  archivedAt: null,
  captainUser: { documentId: 'u-cap', firstname: 'Capi' },
  club: { documentId: 'club-1', name: 'FoundClub x AR Soccer' },
  documentId: 'tt-1',
  event: {
    club: { documentId: 'club-1', name: 'FoundClub x AR Soccer' }, documentId: 'evt-1', isActive: true, sessionStatus: 'open', tournamentConfig: lecteur === 'gratuit' ? {} : { entryFeeCents: 2000 },
  },
  isOpenToJoinRequests: false,
  members: [
    {
      documentId: 'mb-1', origin: 'external_addition', responseStatus: 'present', role: 'captain', user: { documentId: 'u-cap', firstname: 'Capi' },
    },
    {
      documentId: 'mb-2', origin: 'invited', responseStatus: 'pending', role: 'member', user: { documentId: 'u-2', firstname: 'Deux' },
    },
    {
      documentId: 'mb-3', origin: 'invited', responseStatus: 'pending', role: 'member', user: { documentId: 'u-3', firstname: 'Trois' },
    },
  ],
  name: 'Les Rapides',
  ...(lecteur === 'gratuit' ? {} : {
    payment: {
      currency: 'EUR',
      entryFeeCents: 2000,
      members: lecteur === 'capitaine'
        ? [
          {
            isSelf: true, memberDocumentId: 'mb-1', paymentUrl: null, status: 'paid',
          },
          {
            isSelf: false, memberDocumentId: 'mb-2', paymentUrl: LIEN_2, status: 'due',
          },
          {
            isSelf: false, memberDocumentId: 'mb-3', paymentUrl: LIEN_3, status: 'due',
          },
        ]
        : [
          {
            isSelf: false, memberDocumentId: 'mb-1', paymentUrl: null, status: 'paid',
          },
          {
            isSelf: true, memberDocumentId: 'mb-2', paymentUrl: LIEN_2, status: 'due',
          },
          {
            isSelf: false, memberDocumentId: 'mb-3', paymentUrl: null, status: 'due',
          },
        ],
      paidCount: 1,
      paidMembersToValidate: 5,
    },
  }),
  sourceTeam: null,
  sourceType: 'custom_team',
  status: 'pending',
});

/** @type {any[]} */
const montes = [];
const monter = async (/** @type {'capitaine' | 'joueur' | 'gratuit'} */ lecteur) => {
  mockAuth = { accountRoleKey: 'player', userData: { documentId: lecteur === 'joueur' ? 'u-2' : 'u-cap' } };
  mockTeam = equipe(lecteur);
  /** @type {any} */
  let arbre = null;
  await act(async () => {
    arbre = renderer.create(
      <TournamentTeamDetails navigation={{ goBack: jest.fn(), navigate: jest.fn() }} route={{ params: { eventId: 'evt-1', teamId: 'tt-1' } }} />,
    );
  });
  montes.push(arbre);
  return arbre;
};
const texte = (/** @type {any} */ arbre) => JSON.stringify(arbre.toJSON());
const boutons = (/** @type {any} */ arbre, /** @type {string} */ titre) => arbre.root.findAll(
  (/** @type {any} */ n) => n.props?.accessibilityLabel === titre && typeof n.props?.onPress === 'function' && n.type !== 'View',
).filter((/** @type {any} */ n, /** @type {number} */ i, /** @type {any[]} */ all) => all.findIndex((m) => m.props.onPress === n.props.onPress) === i);

afterEach(async () => {
  const arbres = montes.splice(0);
  await act(async () => { arbres.forEach((arbre) => arbre?.unmount?.()); });
  mockCopier.mockClear();
  mockOpenUrl.mockClear();
});

describe('T-PAIE — les places sur la fiche d équipe', () => {
  test('🔴 capitaine : « payé » / « à payer » par membre, le compteur, et un « Copier le lien de paiement » par place à payer', async () => {
    const arbre = await monter('capitaine');
    const contenu = texte(arbre);
    // ATTENDUS CHANGÉS PAR IMPL-2-EQUIPE (18/11, planches 4a et 9a) : la pastille de la ligne dit
    // « Payé » / « À payer », et la carte « 1 place payée sur 5 » (au lieu de « 1 / 5 »).
    expect(contenu).toContain('Payé');
    expect(contenu).toContain('À payer');
    expect(contenu).toContain('1 place payée sur 5');
    // ATTENDU CHANGÉ PAR PAGE-EQUIPE (19/11, maquette 3a, Adel décision 2 « une ligne par joueur ») :
    // « Copier le lien de paiement » est rangé dans le menu à trois points de chaque joueur à payer.
    expect(boutons(arbre, 'Copier le lien de paiement')).toHaveLength(0);
    /** @type {any[]} */
    const copier = [];
    const menus = () => arbre.root.findAll((/** @type {any} */ n) => String(n.props?.accessibilityLabel || '').startsWith('Actions pour ') && typeof n.props?.onPress === 'function' && n.type !== 'View');
    const noms = [...new Set(menus().map((/** @type {any} */ m) => m.props.accessibilityLabel))];
    noms.forEach((/** @type {string} */ nom) => {
      act(() => { menus().find((/** @type {any} */ m) => m.props.accessibilityLabel === nom).props.onPress(); });
      copier.push(...boutons(arbre, 'Copier le lien de paiement').map((/** @type {any} */ b) => b.props.onPress));
    });
    expect(copier).toHaveLength(2);
    await act(async () => { await copier[0](); });
    expect(mockCopier).toHaveBeenCalledWith(LIEN_2);
    expect(boutons(arbre, 'Payer ma place (20 €)')).toHaveLength(0);
  }, 30000);

  test('🔴 joueur connecté : « Payer ma place » ouvre SON lien, aucun lien des autres', async () => {
    const arbre = await monter('joueur');
    expect(boutons(arbre, 'Copier le lien de paiement')).toHaveLength(0);
    // IMPL-2-EQUIPE (9a) : le bouton porte le prix.
    const payer = boutons(arbre, 'Payer ma place (20 €)');
    expect(payer).toHaveLength(1);
    await act(async () => { await payer[0].props.onPress(); });
    expect(mockOpenUrl).toHaveBeenCalledWith(LIEN_2);
  });

  test('tournoi gratuit (pas de bloc `payment`) : ni statut de place, ni bouton de paiement', async () => {
    const arbre = await monter('gratuit');
    const contenu = texte(arbre);
    expect(contenu).not.toContain('Place payée');
    expect(contenu).not.toContain('Place à payer');
    expect(contenu).not.toContain('À payer');
    expect(boutons(arbre, 'Copier le lien de paiement')).toHaveLength(0);
    expect(boutons(arbre, 'Payer ma place')).toHaveLength(0);
  });
});
