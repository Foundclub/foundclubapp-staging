import { QueryClientProvider } from '@tanstack/react-query';
import { Alert, Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import UserRole from '@/views/onboarding/UserRole';

import { updateMe } from '@/services/auth/authService';

import { createFoundClubQueryClient } from '@/app/queryClient';

// RESA-INSCRIPTION (19/10/2026) — « POUR UN COMPLEXE » AU CHOIX DU STATUT D'UN NOUVEAU COMPTE
// (plan validé, E-G01 état 0, `docs/PLAN_ECRANS_RESERVATION_2026-10-13.md:302-306` ; planche
// EG01-inscription, état 0). Un nouvel intertitre sous « Pour une mairie », un choix « Je gère un
// complexe » (« Foot à 5, padel, tennis… ») sur le modèle de « Je représente une collectivité » :
// aucun rôle sportif posé, aucune question de sport, il mène au tunnel EXISTANT
// (`ComplexeDevenirGerant`, RESA-L5A1).
//   · interrupteur `COMPLEXES_GERANT` ÉTEINT (l'état livré) : l'écran est celui de staging ;
//   · ALLUMÉ : le choix existe, exclusif des rôles et de la mairie.
// Harnais repris de `UserRole.FINITIONS5.test.js` (le témoin caractérisant de l'écran).

const mockNavigate = jest.fn();
const mockReset = jest.fn();

/**
 * L'interrupteur du gérant, lu à chaque rendu (la doublure garde les autres tels quels). Posé par
 * `defineProperty` APRÈS la copie : une copie `{ ...reel, get X() {} }` lirait le lecteur UNE fois.
 */
let mockComplexesGerant = false;
jest.mock('@/config/fonctionsMasquees', () => {
  const doublure = { ...jest.requireActual('@/config/fonctionsMasquees') };
  Object.defineProperty(doublure, 'COMPLEXES_GERANT', { get: () => mockComplexesGerant });
  return doublure;
});

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
  return {
    __esModule: true,
    default: (/** @type {any} */ { children }) => <View>{children}</View>,
  };
});

jest.mock('@/components/molecules/withDataWrapper/WithDataWrapper', () => ({
  __esModule: true,
  default: (/** @type {any} */ { children }) => children,
}));

// La rangée-radio rend son libellé ET sa précision : la planche nomme les deux.
jest.mock('@/views/onboarding/components/OnboardingRadioRow', () => {
  const { Text: TexteRN, TouchableOpacity: Touchable } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ {
      checked, label, onPress, subtitle, testID,
    }) => (
      <Touchable
        accessibilityRole="radio"
        accessibilityState={{ checked }}
        onPress={onPress}
        testID={testID}
      >
        <TexteRN>{label}</TexteRN>
        {subtitle ? <TexteRN>{subtitle}</TexteRN> : null}
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
      <Touchable
        accessibilityLabel={title}
        disabled={Boolean(disabled || isLoading)}
        onPress={onPress}
      >
        <TexteRN>{title}</TexteRN>
      </Touchable>
    ),
  };
});

// Les rôles tels que `/users-permissions/roles` les rend, Parent compris (4 choix sportifs).
const ROLES = [
  { documentId: 'role-authenticated', name: 'Authenticated', type: 'authenticated' },
  { documentId: 'role-joueur', name: 'Joueur', type: 'player' },
  { documentId: 'role-coach', name: 'Entraineur', type: 'coach' },
  { documentId: 'role-dirigeant', name: 'Dirigeant', type: 'president' },
  { documentId: 'role-parent', name: 'Parent', type: 'parent' },
];

jest.mock('@/services/auth/authQueries', () => ({
  useGetRoles: () => ({
    data: ROLES, error: null, isLoading: false, refetch: jest.fn(),
  }),
}));

jest.mock('@/services/auth/authService', () => ({
  updateMe: jest.fn(),
}));

jest.mock('@/services/collectivite/collectiviteQueries', () => ({
  useMyCollectivites: () => ({ data: [] }),
  useMyManagerRequests: () => ({ data: [] }),
}));

jest.mock('@/responsive', () => ({ useIsDesktop: () => false }));

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({
    refetchUserData: jest.fn(async () => {}),
    USER_ROLES: jest.requireActual('@/domains/auth/authUseCases').USER_ROLES,
    // Un compte NEUF : son rôle est le rôle provisoire.
    userData: {
      documentId: 'u-neuf',
      role: { documentId: 'role-authenticated', type: 'authenticated' },
    },
    userDataError: null,
    userDataLoading: false,
  }),
}));

/** @type {any[]} */
const montes = [];

const monter = async () => {
  const client = createFoundClubQueryClient({ onMutationError: jest.fn() });
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

const textes = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text)
  .map((/** @type {any} */ n) => n.props.children)
  .filter((/** @type {any} */ v) => typeof v === 'string');
const bouton = (/** @type {any} */ arbre, /** @type {string} */ libelle) => arbre.root.findAll(
  (/** @type {any} */ n) => n.type === TouchableOpacity && n.props.accessibilityLabel === libelle,
)[0];
const rangees = (/** @type {any} */ arbre) => arbre.root.findAll(
  (/** @type {any} */ n) => n.type === TouchableOpacity && n.props.accessibilityRole === 'radio',
);
const rangee = (/** @type {any} */ arbre, /** @type {string} */ libelle) => rangees(arbre).find(
  (/** @type {any} */ n) => n.findAllByType(Text).some(
    (/** @type {any} */ texte) => texte.props.children === libelle,
  ),
);
const appuyer = async (/** @type {any} */ noeud) => {
  await act(async () => { noeud.props.onPress(); });
  await act(async () => { await new Promise((resoudre) => { setTimeout(resoudre, 0); }); });
};
const libelleDe = (/** @type {any} */ noeud) => noeud.findAllByType(Text)[0].props.children;

const CONTINUER = 'Continuer';

beforeEach(() => {
  jest.clearAllMocks();
  mockComplexesGerant = false;
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(async () => {
  await act(async () => { montes.splice(0).forEach((arbre) => arbre.unmount()); });
  jest.restoreAllMocks();
});

describe('RESA-INSCRIPTION · interrupteur ÉTEINT (l’état livré) : l’écran de staging', () => {
  test('l’interrupteur du dépôt est bien éteint', () => {
    expect(jest.requireActual('@/config/fonctionsMasquees').COMPLEXES_GERANT).toBe(false);
  });

  test('5 rangées (4 rôles + la mairie), un seul intertitre, aucun complexe', async () => {
    const arbre = await monter();

    expect(rangees(arbre).map(libelleDe)).toEqual([
      'Pratiquant·e / Joueur·se',
      'Coach / Prof',
      'Dirigeant·e',
      'Parent',
      'Je représente une collectivité',
    ]);
    const lus = textes(arbre);
    expect(lus).toContain('POUR UNE MAIRIE');
    expect(lus).not.toContain('POUR UN COMPLEXE');
    expect(lus).not.toContain('Je gère un complexe');
  });
});

describe('RESA-INSCRIPTION · interrupteur ALLUMÉ : « Pour un complexe » (E-G01 état 0)', () => {
  beforeEach(() => {
    mockComplexesGerant = true;
  });

  test('« POUR UN COMPLEXE » SOUS « POUR UNE MAIRIE », puis « Je gère un complexe »', async () => {
    const arbre = await monter();
    const lus = textes(arbre);

    expect(lus.indexOf('POUR UNE MAIRIE')).toBeGreaterThan(-1);
    expect(lus.indexOf('POUR UN COMPLEXE')).toBeGreaterThan(lus.indexOf('POUR UNE MAIRIE'));
    expect(rangees(arbre).map(libelleDe)).toEqual([
      'Pratiquant·e / Joueur·se',
      'Coach / Prof',
      'Dirigeant·e',
      'Parent',
      'Je représente une collectivité',
      'Je gère un complexe',
    ]);
    const complexe = rangee(arbre, 'Je gère un complexe');
    expect(complexe.findAllByType(Text).map((/** @type {any} */ n) => n.props.children))
      .toEqual(['Je gère un complexe', 'Foot à 5, padel, tennis…']);
    expect(complexe.props.accessibilityState).toEqual({ checked: false });
  });

  test('le choisir mène au tunnel du complexe, sans rôle posé ni question de sport', async () => {
    const arbre = await monter();

    expect(bouton(arbre, CONTINUER).props.disabled).toBe(true);
    await appuyer(rangee(arbre, 'Je gère un complexe'));
    expect(rangee(arbre, 'Je gère un complexe').props.accessibilityState)
      .toEqual({ checked: true });
    expect(bouton(arbre, CONTINUER).props.disabled).toBe(false);
    await appuyer(bouton(arbre, CONTINUER));

    expect(updateMe).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('ComplexeDevenirGerant');
  });

  test('le décocher rend « Continuer » inactif', async () => {
    const arbre = await monter();
    await appuyer(rangee(arbre, 'Je gère un complexe'));
    await appuyer(rangee(arbre, 'Je gère un complexe'));
    expect(bouton(arbre, CONTINUER).props.disabled).toBe(true);
  });

  test('un rôle sportif choisi ensuite décoche le complexe : le rôle part', async () => {
    /** @type {any} */ (updateMe).mockResolvedValue({});
    const arbre = await monter();
    await appuyer(rangee(arbre, 'Je gère un complexe'));
    await appuyer(rangee(arbre, 'Dirigeant·e'));

    expect(rangee(arbre, 'Je gère un complexe').props.accessibilityState)
      .toEqual({ checked: false });
    await appuyer(bouton(arbre, CONTINUER));
    expect(/** @type {any} */ (updateMe).mock.calls[0][0]).toEqual({ role: 'role-dirigeant' });
    expect(mockNavigate).not.toHaveBeenCalledWith('ComplexeDevenirGerant');
  });

  test('la mairie et le complexe s’excluent, dans les deux sens', async () => {
    const arbre = await monter();
    await appuyer(rangee(arbre, 'Je représente une collectivité'));
    await appuyer(rangee(arbre, 'Je gère un complexe'));
    expect(rangee(arbre, 'Je représente une collectivité').props.accessibilityState)
      .toEqual({ checked: false });
    await appuyer(rangee(arbre, 'Je représente une collectivité'));
    expect(rangee(arbre, 'Je gère un complexe').props.accessibilityState)
      .toEqual({ checked: false });
    await appuyer(bouton(arbre, CONTINUER));

    expect(mockNavigate).toHaveBeenCalledWith('CollectiviteSignup');
    expect(mockNavigate).not.toHaveBeenCalledWith('ComplexeDevenirGerant');
  });
});
