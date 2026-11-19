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
//   · interrupteur `COMPLEXES_GERANT` ÉTEINT : l'écran est celui de staging ;
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

// GERANT-INSCRIPTION (10/11) : le compte lu à chaque rendu (sans ou avec identité).
/** @type {any} */
let mockUserData = null;
const COMPTE_NEUF = {
  documentId: 'u-neuf',
  role: { documentId: 'role-authenticated', type: 'authenticated' },
};

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({
    refetchUserData: jest.fn(async () => {}),
    USER_ROLES: jest.requireActual('@/domains/auth/authUseCases').USER_ROLES,
    // Un compte NEUF : son rôle est le rôle provisoire.
    userData: mockUserData,
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
  mockUserData = COMPTE_NEUF;
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(async () => {
  await act(async () => { montes.splice(0).forEach((arbre) => arbre.unmount()); });
  jest.restoreAllMocks();
});

// INSCRIPTION-CODE-2 (19/11/2026) — « POUR UN COMPLEXE » A DÉMÉNAGÉ AU PREMIER ÉCRAN (V02 validé,
// INSCRIPTION-CODE (a) 0e24eef92) : derrière « Tu représentes une mairie ou un complexe ? », en bas
// de « Que pratiques-tu ? ». Les 7 témoins de ce fichier y sont portés, MÊMES ASSERTIONS, dans
// `UserSport.PORTEMAIRIE.test.js` (« RESA-INSCRIPTION · interrupteur ÉTEINT / ALLUMÉ »). Ici ne
// reste que ce que l'écran du rôle doit encore garantir : ni mairie ni complexe, dans les deux
// états
// de l'interrupteur, et le rôle sportif part seul.
describe('RESA-INSCRIPTION · interrupteur ÉTEINT', () => {
  test('l’interrupteur du dépôt est allumé, RESA-OUVERTURE', () => {
    expect(jest.requireActual('@/config/fonctionsMasquees').COMPLEXES_GERANT).toBe(true);
  });

  // Avant : « 5 rangées (4 rôles + la mairie), un seul intertitre, aucun complexe ».
  test('4 rangées (les 4 rôles), ni mairie ni complexe', async () => {
    const arbre = await monter();

    expect(rangees(arbre).map(libelleDe)).toEqual([
      'Pratiquant·e / Joueur·se',
      'Coach / Prof',
      'Dirigeant·e',
      'Parent',
    ]);
    const lus = textes(arbre);
    expect(lus).not.toContain('POUR UNE MAIRIE');
    expect(lus).not.toContain('POUR UN COMPLEXE');
    expect(lus).not.toContain('Je gère un complexe');
  });
});

describe('RESA-INSCRIPTION · interrupteur ALLUMÉ', () => {
  beforeEach(() => {
    mockComplexesGerant = true;
  });

  // Avant : « POUR UN COMPLEXE » SOUS « POUR UNE MAIRIE », puis « Je gère un complexe » (6
  // rangées).
  test('toujours les 4 rôles seuls : le complexe est au premier écran', async () => {
    const arbre = await monter();
    expect(rangees(arbre).map(libelleDe)).toEqual([
      'Pratiquant·e / Joueur·se',
      'Coach / Prof',
      'Dirigeant·e',
      'Parent',
    ]);
    expect(textes(arbre)).not.toContain('POUR UN COMPLEXE');
    expect(rangee(arbre, 'Je gère un complexe')).toBeUndefined();
  });

  test('rien de coché : « Continuer » inactif, aucun tunnel du complexe', async () => {
    const arbre = await monter();
    expect(bouton(arbre, CONTINUER).props.disabled).toBe(true);
    await appuyer(bouton(arbre, CONTINUER));
    expect(updateMe).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalledWith('ComplexeDevenirGerant');
  });

  // Avant : « un rôle sportif choisi ensuite décoche le complexe : le rôle part ».
  test('un rôle sportif choisi : le rôle part, sans tunnel du complexe', async () => {
    /** @type {any} */ (updateMe).mockResolvedValue({});
    const arbre = await monter();
    await appuyer(rangee(arbre, 'Dirigeant·e'));
    await appuyer(bouton(arbre, CONTINUER));
    expect(/** @type {any} */ (updateMe).mock.calls[0][0]).toEqual({ role: 'role-dirigeant' });
    expect(mockNavigate).not.toHaveBeenCalledWith('ComplexeDevenirGerant');
    expect(mockNavigate).not.toHaveBeenCalledWith('CollectiviteSignup');
  });

  test('le porteur des 7 témoins déménagés existe', () => {
    const fs = jest.requireActual('fs');
    const path = jest.requireActual('path');
    const porte = fs.readFileSync(path.join(__dirname, 'UserSport.PORTEMAIRIE.test.js'), 'utf8');
    [
      '« POUR UN COMPLEXE » SOUS « POUR UNE MAIRIE », puis « Je gère un complexe »',
      'sans identité : « Qui es-tu ? » d’abord, le choix gardé en mode complexe',
      'le choisir mène au tunnel du complexe, sans rien enregistrer',
      'le décocher rend « Continuer » inactif',
      'un sport choisi ensuite décoche le complexe : le sport part',
      'la mairie et le complexe s’excluent, dans les deux sens',
    ].forEach((titre) => expect(porte).toContain(titre));
  });
});
