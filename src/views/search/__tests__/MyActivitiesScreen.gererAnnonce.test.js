// I18N-4 : le fil de l'ecran lit ses textes par i18next ; ce temoin initialise
// le VRAI i18next en francais, sans rien changer a ce qu'il affirme.
import '@/theme/strings';
import renderer, { act } from 'react-test-renderer';

import MyActivitiesScreen from '../MyActivitiesScreen';

// GERER-ANNONCE (audit V1, A15/A16 — 2026-09-30).
//
// E6 : `MyActivitiesScreen.js` n'avait aucun test d'ecran (seul son fil,
// `domains/search/myActivitiesFeed.js`, est teste). Le premier bloc CARACTERISE
// ce qui ne bouge pas ; le second decrit « mes publications = les equipes que
// je GERE » : `getManagedTeamIds` lisait `myTeams`, qui liste les equipes ou
// l'on JOUE (schema utilisateur, `mappedBy: players`).
//
// Points d'observation : ce qui part vers les services, et la navigation.

// Le PREMIER montage charge a froid tout ce que l'ecran tire (mesure : 14 s sur
// une machine chargee, ~0,1 s pour les suivants) : 5 s par defaut le faisait
// tomber en « Exceeded timeout » sans rapport avec ce qu'il mesure.
jest.setTimeout(30000);

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

// `useFocusEffect` : l'ecran est considere comme au premier plan des le montage.
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (/** @type {any} */ callback) => {
    // eslint-disable-next-line global-require
    const { useEffect } = require('react');
    useEffect(() => callback(), [callback]);
  },
}));

jest.mock('@/components/templates/ScreenContainer', () => {
  // eslint-disable-next-line global-require
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ props) => <View>{props.children}</View>,
  };
});
jest.mock('@/components/atoms/loader/Loader', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/molecules/segmentedControl/SegmentedControl', () => {
  // eslint-disable-next-line global-require
  const { Text, View } = require('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ props) => (
      <View>
        {props.options.map((/** @type {any} */ option) => (
          <Text key={option.value}>
            {option.value === props.value ? `[${option.label}]` : option.label}
          </Text>
        ))}
      </View>
    ),
  };
});
jest.mock('@/components/atoms/emptyState/EmptyState', () => {
  // eslint-disable-next-line global-require
  const { Text } = require('react-native');
  return { __esModule: true, default: (/** @type {any} */ props) => <Text>{props.title}</Text> };
});

const mockNavigateOrExplainOnWeb = jest.fn();
jest.mock('@/navigation/webNavigationGuard', () => ({
  navigateOrExplainOnWeb: (/** @type {any} */ ...args) => mockNavigateOrExplainOnWeb(...args),
}));

// Doublures ENTIERES des services (piege L35 : `requireActual` charge le client
// HTTP, qui refuse de se charger sans API_URL dans une copie de travail).
const mockGetMyRecruitmentAds = jest.fn();
const mockGetMyApplications = jest.fn();
jest.mock('@/services/recruitment/recruitmentService', () => ({
  getMyApplications: (/** @type {any} */ user) => mockGetMyApplications(user),
  getMyRecruitmentAds: (/** @type {any} */ filters) => mockGetMyRecruitmentAds(filters),
}));
const mockGetMyFriendlyMatchAds = jest.fn();
const mockGetMyFriendlyMatchApplications = jest.fn();
jest.mock('@/services/friendlyMatch/friendlyMatchService', () => ({
  getMyFriendlyMatchAds: (/** @type {any} */ filters) => mockGetMyFriendlyMatchAds(filters),
  getMyFriendlyMatchApplications: (/** @type {any} */ teamIds) => (
    mockGetMyFriendlyMatchApplications(teamIds)
  ),
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
      Colors: new Proxy({}, {
        get: (/** @type {any} */ _t, /** @type {any} */ key) => String(key),
      }),
      Fonts: anyScale(),
      Spaces: anyScale(),
    }),
  };
});

const EQUIPE_ENTRAINEE = {
  club: { documentId: 'club-a' }, documentId: 'team-entrainee', name: 'U15',
};
const EQUIPE_OU_IL_JOUE = {
  club: { documentId: 'club-b' }, documentId: 'team-ou-il-joue', name: 'Seniors',
};
const COACH = {
  documentId: 'u-coach',
  myTeams: [],
  role: { name: 'Entraineur' },
  trainedTeams: [EQUIPE_ENTRAINEE],
};

const ANNONCE = {
  applications: [],
  documentId: 'ad-1',
  isActive: true,
  team: EQUIPE_ENTRAINEE,
  title: 'Defenseur central',
};

const navigation = { navigate: jest.fn() };

/** @type {any[]} */
let montes = [];

/**
 * Monte l'ecran pour un compte donne.
 * @param {any} userData Le compte connecte.
 * @returns {Promise<any>} L'arbre rendu.
 */
const renderFor = async (userData) => {
  mockUseAuth.mockReturnValue({ userData });
  let tree;
  await act(async () => {
    tree = renderer.create(<MyActivitiesScreen navigation={navigation} />);
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

beforeEach(() => {
  jest.clearAllMocks();
  mockGetMyRecruitmentAds.mockResolvedValue([]);
  mockGetMyFriendlyMatchAds.mockResolvedValue([]);
  mockGetMyApplications.mockResolvedValue([]);
  mockGetMyFriendlyMatchApplications.mockResolvedValue([]);
});

afterEach(async () => {
  await act(async () => {
    montes.forEach((tree) => tree.unmount());
  });
  montes = [];
});

describe('MyActivitiesScreen — caracterisation (ce qui ne bouge pas)', () => {
  it('un ENTRAINEUR ouvre sur « Publications », filtrees sur son equipe', async () => {
    const tree = await renderFor(COACH);

    expect(allText(tree)).toContain('[Publications]');
    expect(mockGetMyRecruitmentAds).toHaveBeenCalledWith({ teamIds: ['team-entrainee'] });
    expect(mockGetMyFriendlyMatchAds).toHaveBeenCalledWith({ teamIds: ['team-entrainee'] });
    expect(mockGetMyApplications).not.toHaveBeenCalled();
  });

  it('un staff sans equipe retombe sur SES annonces (auteur)', async () => {
    await renderFor({ documentId: 'u-dirigeant', role: { name: 'Dirigeant' } });

    expect(mockGetMyRecruitmentAds).toHaveBeenCalledWith({ authorDocumentId: 'u-dirigeant' });
  });

  it('une publication ouvre la fiche de l annonce', async () => {
    mockGetMyRecruitmentAds.mockResolvedValue([ANNONCE]);
    const tree = await renderFor(COACH);

    const carte = tree.root.findAll(
      (/** @type {any} */ node) => typeof node.props?.onPress === 'function'
        && node.props?.accessibilityRole === 'button',
    )[0];
    await act(async () => { carte.props.onPress(); });

    expect(navigation.navigate).toHaveBeenCalledWith(
      'RecruitmentAdDetails',
      expect.objectContaining({ ad: ANNONCE }),
    );
  });

  it('un JOUEUR ouvre sur « Mes reponses » et lit SES candidatures', async () => {
    const joueur = {
      documentId: 'u-joueur', myTeams: [], role: { name: 'Joueur' }, trainedTeams: [],
    };
    const tree = await renderFor(joueur);

    expect(allText(tree)).toContain('[Mes réponses]');
    expect(mockGetMyApplications).toHaveBeenCalledWith(joueur);
    expect(mockGetMyRecruitmentAds).not.toHaveBeenCalled();
  });
});

describe('MyActivitiesScreen — GERER-ANNONCE : mes publications = mes equipes GEREES', () => {
  it('un entraineur qui JOUE ailleurs ne recoit pas les annonces de cette equipe-la', async () => {
    await renderFor({
      documentId: 'u-coach',
      myTeams: [EQUIPE_OU_IL_JOUE],
      role: { name: 'Entraineur' },
      trainedTeams: [EQUIPE_ENTRAINEE],
    });

    expect(mockGetMyRecruitmentAds).toHaveBeenCalledWith({ teamIds: ['team-entrainee'] });
    expect(mockGetMyFriendlyMatchAds).toHaveBeenCalledWith({ teamIds: ['team-entrainee'] });
  });

  it('un dirigeant qui JOUE dans une equipe de SON club la garde', async () => {
    const equipeDeSonClub = { club: { documentId: 'club-d' }, documentId: 'team-du-club' };
    await renderFor({
      club: { documentId: 'club-d' },
      documentId: 'u-dirigeant',
      myTeams: [equipeDeSonClub],
      role: { name: 'Dirigeant' },
    });

    expect(mockGetMyRecruitmentAds).toHaveBeenCalledWith({ teamIds: ['team-du-club'] });
  });

  it('un JOUEUR ne recoit pas les propositions de son equipe comme les siennes', async () => {
    await renderFor({
      documentId: 'u-joueur', myTeams: [EQUIPE_OU_IL_JOUE], role: { name: 'Joueur' },
    });

    expect(mockGetMyFriendlyMatchApplications).toHaveBeenCalledWith([]);
  });
});
