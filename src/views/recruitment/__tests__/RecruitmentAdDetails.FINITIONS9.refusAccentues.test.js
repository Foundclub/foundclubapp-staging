/* eslint-disable max-len -- les phrases du serveur sont citées en entier */
// I18N-4 : l'ecran lit ses textes par i18next (interpolation) ; ce temoin
// initialise le VRAI i18next en francais.
import '@/theme/strings';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Alert } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import RecruitmentAdDetails from '../RecruitmentAdDetails';

// FINITIONS9 · POINT 4 — « DÉJÀ ACCEPTÉE » : L'ÉCRAN COMPREND LE SERVEUR, AVEC OU SANS ACCENTS.
//
// Quand le serveur refuse une candidature parce qu'elle EXISTE déjà, la fiche pose tout de suite
// le bon état (« Je participe », « Demande en attente ») sans attendre la relecture. Elle le
// déduit de la PHRASE du refus. Le serveur passe de « Votre candidature est deja validee » à
// « Ta candidature est déjà validée » (admin fix/FINITIONS9-admin) : l'écran doit comprendre les
// deux, puisque la prod garde l'ancien serveur jusqu'à la publication groupée.
//
// Banc : celui de RecruitmentAdDetails.FINITIONS8.refusee.test.js (le VRAI service de
// recrutement, seul le client HTTP est double). Le refus a la forme que lui donne l'intercepteur
// HTTP (`services/client.native.js`) : la charge d'erreur Strapi deballee.

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

jest.mock('@/components/templates/ScreenContainer', () => {
  // eslint-disable-next-line global-require
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ props) => <View>{props.children}</View>,
  };
});
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
jest.mock('@/services/eventParticipation/eventParticipationService', () => ({
  acceptEventParticipation: jest.fn(),
  declineEventParticipation: jest.fn(),
  getEventParticipations: jest.fn(async () => ({ data: [] })),
}));
jest.mock('@/services/teamMembershipRequest/teamMembershipRequestService', () => ({
  inviteToTeam: jest.fn(),
  resolveTeamInvitationAvailability: () => ({ canInvite: false }),
}));

// Le client HTTP : la seule doublure du chemin de donnees.
const mockGet = jest.fn();
const mockPost = jest.fn();
jest.mock('@/services/client', () => ({
  __esModule: true,
  default: {
    get: (/** @type {any[]} */ ...args) => mockGet(...args),
    post: (/** @type {any[]} */ ...args) => mockPost(...args),
  },
}));

jest.mock('@/theme/colors', () => ({ withAlpha: (/** @type {any} */ color) => color }));
jest.mock('@/theme/themeContext', () => {
  /**
   * Echelle de style tolerante.
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

const HUGO = {
  documentId: 'u-hugo', id: null, myTeams: [], role: { name: 'Joueur' }, trainedTeams: [],
};
const TEAM = {
  club: { documentId: 'club-asm', name: 'AS Montrivage' },
  documentId: 'team-u15',
  name: 'U15',
};

// L'annonce TELLE QUE HUGO LA RECOIT avant d'avoir postule (ou quand sa candidature n'est pas
// encore relue) : `applications` vide (D10), `candidates` vide.
const ANNONCE = {
  applications: [],
  audienceType: 'player',
  author: { documentId: 'u-karim', id: 7 },
  candidates: [],
  createdAt: '2026-09-30T10:00:00.000Z',
  description: 'Annonce de test AUDIT V1.',
  documentId: 'ad-gardien',
  isActive: true,
  position: 'Gardien',
  team: TEAM,
};

/**
 * Le serveur de la recette, pour une liste « mes candidatures » donnee.
 * @param {any[] | Error} mesCandidatures Ce que rend GET /me/recruitment-applications.
 */
const brancherLeServeur = (mesCandidatures) => {
  mockGet.mockImplementation(async (/** @type {string} */ url) => {
    if (url === '/recruitment-ads/ad-gardien') return { data: { data: ANNONCE } };
    if (url === '/me/recruitment-applications') {
      if (mesCandidatures instanceof Error) throw mesCandidatures;
      return { data: { data: mesCandidatures } };
    }
    // Le repli de getMyApplications quand la route dediee tombe : il tombe aussi.
    if (url === '/recruitment-ads' && mesCandidatures instanceof Error) throw mesCandidatures;
    throw new Error(`GET inattendu : ${url}`);
  });
};

/** @type {any[]} */
let montes = [];

/**
 * Rend la fiche d'annonce pour Hugo.
 * @returns {Promise<any>} L'arbre rendu.
 */
const renderPourHugo = async () => {
  mockUseAuth.mockReturnValue({ userData: HUGO });
  mockRoute.params = { ad: ANNONCE, adId: ANNONCE.documentId };
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
 * Attend que les lectures (l'annonce, mes candidatures) soient revenues : react-query notifie
 * par un minuteur, un nombre fixe de tours ne suffit pas toujours (voir le point 10 de ce lot).
 * Attente BORNEE, sur l'etat visible : jamais un delai.
 * @param {any} tree L'arbre rendu.
 * @param {() => boolean} condition Ce qui doit etre vrai.
 * @returns {Promise<void>}
 */
const attendreQue = async (tree, condition) => {
  for (let tour = 0; tour < 50 && !condition(); tour += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => { await new Promise((fini) => { setTimeout(fini, 0); }); });
  }
};

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

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(async () => {
  await act(async () => {
    montes.forEach((tree) => tree.unmount());
  });
  montes = [];
});

/**
 * Hugo appuie sur « Postuler » ; le serveur refuse avec cette phrase.
 * @param {string} phrase Le message du 400.
 * @returns {Promise<any>} L'arbre rendu.
 */
const postulerEtEtreRefuse = async (phrase) => {
  brancherLeServeur([]);
  mockPost.mockRejectedValue({ message: phrase, name: 'BadRequestError', status: 400 });
  const tree = await renderPourHugo();
  await attendreQue(tree, () => Boolean(findButton(tree, 'Postuler')));
  await act(async () => { findButton(tree, 'Postuler').props.onPress(); });
  await attendreQue(tree, () => Alert.alert.mock.calls.length > 0);
  return tree;
};

describe('FINITIONS9 · point 4 — « déjà validée » : Hugo lit « Je participe »', () => {
  it.each([
    ['ANCIENNE forme (serveur de prod actuel)', 'Votre candidature est deja validee pour cette annonce.'],
    ['🚨 NOUVELLE forme (serveur accentué)', 'Ta candidature est déjà validée pour cette annonce.'],
  ])('%s', async (_forme, phrase) => {
    const tree = await postulerEtEtreRefuse(phrase);

    expect(findButton(tree, 'Je participe')?.props.disabled).toBe(true);
    expect(Alert.alert).toHaveBeenCalledWith('Candidature', phrase);
  });
});

describe('FINITIONS9 · point 4 — « déjà candidaté » : Hugo lit « Demande en attente »', () => {
  it.each([
    ['ANCIENNE forme (serveur de prod actuel)', 'Vous avez deja candidate sur ce poste.'],
    ['🚨 NOUVELLE forme (serveur accentué)', 'Tu as déjà candidaté sur ce poste.'],
  ])('%s', async (_forme, phrase) => {
    const tree = await postulerEtEtreRefuse(phrase);

    expect(findButton(tree, 'Demande en attente')?.props.disabled).toBe(true);
    expect(Alert.alert).toHaveBeenCalledWith('Candidature', phrase);
  });
});

describe('FINITIONS9 · point 4 — jumeau (ce qui ne bouge pas)', () => {
  it('un refus qui ne dit rien de l état (« poste complet ») laisse « Postuler »', async () => {
    const tree = await postulerEtEtreRefuse('Ce poste est déjà complet.');

    expect(findButton(tree, 'Postuler')).toBeDefined();
    expect(findButton(tree, 'Demande en attente')).toBeUndefined();
    expect(Alert.alert).toHaveBeenCalledWith('Candidature', 'Ce poste est déjà complet.');
  });
});
