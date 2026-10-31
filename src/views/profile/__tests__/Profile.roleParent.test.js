import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import Profile from '../Profile';

// PARENT (2026-09-02) — LE PROFIL D UN PARENT.
//
// Un compte de role Parent se presente comme « Parent » (et non « Membre »,
// ce que rendait getUserRoleKey('Parent') → 'new' avant ce lot), et ne voit
// aucune rangee de gestion de club : un Parent n est pas un dirigeant.
// PARENT P2 (10/09) — la rangee « Mes enfants » EXISTE desormais, et elle est
// visible des QUATRE roles : « avoir des enfants » est une CAPACITE, pas un
// privilege de role (GO Adel du 07/09, repris dans les quatre cartes de role
// du serveur). Ce qui change d un role a l autre, c est l INSISTANCE — le
// parent a en plus une case dediee sur son accueil (P0) — jamais le droit.
//
// Copie des doublures de Profile.menuProfil.test.js : `t` resout dans le VRAI
// `fr.js`, une cle absente ferait echouer le test au lieu de le rendre vert.

/** @type {any} */
let mockUserData;
/** PAR-L12 — le mode parent d'un compte sportif (choix d'affichage, `useAuth`). */
let mockIsParentMode = false;

// R17-SIGNALER-1 : « Mes signalements » lit ses signalements (doublure, pas de reseau).
jest.mock('@/services/facilityReport/facilityReportQueries', () => ({
  useMyFacilityReports: () => ({ data: null }),
}));
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
    isParentMode: mockIsParentMode,
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
// RESA-L6B-1 — le nombre de « Mes réservations » (rangée cachée par COMPLEXES_JOUEUR) lit le
// serveur des complexes : doublé ici comme les autres services de « Mon compte ».
jest.mock('@/views/reserverTerrain/components/NombreAVenir', () => () => null);
jest.mock('@/services/collectivite/collectiviteQueries', () => ({
  // COLL-ACCUEIL (01/10) : la pastille de la rangee de la Ville lit les demandes en attente.
  useCollectiviteRequests: () => ({ data: [] }),
  useMyCollectivites: () => ({ data: [] }),
  useMyManagerRequests: () => ({ data: [] }),
}));

jest.mock('@/services/auth/authService', () => ({
  deleteAccount: jest.fn(),
}));

// PAR-L7 (13/10) — « Mon compte » d'un parent compte ses enfants : doublure commune
// (`parent/__mocks__/useMesEnfantsEnBref.js`), « aucun enfant » par defaut.
jest.mock('@/views/profile/parent/useMesEnfantsEnBref');

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
 * Monte « Mon compte » pour un role donne et rend ses libelles visibles.
 * @param {{ name: string, type: string }} role Le role du compte connecte.
 * @returns {Promise<string[]>} Les textes affiches.
 */
const libellesDuMenu = async (role) => {
  mockUserData = {
    club: null,
    documentId: 'user-doc-1',
    firstname: 'Nadia',
    lastname: 'Bonnet',
    multisportClubs: [],
    role,
  };
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <Profile navigation={{ navigate: jest.fn(), setParams: jest.fn() }} route={{ params: {} }} />,
    );
  });
  return arbre.root
    .findAllByType(Text)
    .map((/** @type {any} */ texte) => aplatirTexte(texte.props.children).trim());
};

/**
 * Monte « Mon compte » et rend l'arbre (pour lire un `testID`).
 * @param {{ name: string, type: string }} role Le role du compte connecte.
 * @returns {Promise<any>} L'arbre rendu.
 */
const monterLeMenu = async (role) => {
  mockUserData = {
    club: null, documentId: 'user-doc-1', firstname: 'Nadia', multisportClubs: [], role,
  };
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <Profile navigation={{ navigate: jest.fn(), setParams: jest.fn() }} route={{ params: {} }} />,
    );
  });
  return arbre;
};

const ROLE_PARENT = { name: 'Parent', type: 'parent' };
const ROLE_JOUEUR = { name: 'Joueur', type: 'joueur' };

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Profile — le profil d un Parent (PARENT)', () => {
  it('un Parent se presente comme « Parent », jamais comme « Membre »', async () => {
    const libelles = await libellesDuMenu(ROLE_PARENT);
    expect(libelles).toContain('Parent');
    expect(libelles).not.toContain('Membre');
  });

  it('un Parent ne voit pas « Gérer mon club » : un Parent n est pas un dirigeant', async () => {
    const libelles = await libellesDuMenu(ROLE_PARENT);
    expect(libelles).not.toContain('Gérer mon club');
  });

  it('P2/11 un Parent trouve « Mes enfants » dans son menu', async () => {
    const libelles = await libellesDuMenu(ROLE_PARENT);
    expect(libelles).toContain('Mes enfants');
  });

  it('P2/11 un JOUEUR aussi : c est une capacite, pas un privilege de role', async () => {
    // Le serveur declare les 4 gestes « enfant declare » dans les QUATRE cartes
    // (Joueur, Entraineur, Dirigeant, Parent). Cacher la rangee aux trois autres
    // creerait un ecran INATTEIGNABLE alors que le droit existe — exactement le
    // defaut « une fonctionnalite qu aucun bouton n atteint » (§2 quinquies).
    const libelles = await libellesDuMenu(ROLE_JOUEUR);
    expect(libelles).toContain('Mes enfants');
  });

  it('un joueur, lui, ne se presente pas comme Parent', async () => {
    const libelles = await libellesDuMenu(ROLE_JOUEUR);
    expect(libelles).not.toContain('Parent');
  });
});

// PAR-L7 (13/10, design parent E02, decision D1 A d'Adel du 12/10) — LA FAMILLE D'ABORD.
describe('PAR-L7 — « Mon compte » d un Parent commence par ses enfants', () => {
  const useMesEnfantsEnBref = jest
    .requireMock('@/views/profile/parent/useMesEnfantsEnBref').default;
  const ORDRE_DU_PARENT = [
    'Mes enfants', 'Voir mon profil', 'Modifier mon profil', 'Gérer mes alertes',
    'Ma carte de collection',
  ];

  afterEach(() => {
    useMesEnfantsEnBref.regler();
    useMesEnfantsEnBref.appels.length = 0;
  });

  it('sa section s appelle « Ma famille et mon profil », dans l ordre de la planche', async () => {
    const libelles = await libellesDuMenu(ROLE_PARENT);

    expect(libelles).toContain('Ma famille et mon profil');
    expect(libelles).not.toContain('Profil & activité');
    expect(libelles.filter((libelle) => ORDRE_DU_PARENT.includes(libelle)))
      .toEqual(ORDRE_DU_PARENT);
  });

  it('« Mes enfants » dit combien il en a (2), sans la pastille rouge des alertes', async () => {
    useMesEnfantsEnBref.regler({ lignes: [], reste: 0, total: 2 });
    const arbre = await monterLeMenu(ROLE_PARENT);
    // Le nœud HÔTE de la pastille (la doublure composite porte aussi le testID).
    const nombres = arbre.root.findAll((noeud) => typeof noeud.type === 'string'
      && noeud.props.testID === 'myChildren-nombre');

    expect(nombres).toHaveLength(1);
    expect(nombres[0].findAllByType(Text)
      .map((/** @type {any} */ texte) => aplatirTexte(texte.props.children)).join('')).toBe('2');
    expect(arbre.root.findAllByProps({ testID: 'myChildren-compteur' })).toHaveLength(0);
    expect(useMesEnfantsEnBref.appels.at(-1)).toEqual({ actif: true });
  });

  it('aucun enfant lu : pas de nombre (jamais un « 0 »)', async () => {
    const arbre = await monterLeMenu(ROLE_PARENT);

    expect(arbre.root.findAllByProps({ testID: 'myChildren-nombre' })).toHaveLength(0);
  });

  it('un JOUEUR garde son menu : son titre, son ordre, et rien n est lu pour lui', async () => {
    useMesEnfantsEnBref.regler({ lignes: [], reste: 0, total: 2 });
    const libelles = await libellesDuMenu(ROLE_JOUEUR);

    expect(libelles).toContain('Profil & activité');
    expect(libelles).not.toContain('Ma famille et mon profil');
    expect(libelles.indexOf('Mes enfants')).toBeGreaterThan(libelles.indexOf('Voir mon profil'));
    expect(useMesEnfantsEnBref.appels.every((options) => options.actif === false)).toBe(true);
  });
});

// PAR-L12 (13/10, design parent §2 bis, décision D6 A d'Adel du 12/10) — en MODE PARENT, un
// compte sportif lit « Mon compte » comme un parent : sa famille d'abord. Son rôle ne change pas.
describe('PAR-L12 — un joueur en mode parent lit « Mon compte » comme un parent', () => {
  const useMesEnfantsEnBref = jest
    .requireMock('@/views/profile/parent/useMesEnfantsEnBref').default;

  afterEach(() => {
    mockIsParentMode = false;
    useMesEnfantsEnBref.appels.length = 0;
  });

  it('« Ma famille et mon profil », « Mes enfants » en tête, et ses enfants comptés', async () => {
    mockIsParentMode = true;
    const libelles = await libellesDuMenu(ROLE_JOUEUR);

    expect(libelles).toContain('Ma famille et mon profil');
    expect(libelles.indexOf('Mes enfants')).toBeLessThan(libelles.indexOf('Voir mon profil'));
    expect(useMesEnfantsEnBref.appels.at(-1)).toEqual({ actif: true });
  });

  it('hors mode parent, son menu de joueur ne bouge pas', async () => {
    const libelles = await libellesDuMenu(ROLE_JOUEUR);

    expect(libelles).toContain('Profil & activité');
  });
});

// RW-PARENT (29/10, recette du site) — « Voir mon profil » ouvrait l'adresse littérale
// `/users/:userId` : sans identifiant, le site ne remplit pas le motif, et l'écran lisait
// « :userId » (404, « User not found »). Le téléphone acceptait l'appel nu ; le site non.
describe('RW-PARENT — « Voir mon profil » nomme le compte', () => {
  it('🔴 la navigation porte SON identifiant (le site en fait /users/<id>)', async () => {
    mockUserData = {
      club: null,
      documentId: 'user-doc-1',
      firstname: 'Nadia',
      multisportClubs: [],
      role: ROLE_PARENT,
    };
    const navigate = jest.fn();
    /** @type {any} */
    let arbre;
    await act(async () => {
      arbre = renderer.create(
        <Profile navigation={{ navigate, setParams: jest.fn() }} route={{ params: {} }} />,
      );
    });
    const rangee = arbre.root.findAll((/** @type {any} */ noeud) => (
      typeof noeud.props?.onPress === 'function'
      && aplatirTexte(noeud.props?.children).includes('Voir mon profil')
    )).at(-1);
    await act(async () => { rangee.props.onPress(); });

    expect(navigate).toHaveBeenCalledWith('UserDetails', { userId: 'user-doc-1' });
  });
});
