/* eslint-disable max-len -- phrases et doublures recopiées telles quelles */
import { QueryClientProvider } from '@tanstack/react-query';
import { Alert, Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { retenirLInscriptionAuTournoi } from '@/domains/tournoi/inscriptionEnCours';

import UserRole from '../UserRole';
import { createFoundClubQueryClient } from '@/app/queryClient';

/**
 * T-PAGES-6b (18/11/2026, point 5 de T-PAGES-6) — L'ÉCRAN DU RÔLE QUAND ON VIENT D'UN TOURNOI. En
 * tête, le rappel du tournoi, puis la phrase de Clément : le rôle choisi ne change rien pour le
 * tournoi. Rien n'est coché d'avance (décision 4d B, déjà tenue : FINITIONS5). Sans tournoi retenu,
 * l'écran est celui de tout le monde.
 * ROUGE avant le lot : ni rappel ni phrase.
 */

const mockRangement = new Map();
jest.mock('@/platform/storage', () => ({
  getItem: (/** @type {string} */ cle) => mockRangement.get(cle),
  removeItem: (/** @type {string} */ cle) => { mockRangement.delete(cle); },
  setItem: (/** @type {string} */ cle, /** @type {string} */ valeur) => {
    mockRangement.set(cle, valeur);
  },
}));

const mockNavigate = jest.fn();

jest.mock('@/store/appContext', () => ({
  storage: {
    delete: jest.fn(),
    getString: jest.fn(),
    set: jest.fn(),
  },
}));

/**
 * Lit une cle dans la VRAIE fr.js.
 * @param {string} cle
 * @returns {any}
 */
const mockLireFr = (cle) => String(cle).split('.').reduce(
  (/** @type {any} */ noeud, /** @type {string} */ segment) => (
    noeud === null || noeud === undefined ? undefined : noeud[segment]
  ),
  jest.requireActual('@/theme/strings/translations/fr').default,
);

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => {
      const valeur = mockLireFr(cle);
      if (typeof valeur === 'string') return valeur;
      return typeof repli === 'string' ? repli : cle;
    },
  }),
}));

// `displayError.js` traduit par i18next directement : branche sur la meme fr.js.
jest.mock('i18next', () => ({
  exists: (/** @type {string} */ cle) => typeof mockLireFr(cle) === 'string',
  t: (/** @type {string} */ cle) => {
    const valeur = mockLireFr(cle);
    return typeof valeur === 'string' ? valeur : cle;
  },
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

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 0, left: 0, right: 0, top: 0,
  }),
}));

jest.mock('react-native-gesture-handler', () => ({
  ScrollView: jest.requireActual('react-native').ScrollView,
}));

jest.mock('@/components/templates/FormScreenContainer', () => {
  const { View } = jest.requireActual('react-native');
  return { __esModule: true, default: (/** @type {any} */ { children }) => <View>{children}</View> };
});

jest.mock('@/components/molecules/withDataWrapper/WithDataWrapper', () => ({
  __esModule: true,
  default: (/** @type {any} */ { children }) => children,
}));

jest.mock('@/views/onboarding/components/OnboardingRadioRow', () => {
  const { Text: TexteRN, TouchableOpacity: Touchable } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { checked, label, onPress }) => (
      <Touchable accessibilityRole="radio" accessibilityState={{ checked }} onPress={onPress}>
        <TexteRN>{label}</TexteRN>
      </Touchable>
    ),
  };
});

jest.mock('@/components/atoms/button/Button', () => {
  const { Text: TexteRN, TouchableOpacity: Touchable } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ {
      disabled, isLoading, onPress, title,
    }) => (
      <Touchable accessibilityLabel={title} disabled={Boolean(disabled || isLoading)} onPress={onPress}>
        <TexteRN>{title}</TexteRN>
      </Touchable>
    ),
  };
});

// Les roles tels que `/users-permissions/roles` les rend : le role provisoire
// d'un compte neuf (« Authenticated ») y figure, a cote des trois choix.
const ROLES = [
  { documentId: 'role-authenticated', name: 'Authenticated', type: 'authenticated' },
  { documentId: 'role-joueur', name: 'Joueur', type: 'player' },
  { documentId: 'role-coach', name: 'Entraineur', type: 'coach' },
  { documentId: 'role-dirigeant', name: 'Dirigeant', type: 'president' },
];

jest.mock('@/services/auth/authQueries', () => ({
  useGetRoles: () => ({
    data: ROLES, error: null, isLoading: false, refetch: jest.fn(),
  }),
}));

jest.mock('@/services/auth/authService', () => ({
  updateMe: jest.fn(),
}));

// COLL-ACCUEIL (01/10) : sur le site, un compte Ville seule saute le choix du statut. Ici, un
// compte neuf qui ne gere rien et n a rien demande : il choisit.
/** @type {any[]} */
let mockVilles = [];
/** @type {any[]} */
let mockDemandesGestion = [];
const mockReset = jest.fn();
jest.mock('@/services/collectivite/collectiviteQueries', () => ({
  useMyCollectivites: () => ({ data: mockVilles }),
  useMyManagerRequests: () => ({ data: mockDemandesGestion }),
}));

/** @type {any} */
let mockUserData;

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({
    refetchUserData: jest.fn(async () => {}),
    USER_ROLES: jest.requireActual('@/domains/auth/authUseCases').USER_ROLES,
    userData: mockUserData,
    userDataError: null,
    userDataLoading: false,
  }),
}));

/** Le gestionnaire GLOBAL des mutations, branche comme dans `App.js`. */
const alerteGlobale = jest.fn();

/** @type {any[]} */
const montes = [];

/**
 * Monte l'ecran avec le VRAI client react-query de l'app (et son MutationCache).
 * @returns {Promise<any>}
 */
const monter = async () => {
  const client = createFoundClubQueryClient({ onMutationError: alerteGlobale });
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <QueryClientProvider client={client}>
        <UserRole navigation={/** @type {any} */ ({ navigate: mockNavigate, reset: mockReset })} />
      </QueryClientProvider>,
    );
  });
  montes.push(arbre);
  return arbre;
};

const bouton = (arbre, libelle) => arbre.root.findAll(
  (/** @type {any} */ n) => n.type === TouchableOpacity && n.props.accessibilityLabel === libelle,
)[0];

const TOURNOI = {
  date: '2026-12-19T18:00:00.000Z', documentId: 'evt-3442', name: 'Tournoi FoundClub x AR Soccer',
};
const PHRASE = 'Le rôle que tu choisis ne change rien pour le tournoi : il sert seulement à savoir '
  + 'quel est ton rôle dans ta vie sportive de tous les jours.';

const textes = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text)
  .map((/** @type {any} */ n) => [].concat(n.props.children).filter((c) => typeof c === 'string').join(''))
  .filter(Boolean);
const cochees = (/** @type {any} */ arbre) => arbre.root.findAll(
  (/** @type {any} */ n) => n.type === TouchableOpacity && n.props.accessibilityRole === 'radio'
    && n.props.accessibilityState?.checked,
);

beforeEach(() => {
  jest.clearAllMocks();
  mockRangement.clear();
  mockVilles = [];
  mockDemandesGestion = [];
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockUserData = { documentId: 'u-139', role: { documentId: 'role-authenticated', type: 'authenticated' } };
});

afterEach(async () => {
  await act(async () => { montes.splice(0).forEach((arbre) => arbre.unmount()); });
});

test('🔴 venu d un tournoi : le rappel du tournoi, la phrase de Clément, rien de coché', async () => {
  retenirLInscriptionAuTournoi({ event: TOURNOI });
  const arbre = await monter();
  const vus = textes(arbre);
  expect(vus).toContain('Tournoi FoundClub x AR Soccer · Sam. 19 déc.');
  expect(vus).toContain(PHRASE);
  expect(cochees(arbre)).toHaveLength(0);
  expect(bouton(arbre, 'Continuer').props.disabled).toBe(true);
});

test('🔴 venu d un lien d équipe : « Tu rejoins <équipe> · <tournoi> »', async () => {
  retenirLInscriptionAuTournoi({ equipe: 'Les Kaïras', event: TOURNOI });
  const vus = textes(await monter());
  expect(vus).toContain('Tu rejoins Les Kaïras · Tournoi FoundClub x AR Soccer');
  expect(vus).toContain(PHRASE);
});

test('caractérisant : sans tournoi retenu, l écran du rôle est inchangé', async () => {
  const arbre = await monter();
  expect(textes(arbre)).not.toContain(PHRASE);
  expect(arbre.root.findAll((/** @type {any} */ n) => n.props.testID === 'bandeau-tournoi-en-cours'))
    .toHaveLength(0);
  expect(cochees(arbre)).toHaveLength(0);
});
