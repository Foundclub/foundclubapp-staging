// I18N-4 : l'ecran lit ses textes par i18next (interpolation) ; ce temoin
// initialise le VRAI i18next en francais, sans rien changer a ce qu'il affirme.
import '@/theme/strings';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import renderer, { act } from 'react-test-renderer';

import RecruitmentAdDetails from '../RecruitmentAdDetails';

// GERER-ANNONCE (audit V1, A15 / A16 — 2026-09-30).
//
// E6 : `RecruitmentAdDetails.js` (1 947 lignes) n'avait AUCUN test. Le premier
// bloc CARACTERISE ce que l'ecran fait deja et qui ne doit pas bouger ; le
// second decrit la regle « je gere cette equipe », alignee sur le serveur :
//   admin/src/api/recruitment-ad/policies/can-manage-recruitment-ad.ts:50-59
//   = `teamAuth.canManageTeam(equipe de l'annonce)` OU auteur de l'annonce,
//   et `canManageTeam` = entraineur de l'equipe OU dirigeant/president du club
//   (admin/src/api/team/services/auth.ts:92-113).
//
// La couture est le TEXTE VISIBLE (« Modifier », « Avis de recherche »,
// « Postuler ») et ce qui part sur la navigation — jamais la forme de l'arbre.

jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));
jest.mock('i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').i18next
));

const mockUseAuth = jest.fn();
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => mockUseAuth(),
}));

const mockNavigation = { navigate: jest.fn(), setOptions: jest.fn() };
const mockRoute = { params: {} };
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => mockRoute,
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 34, left: 0, right: 0, top: 59,
  }),
}));

// Meme raison que FriendlyMatchAdDetails.test.js : le conteneur d'ecran traine
// des paquets ESM purs, et il n'est pas l'objet du temoin.
jest.mock('@/components/templates/ScreenContainer', () => {
  // eslint-disable-next-line global-require
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ props) => <View>{props.children}</View>,
  };
});

// Doublure de feuille qui rend TOUS ses emplacements (piege D86), et seulement
// quand elle est ouverte.
jest.mock('@/components/molecules/bottomModal/BottomModal', () => {
  // eslint-disable-next-line global-require
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ props) => (props.isVisible ? (
      <View>
        {props.headerComponent || null}
        {props.children}
        {props.footerComponent || null}
      </View>
    ) : null),
  };
});

// `Checkable` importe `react-native-bouncy-checkbox`, publie en ESM pur.
jest.mock('@/components/atoms/checkable/Checkable', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/components/molecules/clubLogoMark/ClubLogoMark', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/components/molecules/profileAvatar/ProfileAvatar', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('react-native-linear-gradient', () => {
  // eslint-disable-next-line global-require
  const { View } = require('react-native');
  return { __esModule: true, default: (/** @type {any} */ props) => <View>{props.children}</View> };
});

jest.mock('@/navigation/navigationAvailability', () => ({
  navigateToStackScreenOrScreen: jest.fn(),
}));
jest.mock('@/navigation/public/publicAuthNavigation', () => ({ openPublicAuthFlow: jest.fn() }));
jest.mock('@/utils/shareLinks', () => ({
  buildPublicWebUrl: (/** @type {any} */ { path }) => `https://site.test${path}`,
}));

// Doublure ENTIERE du service (piege L35 : `requireActual` charge le client HTTP,
// qui refuse de se charger sans API_URL dans une copie de travail).
const mockGetRecruitmentAd = jest.fn();
const mockGetRecruitmentApplications = jest.fn();
jest.mock('@/services/recruitment/recruitmentService', () => ({
  applyToRecruitmentAd: jest.fn(),
  deleteRecruitmentAd: jest.fn(),
  getRecruitmentAd: (/** @type {any} */ id) => mockGetRecruitmentAd(id),
  getRecruitmentApplications: (/** @type {any} */ id) => mockGetRecruitmentApplications(id),
  resolveRecruitmentAdApplicationState: () => ({
    linkedRecruitmentAdDocumentId: null,
    status: null,
  }),
  updateRecruitmentApplicationStatus: jest.fn(),
  withdrawRecruitmentApplication: jest.fn(),
}));
const mockGetEventParticipations = jest.fn();
jest.mock('@/services/eventParticipation/eventParticipationService', () => ({
  acceptEventParticipation: jest.fn(),
  declineEventParticipation: jest.fn(),
  getEventParticipations: (/** @type {any} */ ...args) => mockGetEventParticipations(...args),
}));
jest.mock('@/services/teamMembershipRequest/teamMembershipRequestService', () => ({
  inviteToTeam: jest.fn(),
  resolveTeamInvitationAvailability: () => ({ canInvite: false }),
}));

jest.mock('@/theme/colors', () => ({ withAlpha: (/** @type {any} */ color) => color }));
jest.mock('@/theme/themeContext', () => {
  /**
   * Echelle de style tolerante : un enfant qui demande une valeur inattendue ne
   * doit pas faire tomber le filet.
   * @returns {any}
   */
  const anyScale = () => new Proxy({}, {
    get: (/** @type {any} */ _target, /** @type {any} */ key) => (
      typeof key === 'symbol' ? undefined : anyScale()
    ),
  });

  return {
    __esModule: true,
    default: () => ({
      Alignments: anyScale(),
      ApplicationStyle: anyScale(),
      Colors: new Proxy({}, {
        get: (/** @type {any} */ _t, /** @type {any} */ key) => String(key),
      }),
      Fonts: anyScale(),
      Images: anyScale(),
      Spaces: anyScale(),
    }),
  };
});

const CLUB = { documentId: 'club-mfc', name: 'Montrivage FC' };
const TEAM = { club: CLUB, documentId: 'team-u15', name: 'U15' };

const AD = {
  applications: [],
  author: { documentId: 'u-auteur', id: 7 },
  createdAt: '2026-09-01T10:00:00.000Z',
  description: 'L equipe cherche un defenseur central pour la saison.',
  documentId: 'ad-u15',
  isActive: true,
  team: TEAM,
  title: 'Defenseur central',
};

// Les comptes, tels que `sanitizeUser` les rend (`id` a null quand absent).
const JOUEUR_DE_L_EQUIPE = {
  documentId: 'u-joueur', id: null, myTeams: [TEAM], role: { name: 'Joueur' }, trainedTeams: [],
};
const ENTRAINEUR_DE_L_EQUIPE = {
  documentId: 'u-coach', id: null, myTeams: [], role: { name: 'Entraineur' }, trainedTeams: [TEAM],
};
const DIRIGEANT_DU_CLUB = {
  club: CLUB,
  documentId: 'u-dirigeant',
  id: null,
  myTeams: [],
  role: { name: 'Dirigeant' },
  trainedTeams: [],
};
const AUTEUR_HORS_EQUIPE = {
  documentId: 'u-auteur', id: null, myTeams: [], role: { name: 'Entraineur' }, trainedTeams: [],
};
const TIERS = {
  documentId: 'u-tiers', id: null, myTeams: [], role: { name: 'Joueur' }, trainedTeams: [],
};
// Un dirigeant d'un AUTRE club qui JOUE dans l'equipe : il n'en gere rien.
const DIRIGEANT_AILLEURS_JOUEUR_ICI = {
  club: { documentId: 'club-autre', name: 'Autre club' },
  documentId: 'u-dirigeant-ailleurs',
  id: null,
  myTeams: [TEAM],
  role: { name: 'Dirigeant' },
  trainedTeams: [],
};

/** @type {any[]} */
let montes = [];

/**
 * Rend la fiche d'annonce pour un compte donne.
 * @param {any} userData Le compte connecte.
 * @param {any} [ad] L'annonce.
 * @returns {Promise<any>} L'arbre rendu.
 */
const renderFor = async (userData, ad = AD) => {
  mockUseAuth.mockReturnValue({ userData });
  mockRoute.params = { ad, adId: ad.documentId };
  mockGetRecruitmentAd.mockResolvedValue(ad);
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  let tree;
  await act(async () => {
    tree = renderer.create(
      <QueryClientProvider client={queryClient}>
        <RecruitmentAdDetails />
      </QueryClientProvider>,
    );
  });
  montes.push(tree);
  return tree;
};

/**
 * Tous les textes rendus, aplatis.
 * @param {any} node Un noeud du JSON rendu.
 * @returns {string[]} Les textes.
 */
const collectText = (node) => {
  if (node === null || node === undefined) return [];
  if (typeof node === 'string') return [node];
  if (Array.isArray(node)) return node.flatMap(collectText);
  return collectText(node.children);
};

/**
 * Le texte visible, en une chaine cherchable.
 * @param {any} tree L'arbre rendu.
 * @returns {string} Le texte.
 */
const allText = (tree) => collectText(tree.toJSON()).join(' | ');

/**
 * Le bouton qui porte ce libelle (le `title` de `Button`).
 * @param {any} tree L'arbre rendu.
 * @param {string} title Le libelle.
 * @returns {any} Le noeud, ou undefined.
 */
const findButton = (tree, title) => tree.root.findAll(
  (/** @type {any} */ node) => typeof node.type !== 'string' && node.props?.title === title,
  { deep: true },
)[0];

const OUTILS_DU_CLUB = ['Modifier', 'Avis de recherche', 'Supprimer'];

/**
 * Les outils de l'equipe qui recrute, presents dans le rendu.
 * @param {any} tree L'arbre rendu.
 * @returns {string[]} Les libelles trouves.
 */
const outilsVisibles = (tree) => OUTILS_DU_CLUB.filter((title) => Boolean(findButton(tree, title)));

beforeEach(() => {
  jest.clearAllMocks();
  mockGetRecruitmentApplications.mockResolvedValue([]);
  mockGetEventParticipations.mockResolvedValue({ data: [] });
});

afterEach(async () => {
  await act(async () => {
    montes.forEach((tree) => tree.unmount());
  });
  montes = [];
});

describe('RecruitmentAdDetails — caracterisation (ce qui ne bouge pas)', () => {
  it('l AUTEUR de l annonce voit les outils du club, sans « Postuler »', async () => {
    const tree = await renderFor(AUTEUR_HORS_EQUIPE);

    expect(outilsVisibles(tree)).toEqual(OUTILS_DU_CLUB);
    expect(findButton(tree, 'Postuler')).toBeUndefined();
  });

  it('l ENTRAINEUR de l equipe voit les outils du club et les candidatures', async () => {
    const tree = await renderFor(ENTRAINEUR_DE_L_EQUIPE);

    expect(outilsVisibles(tree)).toEqual(OUTILS_DU_CLUB);
    expect(allText(tree)).toContain('Candidatures (0)');
    expect(mockGetRecruitmentApplications).toHaveBeenCalledWith('ad-u15');
  });

  it('un TIERS voit « Postuler », sans outils ni candidatures', async () => {
    const tree = await renderFor(TIERS);

    expect(outilsVisibles(tree)).toEqual([]);
    expect(findButton(tree, 'Postuler')).toBeDefined();
    expect(allText(tree)).not.toContain('Candidatures (');
    expect(mockGetRecruitmentApplications).not.toHaveBeenCalled();
  });

  it('« Modifier » ouvre l edition de CETTE annonce', async () => {
    const tree = await renderFor(ENTRAINEUR_DE_L_EQUIPE);

    await act(async () => { findButton(tree, 'Modifier').props.onPress(); });

    expect(mockNavigation.navigate)
      .toHaveBeenCalledWith('RecruitmentAdEdit', { ad: AD, adId: 'ad-u15' });
  });

  it('« Avis de recherche » ouvre l affiche de CETTE annonce', async () => {
    const tree = await renderFor(ENTRAINEUR_DE_L_EQUIPE);

    await act(async () => { findButton(tree, 'Avis de recherche').props.onPress(); });

    expect(mockNavigation.navigate).toHaveBeenCalledWith('VisualShowcase', expect.objectContaining({
      subjectId: 'ad-u15',
      subjectType: 'recruitment-ad',
      template: 'avis-de-recherche',
    }));
  });
});

describe('RecruitmentAdDetails — GERER-ANNONCE : seul qui GERE l equipe a les outils', () => {
  it('A15/A16 — un JOUEUR de l equipe voit « Postuler », sans les outils du club', async () => {
    const tree = await renderFor(JOUEUR_DE_L_EQUIPE);

    expect(outilsVisibles(tree)).toEqual([]);
    expect(findButton(tree, 'Postuler')).toBeDefined();
    // Le bloc que le serveur lui refuse (recruitment-ad-custom.ts:609-640) ne
    // s'affiche plus, et la lecture ne part meme pas.
    expect(allText(tree)).not.toContain('Candidatures (');
    expect(mockGetRecruitmentApplications).not.toHaveBeenCalled();
  });

  it('un DIRIGEANT du club de l equipe, qui ne l entraine pas, a les outils', async () => {
    const tree = await renderFor(DIRIGEANT_DU_CLUB);

    expect(outilsVisibles(tree)).toEqual(OUTILS_DU_CLUB);
    expect(findButton(tree, 'Postuler')).toBeUndefined();
  });

  it('un dirigeant d un AUTRE club qui JOUE dans l equipe n a pas les outils', async () => {
    const tree = await renderFor(DIRIGEANT_AILLEURS_JOUEUR_ICI);

    expect(outilsVisibles(tree)).toEqual([]);
  });
});
