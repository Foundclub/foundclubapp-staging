import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import Profile from '../Profile';

// PARENT-LIEN (2026-09-30, « lien B » d Adel) — LA RANGEE « MON PARENT ».
//
// C est la porte de l ENFANT vers le lien : accepter ou refuser la demande d un parent, voir
// qui est relie a son compte, retirer le lien. Elle se montre a un compte de 13 a 17 ans (age
// CONNU), et a quiconque est deja relie (pour pouvoir retirer le lien, meme devenu majeur).
// Un adulte sans lien ne la voit pas : il n a rien a y faire.
//
// Doublures copiees de Profile.roleParent.test.js : t resout dans le VRAI fr.js.

/** @type {any} */
let mockUserData;

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: () => {},
}));

jest.mock('react-native-gesture-handler', () => ({
  ScrollView: jest.requireActual('react-native').ScrollView,
}));

jest.mock('@tanstack/react-query', () => ({
  useMutation: () => ({ isPending: false, mutate: jest.fn() }),
}));

jest.mock('react-i18next', () => {
  const catalogue = jest.requireActual('@/theme/strings/translations/fr').default;

  return {
    useTranslation: () => ({
      t: (/** @type {string} */ cle, /** @type {any} */ repli) => {
        const valeur = String(cle || '')
          .split('.')
          .reduce((noeud, segment) => (noeud == null ? undefined : noeud[segment]), catalogue);
        if (typeof valeur === 'string') return valeur;
        return typeof repli === 'string' ? repli : cle;
      },
    }),
  };
});

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({
    addAccount: jest.fn(),
    authSessions: [],
    canEditClub: () => false,
    canManageTeam: () => false,
    freeUsageSummary: null,
    logoutMutation: { mutate: jest.fn() },
    refetchUserData: jest.fn(),
    subscriptionAccessLevel: 'free',
    switchAccount: jest.fn(),
    userData: mockUserData,
    userDataError: null,
    userDataLoading: false,
  }),
}));

jest.mock('@/store/appContext', () => ({
  useAppContext: () => [{ fcmToken: 'token-test' }, jest.fn()],
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

// COLLECTIVITES 1c — Profil lit `/collectivites/mine` (la porte « Ma collectivite ») :
// doublure, comme tout service que l ecran importe (le client HTTP ne se charge pas ici).
jest.mock('@/services/collectivite/collectiviteQueries', () => ({
  useMyCollectivites: () => ({ data: [] }),
}));

jest.mock('@/services/auth/authService', () => ({
  deleteAccount: jest.fn(),
}));

jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) { return children; },
);
jest.mock(
  '@/components/molecules/withDataWrapper/WithDataWrapper',
  () => function WithDataWrapperMock({ children }) { return children; },
);
jest.mock(
  '@/components/molecules/onboardingWrapper/OnboardingWrapper',
  () => function OnboardingWrapperMock({ children }) { return children; },
);
jest.mock(
  '@/components/molecules/tutorial/TutorialFlowBoundary',
  () => function TutorialFlowBoundaryMock({ children }) { return children; },
);
jest.mock(
  '@/components/molecules/bottomModal/BottomModal',
  () => function BottomModalMock() { return null; },
);
jest.mock(
  '@/components/molecules/profileAvatar/ProfileAvatar',
  () => function ProfileAvatarMock() { return null; },
);
jest.mock(
  '@/components/molecules/clubLogoMark/ClubLogoMark',
  () => function ClubLogoMarkMock() { return null; },
);
jest.mock('@/components/atoms/button/Button', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
  return function ButtonMock(/** @type {any} */ props) {
    return reactActuel.createElement(
      PressableRN,
      { disabled: props.disabled, onPress: props.onPress },
      reactActuel.createElement(TexteRN, null, props.title),
    );
  };
});

/**
 * Aplati les enfants React en une chaine.
 * @param {any} enfants
 * @returns {string}
 */
const aplatirTexte = (enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatirTexte).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatirTexte(enfants?.props?.children);
  return String(enfants);
};

/**
 * Une date de naissance ISO pour quelqu un qui a ce nombre d ans revolus aujourd hui.
 * @param {number} ans - L age voulu.
 * @returns {string} La date AAAA-MM-JJ.
 */
const neIlYa = (/** @type {number} */ ans) => {
  const date = new Date();
  date.setUTCFullYear(date.getUTCFullYear() - ans);
  date.setUTCDate(date.getUTCDate() - 3);
  return date.toISOString().slice(0, 10);
};

const mockNaviguer = jest.fn();

/**
 * Monte « Mon compte » et rend ses libelles visibles et l arbre.
 * @param {object} extra - Ce qui s ajoute au compte connecte.
 * @returns {Promise<{ arbre: any, libelles: string[] }>} L arbre et les textes affiches.
 */
const monter = async (extra) => {
  mockUserData = {
    club: null,
    documentId: 'user-doc-1',
    firstname: 'Ines',
    lastname: 'Bonnet',
    multisportClubs: [],
    role: { name: 'Joueur', type: 'joueur' },
    ...extra,
  };
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <Profile
        navigation={{ navigate: mockNaviguer, setParams: jest.fn() }}
        route={{ params: {} }}
      />,
    );
  });
  const libelles = arbre.root
    .findAllByType(Text)
    .map((/** @type {any} */ texte) => aplatirTexte(texte.props.children).trim());
  return { arbre, libelles };
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Profile — la rangee « Mon parent » (PARENT-LIEN)', () => {
  it('un joueur de 15 ans la voit, et elle ouvre l ecran « Mon parent »', async () => {
    const { arbre, libelles } = await monter({ birthdate: neIlYa(15) });
    expect(libelles).toContain('Mon parent');

    const rangee = arbre.root.findAll((/** @type {any} */ noeud) => (
      typeof noeud.props?.onPress === 'function'
      && aplatirTexte(noeud.props?.children).includes('Mon parent')
    ))[0];
    await act(async () => { rangee.props.onPress(); });
    expect(mockNaviguer).toHaveBeenCalledWith('MyParentLink', undefined);
  });

  it('un adulte sans lien ne la voit pas', async () => {
    const { libelles } = await monter({ birthdate: neIlYa(34) });
    expect(libelles).not.toContain('Mon parent');
  });

  it('un compte SANS date de naissance ne la voit pas : l age inconnu ferme la porte', async () => {
    const { libelles } = await monter({ birthdate: null });
    expect(libelles).not.toContain('Mon parent');
  });

  // Il doit pouvoir retirer le lien.
  it('un compte DEJA relie la voit, meme devenu majeur', async () => {
    const { libelles } = await monter({
      birthdate: neIlYa(19),
      parentAccount: { documentId: 'parent-1' },
    });
    expect(libelles).toContain('Mon parent');
  });
});
