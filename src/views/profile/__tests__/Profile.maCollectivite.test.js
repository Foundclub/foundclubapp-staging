import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import Profile from '../Profile';

// 🏛️ COLLECTIVITES 1c — ECRAN 1 : LA PORTE D ENTREE « Ma collectivite ».
//
// Ce que ce temoin fige (ROUGE avant le lot : la rangee n existait pas) :
//   - un compte GESTIONNAIRE d une collectivite (`/collectivites/mine` non vide) voit
//     « Ma collectivite · <nom> » dans « Mon compte », et l appui ouvre l accueil de
//     CETTE collectivite ;
//   - tout autre compte (`/collectivites/mine` vide, ou pas encore lu) ne la voit pas ;
//   - la porte ne depend NI du club NI du role : un agent municipal n a souvent aucun club
//     et garde le role qu il avait (ici « Authenticated »).
// Le serveur reste le seul juge derriere la porte (policy is-gestionnaire-collectivite).
//
// Pilote par le TEXTE VISIBLE, et `t` resout dans le VRAI `fr.js` (interpolation comprise) :
// une cle absente ferait echouer le test au lieu de le rendre vert a vide.

/** @type {any} */
let mockUserData;
/** @type {any} */
let mockCollectivites;
/** @type {any} */
let mockRequetes = [];

// PAR-L7 (13/10) — « Mon compte » d'un parent compte ses enfants (`useMesEnfantsEnBref`, qui lit
// trois services) : doublure commune, « aucun enfant ».
jest.mock('@/views/profile/parent/useMesEnfantsEnBref');

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
      t: (/** @type {string} */ cle, /** @type {any} */ repli, /** @type {any} */ options) => {
        const valeur = String(cle || '')
          .split('.')
          .reduce((noeud, segment) => (noeud == null ? undefined : noeud[segment]), catalogue);
        let texte = cle;
        if (typeof valeur === 'string') texte = valeur;
        else if (typeof repli === 'string') texte = repli;
        return texte.replace(/\{\{(\w+)\}\}/g, (_tout, nom) => String(options?.[nom] ?? ''));
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

jest.mock('@/services/auth/authService', () => ({
  deleteAccount: jest.fn(),
}));

// La lecture de la porte : `/collectivites/mine`, telle que le hook la rend.
// COLL-ACCUEIL (01/10) : la pastille de la rangee lit les demandes en attente.
// RESA-L6B-1 — le nombre de « Mes réservations » (rangée cachée par COMPLEXES_JOUEUR) lit le
// serveur des complexes : doublé ici comme les autres services de « Mon compte ».
jest.mock('@/views/reserverTerrain/components/NombreAVenir', () => () => null);
jest.mock('@/services/collectivite/collectiviteQueries', () => ({
  useCollectiviteRequests: () => ({ data: mockRequetes }),
  useMyCollectivites: () => ({ data: mockCollectivites, isLoading: false }),
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
 * Aplati les enfants React en une chaine, pour lire le texte rendu.
 * @param {any} enfants
 * @returns {string}
 */
const aplatirTexte = (enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatirTexte).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatirTexte(enfants?.props?.children);
  return String(enfants);
};

const VILLE = { documentId: 'ville-de-recette', name: 'Ville de Recette', type: 'commune' };
const ROLE_AUTHENTICATED = { name: 'Authenticated', type: 'authenticated' };
const ROLE_DIRIGEANT = { name: 'Dirigeant', type: 'dirigeant' };

/**
 * Monte « Mon compte » pour un compte SANS club.
 * @param {{ name: string, type: string }} role - Le role du compte.
 * @param {any} collectivites - Ce que `/collectivites/mine` rend.
 * @returns {Promise<{ arbre: any, navigate: jest.Mock, libelles: string[] }>} Le rendu.
 */
const monterProfil = async (role, collectivites) => {
  mockUserData = {
    club: null,
    documentId: 'agent-1',
    firstname: 'Agnes',
    lastname: 'Mairie',
    multisportClubs: [],
    role,
  };
  mockCollectivites = collectivites;
  const navigate = jest.fn();
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <Profile navigation={{ navigate, setParams: jest.fn() }} route={{ params: {} }} />,
    );
  });
  const libelles = arbre.root.findAllByType(Text)
    .map((/** @type {any} */ n) => aplatirTexte(n.props.children).trim());
  return { arbre, libelles, navigate };
};

const rangeePortant = (/** @type {any} */ arbre, /** @type {string} */ libelle) => arbre.root
  .findAllByType(TouchableOpacity)
  .find((/** @type {any} */ noeud) => noeud
    .findAllByType(Text)
    .some((/** @type {any} */ texte) => aplatirTexte(texte.props.children).trim() === libelle));

// 🏛️ COLL-ACCUEIL (01/10/2026) — PLANCHE 4 « Mon compte, la porte secondaire » (P1-porte-tel).
// La rangée de la Ville reste en tête de « Profil & activité » : le NOM de la Ville en titre,
// « Ma collectivité » dessous, la PASTILLE des demandes. Elle ouvre l'espace de la Ville
// (barre Accueil · Demandes · Planning · Messages). Compte « Ville seule » : « Gestionnaire ·
// Ville de … » sous le nom, aucune rangée sportive. Compte mixte : tout reste, la rangée en plus.
// ROUGE avant le lot (rangée « Ma collectivité · <nom> » vers l'accueil seul, « Membre »).
const CATALOGUE = jest.requireActual('@/theme/strings/translations/fr').default;
const SPORTIVES = ['myCard', 'sportsHistory', 'myLicenses', 'myChildren', 'manageAlerts']
  .map((cle) => CATALOGUE.profile.actions[cle]);

describe('COLL-ACCUEIL — planche 4 : « Mon compte », la porte secondaire', () => {
  beforeEach(() => { mockRequetes = []; });

  it('la rangée porte le NOM de la Ville, « Ma collectivité » dessous', async () => {
    const { libelles } = await monterProfil(ROLE_AUTHENTICATED, [VILLE]);
    expect(libelles).toEqual(expect.arrayContaining(['Ville de Recette', 'Ma collectivité']));
  });

  it('la pastille dit le nombre de demandes en attente', async () => {
    mockRequetes = [{ documentId: 'rq-1' }, { documentId: 'rq-2' }];
    const { arbre } = await monterProfil(ROLE_AUTHENTICATED, [VILLE]);
    const [pastille] = arbre.root.findAll((/** @type {any} */ n) => typeof n.type === 'string'
      && n.props?.testID === 'collectivite-ville-de-recette-compteur');
    expect(pastille).toBeDefined();
    expect(aplatirTexte(pastille.props.children)).toBe('2');
  });

  it('compte Ville seule : l appui REVIENT à l espace de la Ville (sa racine)', async () => {
    const { arbre, navigate } = await monterProfil(ROLE_AUTHENTICATED, [VILLE]);
    await act(async () => {
      rangeePortant(arbre, 'Ville de Recette').props.onPress();
    });
    expect(navigate).toHaveBeenCalledWith(
      'CollectiviteSpace',
      { collectiviteId: 'ville-de-recette' },
      { pop: true },
    );
  });

  it('Ville seule : « Gestionnaire · Ville de Recette », AUCUNE rangée sportive', async () => {
    const { libelles } = await monterProfil(ROLE_AUTHENTICATED, [VILLE]);
    expect(libelles).toContain('Gestionnaire · Ville de Recette');
    SPORTIVES.forEach((rangee) => expect(libelles).not.toContain(rangee));
    // Le compte, lui, reste : changer de compte, nous contacter.
    expect(libelles).toContain(CATALOGUE.profile.actions.contactSupport);
  });

  it('compte mixte : tout reste ; la rangée ouvre la Ville avec « ‹ Mon compte »', async () => {
    const { arbre, libelles, navigate } = await monterProfil(ROLE_DIRIGEANT, [VILLE]);
    expect(libelles).toContain(CATALOGUE.profile.actions.myCard);
    expect(libelles).not.toContain('Gestionnaire · Ville de Recette');
    await act(async () => {
      rangeePortant(arbre, 'Ville de Recette').props.onPress();
    });
    expect(navigate).toHaveBeenCalledWith(
      'CollectiviteSpace',
      { collectiviteId: 'ville-de-recette', returnLabel: 'Mon compte' },
      { pop: true },
    );
  });

  it.each([
    ['un dirigeant de club', ROLE_DIRIGEANT, []],
    ['un compte sans rôle', ROLE_AUTHENTICATED, []],
    ['une lecture pas encore arrivée', ROLE_AUTHENTICATED, undefined],
  ])('%s ne voit AUCUNE porte', async (_nom, role, collectivites) => {
    const { libelles } = await monterProfil(role, collectivites);
    expect(libelles).not.toContain('Ville de Recette');
    expect(libelles.some((libelle) => libelle.startsWith('Ma collectivité'))).toBe(false);
  });
});
