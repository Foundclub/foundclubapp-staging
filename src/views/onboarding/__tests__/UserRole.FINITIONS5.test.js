import { QueryClientProvider } from '@tanstack/react-query';
import { Alert, Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { createFoundClubQueryClient } from '@/app/queryClient';
import { updateMe } from '@/services/auth/authService';

import UserRole from '../UserRole';

// FINITIONS5 (tournee 7, defaut 8) — « QUEL EST TON STATUT ? », L'ECRAN QUI
// N'AVAIT AUCUN TEMOIN (E6 : le premier test ci-dessous caracterise ce qui
// marchait deja, AVANT toute modification).
//
// 🔍 CE QUE LA RECETTE A VU (compte neuf 139, captures T7_ONB_02 et _03) :
// « Continuer » sans rien cocher ⇒ `PUT /firebase-auth/update` 403 ⇒ une alerte
// « Failed to update user data: Requested role is not allowed » (anglais
// technique), PUIS une seconde alerte « Acces refuse. ».
//
// 🧨 LES DEUX CAUSES, lues dans l'ecran :
//   1. le choix part PRE-REMPLI avec le role ACTUEL du compte
//      (`userData.role.documentId`). Pour un compte neuf, c'est le role
//      provisoire « Authenticated » : aucune case n'est cochee, mais le choix
//      n'est pas vide, donc « Continuer » reste actif et envoie ce role-la, que
//      le serveur refuse ;
//   2. deux voix disent la meme erreur : l'ecran (`onError`, message brut du
//      serveur) et le gestionnaire global des mutations (`MutationCache`, qui
//      traduit le 403 en « Acces refuse. »).

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
        <UserRole navigation={/** @type {any} */ ({ navigate: mockNavigate })} />
      </QueryClientProvider>,
    );
  });
  montes.push(arbre);
  return arbre;
};

const bouton = (arbre, libelle) => arbre.root.findAll(
  (/** @type {any} */ n) => n.type === TouchableOpacity && n.props.accessibilityLabel === libelle,
)[0];
const appuyer = async (noeud) => {
  await act(async () => { noeud.props.onPress(); });
  await act(async () => { await new Promise((resoudre) => { setTimeout(resoudre, 0); }); });
};
const rangee = (arbre, libelle) => arbre.root.findAll(
  (/** @type {any} */ n) => n.type === TouchableOpacity && n.props.accessibilityRole === 'radio'
    && n.findAllByType(Text).some((/** @type {any} */ texte) => texte.props.children === libelle),
)[0];

const CONTINUER = 'Continuer';

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  // Un compte NEUF : son role est le role provisoire.
  mockUserData = { documentId: 'u-139', role: { documentId: 'role-authenticated', type: 'authenticated' } };
});

afterEach(async () => {
  await act(async () => { montes.splice(0).forEach((arbre) => arbre.unmount()); });
  jest.restoreAllMocks();
});

test('caracterisation — choisir « Joueur·se » puis « Continuer » envoie CE role et passe au nom', async () => {
  /** @type {any} */ (updateMe).mockResolvedValue({});
  const arbre = await monter();

  await appuyer(rangee(arbre, 'Joueur·se'));
  await appuyer(bouton(arbre, CONTINUER));

  expect(updateMe).toHaveBeenCalledTimes(1);
  expect(/** @type {any} */ (updateMe).mock.calls[0][0]).toEqual({ role: 'role-joueur' });
  expect(mockNavigate).toHaveBeenCalledWith('UserName');
});

test('FINITIONS5-8 · compte neuf, rien de coché : « Continuer » est INACTIF et rien ne part', async () => {
  const arbre = await monter();

  expect(bouton(arbre, CONTINUER).props.disabled).toBe(true);
  await appuyer(bouton(arbre, CONTINUER));
  expect(updateMe).not.toHaveBeenCalled();
});

test('FINITIONS5-8 · décocher son choix rend « Continuer » inactif à nouveau', async () => {
  const arbre = await monter();

  await appuyer(rangee(arbre, 'Joueur·se'));
  expect(bouton(arbre, CONTINUER).props.disabled).toBe(false);
  await appuyer(rangee(arbre, 'Joueur·se'));
  expect(bouton(arbre, CONTINUER).props.disabled).toBe(true);
});

test('FINITIONS5-8 · un refus du serveur se dit UNE fois, en français', async () => {
  const refus = /** @type {any} */ (new Error('Failed to update user data: Requested role is not allowed'));
  refus.status = 403;
  refus.response = { data: { error: { message: 'Requested role is not allowed', status: 403 } }, status: 403 };
  /** @type {any} */ (updateMe).mockRejectedValue(refus);
  const arbre = await monter();

  await appuyer(rangee(arbre, 'Entraîneur·e'));
  await appuyer(bouton(arbre, CONTINUER));

  const alertes = /** @type {any} */ (Alert.alert).mock.calls;
  // Une seule voix : l'ecran, ou le gestionnaire global — jamais les deux.
  expect(alertes.length + alerteGlobale.mock.calls.length).toBe(1);
  expect(alertes).toHaveLength(1);
  const [titre, message] = alertes[0];
  expect(titre).toBe('Erreur');
  expect(message).toBe('Accès refusé.');
  expect(String(message)).not.toMatch(/Failed|Requested|allowed/);
  expect(mockNavigate).not.toHaveBeenCalled();
});
