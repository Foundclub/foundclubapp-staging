import { QueryClientProvider } from '@tanstack/react-query';
import { Alert, Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import UserSport from '@/views/onboarding/UserSport';

import { updateMe } from '@/services/auth/authService';

import { createFoundClubQueryClient } from '@/app/queryClient';

// INSCRIPTION-CODE-2 (19/11/2026) — LA PORTE « MAIRIE OU COMPLEXE ? » A DÉMÉNAGÉ AU PREMIER ÉCRAN.
// Avant : « Pour une mairie » (COLL-ACCUEIL, 01/10) et « Pour un complexe » (RESA-INSCRIPTION,
// 19/10) étaient deux rangées de l'écran du statut (UserRole), sous les 4 rôles ; leurs témoins
// étaient UserRole.FINITIONS5 (cas COLL-ACCUEIL) et UserRole.RESAINSCR.
// Depuis INSCRIPTION-CODE (a), 0e24eef92 (V02 validé, v2_02 « ok ») : l'inscription commence par
// « Que pratiques-tu ? » (UserSport), et ces deux rangées sont derrière « Tu représentes une mairie
// ou un complexe ? », en bas de ce premier écran, MÊMES GESTES. Ce fichier porte les MÊMES
// assertions sur leur nouvel écran : un sport remplace « un rôle sportif » (c'est lui, désormais,
// qui exclut la mairie et le complexe).
// Harnais repris de `UserRole.RESAINSCR.test.js`.

const mockNavigate = jest.fn();

let mockComplexesGerant = false;
jest.mock('@/config/fonctionsMasquees', () => {
  const doublure = { ...jest.requireActual('@/config/fonctionsMasquees') };
  Object.defineProperty(doublure, 'COMPLEXES_GERANT', { get: () => mockComplexesGerant });
  return doublure;
});

jest.mock('@/store/appContext', () => ({
  storage: {
    delete: jest.fn(),
    getBoolean: jest.fn(() => false),
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

jest.mock('@/components/templates/FormScreenContainer', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { children }) => <View>{children}</View>,
  };
});

jest.mock('@/views/onboarding/components/OnboardingStickyFooter', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { children }) => <View>{children}</View>,
  };
});

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

jest.mock('@/services/activity/activityQueries', () => ({
  useGetActivities: () => ({
    data: [
      { documentId: 'act-foot', name: 'Football' },
      { documentId: 'act-tennis', name: 'Tennis' },
    ],
    error: null,
    isLoading: false,
    refetch: jest.fn(),
  }),
}));

jest.mock('@/services/auth/authService', () => ({ updateMe: jest.fn() }));

/** @type {any} */
let mockUserData = null;
const COMPTE_NEUF = {
  documentId: 'u-neuf',
  role: { documentId: 'role-authenticated', type: 'authenticated' },
};

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({
    getNextOnboardingRoute: () => 'UserName',
    getPostOnboardingHomeRoute: () => 'HomeTab',
    refetchUserData: jest.fn(async () => {}),
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
        <UserSport navigation={/** @type {any} */ ({ navigate: mockNavigate })} />
      </QueryClientProvider>,
    );
  });
  montes.push(arbre);
  return arbre;
};

const textes = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text)
  .map((/** @type {any} */ n) => n.props.children)
  .filter((/** @type {any} */ v) => typeof v === 'string');
const touche = (/** @type {any} */ arbre, /** @type {string} */ libelle) => arbre.root.findAll(
  (/** @type {any} */ n) => n.type === TouchableOpacity && (
    n.props.accessibilityLabel === libelle
    || n.findAllByType(Text).some((/** @type {any} */ x) => x.props.children === libelle)
  ),
)[0];
const porte = (/** @type {any} */ arbre) => arbre.root.findAll(
  (/** @type {any} */ n) => n.type === TouchableOpacity
    && n.props.testID === 'porte-mairie-complexe',
)[0];
const rangee = (/** @type {any} */ arbre, /** @type {string} */ testID) => arbre.root.findAll(
  (/** @type {any} */ n) => n.type === TouchableOpacity && n.props.testID === testID,
)[0];
const appuyer = async (/** @type {any} */ noeud) => {
  await act(async () => { noeud.props.onPress(); });
  await act(async () => { await new Promise((resoudre) => { setTimeout(resoudre, 0); }); });
};
const ouvrirLaPorte = async (/** @type {any} */ arbre) => { await appuyer(porte(arbre)); };

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

describe('la porte, fermée par défaut, en bas du premier écran', () => {
  test('« Tu représentes une mairie ? » (éteint) ; rien d’autre avant de l’ouvrir', async () => {
    const arbre = await monter();
    expect(textes(arbre)).toContain('Tu représentes une mairie ?');
    expect(porte(arbre).props.accessibilityState).toEqual({ expanded: false });
    expect(rangee(arbre, 'statut-collectivite')).toBeUndefined();
  });

  test('« Tu représentes une mairie ou un complexe ? » (interrupteur allumé)', async () => {
    mockComplexesGerant = true;
    const arbre = await monter();
    expect(textes(arbre)).toContain('Tu représentes une mairie ou un complexe ?');
  });
});

// Avant : UserRole.FINITIONS5, « COLL-ACCUEIL · … » (3 tests), sur l'écran du statut.
describe('COLL-ACCUEIL · la mairie, derrière la porte', () => {
  test('« Je représente une collectivité », sous « Pour une mairie »', async () => {
    const arbre = await monter();
    await ouvrirLaPorte(arbre);
    const lus = textes(arbre);
    expect(lus).toContain('POUR UNE MAIRIE');
    expect(lus.indexOf('Je représente une collectivité'))
      .toBeGreaterThan(lus.indexOf('POUR UNE MAIRIE'));
    expect(lus).toContain('Mairie, intercommunalité, département, région.');
  });

  test('la choisir mène à l’inscription de la mairie, sans rien enregistrer', async () => {
    const arbre = await monter();
    await ouvrirLaPorte(arbre);
    await appuyer(rangee(arbre, 'statut-collectivite'));
    await appuyer(touche(arbre, CONTINUER));
    expect(updateMe).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('CollectiviteSignup');
  });

  // Avant : « choisir ensuite un rôle sportif décoche la mairie » ; le rôle vient après, c'est le
  // sport qui l'exclut ici.
  test('choisir ensuite un sport décoche la mairie : le sport part', async () => {
    /** @type {any} */ (updateMe).mockResolvedValue({});
    const arbre = await monter();
    await ouvrirLaPorte(arbre);
    await appuyer(rangee(arbre, 'statut-collectivite'));
    await appuyer(touche(arbre, 'Football'));
    expect(rangee(arbre, 'statut-collectivite').props.accessibilityState)
      .toEqual({ checked: false });
    await appuyer(touche(arbre, CONTINUER));
    expect(/** @type {any} */ (updateMe).mock.calls[0][0]).toEqual({ preferredSport: 'Football' });
    expect(mockNavigate).not.toHaveBeenCalledWith('CollectiviteSignup');
  });
});

// Avant : UserRole.RESAINSCR (7 tests), sur l'écran du statut.
describe('RESA-INSCRIPTION · interrupteur ÉTEINT : pas de complexe', () => {
  test('l’interrupteur du dépôt est allumé, RESA-OUVERTURE', () => {
    expect(jest.requireActual('@/config/fonctionsMasquees').COMPLEXES_GERANT).toBe(true);
  });

  test('porte ouverte : la mairie seule, un seul intertitre', async () => {
    const arbre = await monter();
    await ouvrirLaPorte(arbre);
    const lus = textes(arbre);
    expect(lus).toContain('POUR UNE MAIRIE');
    expect(lus).not.toContain('POUR UN COMPLEXE');
    expect(lus).not.toContain('Je gère un complexe');
    expect(rangee(arbre, 'statut-complexe')).toBeUndefined();
  });
});

describe('RESA-INSCRIPTION · interrupteur ALLUMÉ : « Pour un complexe » (E-G01 état 0)', () => {
  beforeEach(() => {
    mockComplexesGerant = true;
  });

  test('« POUR UN COMPLEXE » SOUS « POUR UNE MAIRIE », puis « Je gère un complexe »', async () => {
    const arbre = await monter();
    await ouvrirLaPorte(arbre);
    const lus = textes(arbre);
    expect(lus.indexOf('POUR UNE MAIRIE')).toBeGreaterThan(-1);
    expect(lus.indexOf('POUR UN COMPLEXE')).toBeGreaterThan(lus.indexOf('POUR UNE MAIRIE'));
    const complexe = rangee(arbre, 'statut-complexe');
    expect(complexe.findAllByType(Text).map((/** @type {any} */ n) => n.props.children))
      .toEqual(['Je gère un complexe', 'Foot à 5, padel, tennis…']);
    expect(complexe.props.accessibilityState).toEqual({ checked: false });
  });

  test('sans identité : « Qui es-tu ? » d’abord, le choix gardé en mode complexe', async () => {
    const { storage } = jest.requireMock('@/store/appContext');
    const arbre = await monter();
    await ouvrirLaPorte(arbre);
    await appuyer(rangee(arbre, 'statut-complexe'));
    await appuyer(touche(arbre, CONTINUER));
    expect(updateMe).not.toHaveBeenCalled();
    expect(storage.set).toHaveBeenCalledWith('user.complexe_mode.u-neuf', 'on');
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('UserName');
  });

  test('le choisir mène au tunnel du complexe, sans rien enregistrer', async () => {
    mockUserData = {
      ...COMPTE_NEUF, birthdate: '1990-05-12', firstname: 'Gérant', lastname: 'Recette',
    };
    const arbre = await monter();
    await ouvrirLaPorte(arbre);
    expect(touche(arbre, CONTINUER).props.disabled).toBe(true);
    await appuyer(rangee(arbre, 'statut-complexe'));
    expect(rangee(arbre, 'statut-complexe').props.accessibilityState).toEqual({ checked: true });
    expect(touche(arbre, CONTINUER).props.disabled).toBe(false);
    await appuyer(touche(arbre, CONTINUER));
    expect(updateMe).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('ComplexeDevenirGerant');
  });

  test('le décocher rend « Continuer » inactif', async () => {
    const arbre = await monter();
    await ouvrirLaPorte(arbre);
    await appuyer(rangee(arbre, 'statut-complexe'));
    await appuyer(rangee(arbre, 'statut-complexe'));
    expect(touche(arbre, CONTINUER).props.disabled).toBe(true);
  });

  // Avant : « un rôle sportif choisi ensuite décoche le complexe : le rôle part ».
  test('un sport choisi ensuite décoche le complexe : le sport part', async () => {
    /** @type {any} */ (updateMe).mockResolvedValue({});
    const arbre = await monter();
    await ouvrirLaPorte(arbre);
    await appuyer(rangee(arbre, 'statut-complexe'));
    await appuyer(touche(arbre, 'Football'));
    expect(rangee(arbre, 'statut-complexe').props.accessibilityState).toEqual({ checked: false });
    await appuyer(touche(arbre, CONTINUER));
    expect(/** @type {any} */ (updateMe).mock.calls[0][0]).toEqual({ preferredSport: 'Football' });
    expect(mockNavigate).not.toHaveBeenCalledWith('ComplexeDevenirGerant');
  });

  test('la mairie et le complexe s’excluent, dans les deux sens', async () => {
    const arbre = await monter();
    await ouvrirLaPorte(arbre);
    await appuyer(rangee(arbre, 'statut-collectivite'));
    await appuyer(rangee(arbre, 'statut-complexe'));
    expect(rangee(arbre, 'statut-collectivite').props.accessibilityState)
      .toEqual({ checked: false });
    await appuyer(rangee(arbre, 'statut-collectivite'));
    expect(rangee(arbre, 'statut-complexe').props.accessibilityState).toEqual({ checked: false });
    await appuyer(touche(arbre, CONTINUER));
    expect(mockNavigate).toHaveBeenCalledWith('CollectiviteSignup');
    expect(mockNavigate).not.toHaveBeenCalledWith('ComplexeDevenirGerant');
  });
});
