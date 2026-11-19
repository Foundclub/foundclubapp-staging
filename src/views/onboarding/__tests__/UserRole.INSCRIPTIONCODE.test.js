import { QueryClientProvider } from '@tanstack/react-query';
import { Alert, Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import UserRole from '@/views/onboarding/UserRole';

import { updateMe } from '@/services/auth/authService';

import { createFoundClubQueryClient } from '@/app/queryClient';

// INSCRIPTION-CODE (19/11/2026) — L'ÉCRAN DU RÔLE APRÈS L'ACTIVITÉ ET « QUI ES-TU ? ».
//   (a) V05 + reco de v2_01 : l'âge est connu, les rôles d'adulte sont fermés avant 18 ans et le
//       disent ; la suite est la première étape due du rôle choisi (plus « Qui es-tu ? » en dur) ;
//       la porte mairie/complexe est partie au premier écran.
//   (b) V04, V06 à V09 (v2_03 « ok ») : les noms et les phrases des rôles suivent la famille de
//       l'activité ; activité inconnue : les mots d'avant.
// Harnais repris de `UserRole.RESAINSCR.test.js`.

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
      let texte = typeof repli === 'string' ? repli : cle;
      if (typeof valeur === 'string') texte = valeur;
      const options = typeof repli === 'object' && repli ? repli : {};
      return texte.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, nom) => String(options[nom] ?? ''));
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
      checked, disabled, label, onPress, subtitle, testID,
    }) => (
      <Touchable
        accessibilityRole="radio"
        accessibilityState={{ checked, disabled: Boolean(disabled) }}
        disabled={Boolean(disabled)}
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
    getPostOnboardingHomeRoute: () => 'HomeTab',
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

const ADULTE = '1990-05-04';
const ilYA = (/** @type {number} */ ans) => {
  const date = new Date();
  date.setFullYear(date.getFullYear() - ans);
  return date.toISOString().slice(0, 10);
};
const compte = (/** @type {any} */ champs) => ({
  ...COMPTE_NEUF, birthdate: ADULTE, firstname: 'Lina', lastname: 'Morel', ...champs,
});
const titre = (/** @type {any} */ arbre) => textes(arbre)[0];
const libelles = (/** @type {any} */ arbre) => rangees(arbre).map(libelleDe);

beforeEach(() => {
  jest.clearAllMocks();
  mockComplexesGerant = true;
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(async () => {
  await act(async () => { montes.splice(0).forEach((arbre) => arbre.unmount()); });
  jest.restoreAllMocks();
});

describe('(b) les mots du rôle suivent la famille de l’activité', () => {
  it.each([
    ['Football', 'Ton rôle en football ?', ['Joueur·se', 'Coach', 'Dirigeant·e', 'Parent']],
    ['Judo', 'Ton rôle en judo ?', ['Pratiquant·e', 'Professeur·e / Coach', 'Dirigeant·e', 'Parent']],
    ['Natation', 'Ton rôle en natation ?', ['Sportif·ve', 'Coach', 'Dirigeant·e', 'Parent']],
    ['Spéléologie', 'Ton rôle en spéléologie ?',
      ['Pratiquant·e', 'Encadrant·e', 'Membre du bureau', 'Parent']],
    ['Musique', 'Ton rôle en musique ?',
      ['Adhérent·e', 'Professeur·e / Animateur·rice', 'Membre du bureau', 'Parent']],
    ['VTT', 'Ton rôle en VTT ?', ['Sportif·ve', 'Coach', 'Dirigeant·e', 'Parent']],
  ])('%s : « %s »', async (activite, attendu, roles) => {
    mockUserData = compte({ preferredSport: activite });
    const arbre = await monter();
    expect(titre(arbre)).toBe(attendu);
    expect(libelles(arbre)).toEqual(roles);
  });

  it('chaque rôle dit ce qu’il fait (spéléologie : « J’encadre des sorties… »)', async () => {
    mockUserData = compte({ preferredSport: 'Spéléologie' });
    const arbre = await monter();
    expect(textes(arbre)).toEqual(expect.arrayContaining([
      'Je pratique en club, ou je cherche un club',
      'J’encadre des sorties ou des initiations',
    ]));
  });

  it('activité inconnue : les mots d’avant, sans la promesse « d’autres plus tard »', async () => {
    mockUserData = compte({ preferredSport: 'Quidditch' });
    const arbre = await monter();
    expect(libelles(arbre))
      .toEqual(['Pratiquant·e / Joueur·se', 'Coach / Prof', 'Dirigeant·e', 'Parent']);
    expect(textes(arbre).join(' ')).not.toMatch(/plus tard/);
  });
});

describe('(a) l’âge est connu avant le rôle', () => {
  it('à 14 ans : Coach, Dirigeant·e et Parent visibles, fermés, « À partir de 18 ans »', async () => {
    mockUserData = compte({ birthdate: ilYA(14), preferredSport: 'Football' });
    const arbre = await monter();
    const fermes = rangees(arbre).filter((r) => r.props.disabled).map(libelleDe);
    expect(fermes).toEqual(['Coach', 'Dirigeant·e', 'Parent']);
    expect(textes(arbre).filter((x) => x === 'À partir de 18 ans')).toHaveLength(3);
    expect(textes(arbre)).toContain('Certains rôles sont réservés aux 18 ans et plus.');
    expect(bouton(arbre, CONTINUER).props.disabled).toBe(true);
  });

  it('un adulte : aucun rôle fermé', async () => {
    mockUserData = compte({ preferredSport: 'Football' });
    const arbre = await monter();
    expect(rangees(arbre).filter((r) => r.props.disabled)).toHaveLength(0);
  });

  it('la porte mairie / complexe n’est plus sur cet écran', async () => {
    mockUserData = compte({ preferredSport: 'Football' });
    const arbre = await monter();
    expect(arbre.root.findAll((n) => n.props.testID === 'statut-collectivite')).toHaveLength(0);
    expect(arbre.root.findAll((n) => n.props.testID === 'statut-complexe')).toHaveLength(0);
  });

  it('Joueur·se choisi : la suite est la première étape due du joueur (la section)', async () => {
    mockUserData = compte({ preferredSport: 'Football' });
    updateMe.mockResolvedValue({});
    const arbre = await monter();
    await appuyer(rangee(arbre, 'Joueur·se'));
    await appuyer(bouton(arbre, CONTINUER));
    expect(updateMe.mock.calls[0][0]).toEqual({ role: 'role-joueur' });
    expect(mockNavigate).toHaveBeenCalledWith('UserSection');
  });

  it('Parent choisi, sans photo : la photo (son identité est déjà donnée)', async () => {
    mockUserData = compte({ preferredSport: 'Football' });
    updateMe.mockResolvedValue({});
    const arbre = await monter();
    await appuyer(rangee(arbre, 'Parent'));
    await appuyer(bouton(arbre, CONTINUER));
    expect(mockNavigate).toHaveBeenCalledWith('UserAvatar');
  });
});
