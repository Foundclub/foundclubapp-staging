// I18N-4 : le fil de l'ecran lit ses textes par i18next ; ce temoin initialise
// le VRAI i18next en francais, sans rien changer a ce qu'il affirme.
import '@/theme/strings';
import renderer, { act } from 'react-test-renderer';

import MyActivitiesScreen from '../MyActivitiesScreen';

// MES-CANDIDATURES (audit V1, A12 + A13 — 01/10).
//
// 🔴 A12, l'auditeur : « Bizarre que quand on ouvre ça se nomme finalement Mes
// activités. » La case dit « Mes reponses », la page dit « Mes activites », avec un
// onglet « Publications » VIDE POUR TOUJOURS chez un joueur (il ne publie rien).
// ✅ Decision d'Adel (30/09) : pour le JOUEUR, « Mes candidatures », une seule
// liste sans onglet. ⚠️ Pour l'ENTRAINEUR (et le dirigeant), « Mes activites »
// RESTE : il a des PUBLICATIONS. « Ne pas faire l'amalgame. »
//
// 🔴 A13 : la pastille rouge doit s'eteindre quand la personne a VU les reponses.
// ✅ Ouvrir « Mes candidatures » marque vues, cote serveur, les notifications de
// reponse a mes candidatures — UNE requete, et seulement si la liste a pu se lire.
//
// Meme banc que `MyActivitiesScreen.gererAnnonce.test.js` (services doubles EN
// ENTIER : piege L35, le client HTTP ne se charge pas sans API_URL).

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
      <View testID="onglets">
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
  return {
    __esModule: true,
    default: (/** @type {any} */ props) => <Text>{`${props.title} ${props.description}`}</Text>,
  };
});

jest.mock('@/navigation/webNavigationGuard', () => ({ navigateOrExplainOnWeb: jest.fn() }));

// Le medaillon du club (logo, sinon initiales) : son rendu reel est teste chez lui ;
// ici on regarde a QUI il est donne.
jest.mock('@/components/molecules/clubLogoMark/ClubLogoMark', () => {
  // eslint-disable-next-line global-require
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ props) => <Text>{`logo:${props.club?.name}`}</Text>,
  };
});

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
const mockMarkApplicationResponsesAsRead = jest.fn();
jest.mock('@/services/notification/notificationService', () => ({
  markApplicationResponsesAsRead: () => mockMarkApplicationResponsesAsRead(),
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
 * Le texte visible, en une chaine cherchable (espaces insecables ramenees a des
 * espaces : les pastilles d'etat en portent, parade Android 16).
 * @param {any} tree L'arbre rendu.
 * @returns {string} Le texte.
 */
const allText = (tree) => collectText(tree.toJSON()).join(' | ').replace(/\u00a0/g, ' ');

const JOUEUR = {
  documentId: 'u-joueur', myTeams: [], role: { name: 'Joueur' }, trainedTeams: [],
};
const ENTRAINEUR = {
  documentId: 'u-coach',
  myTeams: [],
  role: { name: 'Entraineur' },
  trainedTeams: [{ club: { documentId: 'club-a' }, documentId: 'team-a', name: 'U15' }],
};

const candidatureEnAttente = {
  applicationStatus: 'pending',
  documentId: 'ad-attente',
  myApplication: { createdAt: '2026-09-12T10:00:00', status: 'pending' },
  position: 'Défenseur central',
  team: { club: { name: 'Montrivage FC' }, name: 'Seniors A' },
};
const candidatureAcceptee = {
  applicationStatus: 'accepted',
  documentId: 'ad-acceptee',
  myApplication: {
    createdAt: '2026-09-20T10:00:00', reviewedAt: '2026-09-28T09:00:00', status: 'accepted',
  },
  position: 'Gardien de but',
  team: { club: { name: 'AS Montrivage' }, name: 'Seniors B' },
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetMyRecruitmentAds.mockResolvedValue([]);
  mockGetMyFriendlyMatchAds.mockResolvedValue([]);
  mockGetMyApplications.mockResolvedValue([]);
  mockGetMyFriendlyMatchApplications.mockResolvedValue([]);
  mockMarkApplicationResponsesAsRead.mockResolvedValue({ ok: true, updated: 0 });
});

afterEach(async () => {
  await act(async () => {
    montes.forEach((tree) => tree.unmount());
  });
  montes = [];
});

describe('A12 — le JOUEUR ouvre « Mes candidatures », une seule liste', () => {
  it('LE TEMOIN : la page s appelle « Mes candidatures », sans onglet « Publications »', async () => {
    const tree = await renderFor(JOUEUR);
    const texte = allText(tree);

    expect(texte).toContain('Mes candidatures');
    expect(texte).not.toContain('Mes activités');
    expect(texte).not.toContain('Publications');
    expect(tree.root.findAll((/** @type {any} */ n) => n.props?.testID === 'onglets')).toHaveLength(0);
  });

  it('elle range en « En attente » puis « Reponses recues », avec date et etat par ligne', async () => {
    mockGetMyApplications.mockResolvedValue([candidatureAcceptee, candidatureEnAttente]);
    const tree = await renderFor(JOUEUR);
    const texte = allText(tree);

    expect(texte).toContain('En attente · 1');
    expect(texte).toContain('Réponses reçues · 1');
    expect(texte).toMatch(/Montrivage FC · envoyée le 12\/09/);
    expect(texte).toMatch(/AS Montrivage · réponse le 28\/09/);
    expect(texte).toContain('En attente du club');
    expect(texte).toContain('Acceptée');
    expect(texte.indexOf('En attente · 1')).toBeLessThan(texte.indexOf('Réponses reçues · 1'));
  });

  it('chaque ligne porte le medaillon de SON club (maquette APRES de A12)', async () => {
    mockGetMyApplications.mockResolvedValue([candidatureAcceptee, candidatureEnAttente]);
    const tree = await renderFor(JOUEUR);
    const texte = allText(tree);

    expect(texte).toContain('logo:Montrivage FC');
    expect(texte).toContain('logo:AS Montrivage');
  });

  it('sa page vide parle de CANDIDATURES, plus de « ce que tu as publie »', async () => {
    const tree = await renderFor(JOUEUR);
    const texte = allText(tree);

    expect(texte).toContain('Aucune candidature pour le moment.');
    expect(texte).not.toContain('publié');
  });

  it('une ligne ouvre toujours la fiche de l annonce, en visiteur', async () => {
    mockGetMyApplications.mockResolvedValue([candidatureEnAttente]);
    const tree = await renderFor(JOUEUR);

    const carte = tree.root.findAll(
      (/** @type {any} */ n) => typeof n.props?.onPress === 'function'
        && n.props?.accessibilityRole === 'button',
    )[0];
    await act(async () => { carte.props.onPress(); });

    // FINITIONS18 · POINT 5 (T16) : `adId` aussi, que l'adresse du site porte (`/recruitment/:adId`).
    expect(navigation.navigate).toHaveBeenCalledWith('RecruitmentAdDetails', {
      ad: candidatureEnAttente, adId: 'ad-attente', isOwner: false,
    });
  });
});

describe('A13 — ouvrir « Mes candidatures » marque les reponses VUES', () => {
  it('LE TEMOIN : la liste lue, les reponses sont marquees vues, en UNE requete', async () => {
    mockGetMyApplications.mockResolvedValue([candidatureAcceptee]);
    await renderFor(JOUEUR);

    expect(mockMarkApplicationResponsesAsRead).toHaveBeenCalledTimes(1);
  });

  it('serveur injoignable : rien n est marque vu (la personne n a rien vu)', async () => {
    mockGetMyApplications.mockRejectedValue(new Error('hors ligne'));
    mockGetMyFriendlyMatchApplications.mockRejectedValue(new Error('hors ligne'));
    await renderFor(JOUEUR);

    expect(mockMarkApplicationResponsesAsRead).not.toHaveBeenCalled();
  });

  it('un echec du marquage ne casse pas la page', async () => {
    mockGetMyApplications.mockResolvedValue([candidatureEnAttente]);
    mockMarkApplicationResponsesAsRead.mockRejectedValue(new Error('500'));
    const tree = await renderFor(JOUEUR);

    expect(allText(tree)).toContain('En attente · 1');
  });

  it('l ENTRAINEUR ne marque rien : sa page ne montre pas SES candidatures', async () => {
    await renderFor(ENTRAINEUR);

    expect(mockMarkApplicationResponsesAsRead).not.toHaveBeenCalled();
  });
});

// LE TABLEAU PAR ROLE demande par le prompt : « rien d'un role ne disparait pour
// un autre ». Chaque ligne dit le titre, les onglets, et CE QUI EST CHARGE — une
// source qui cesserait d'etre lue serait une destination perdue.
describe('A12 — le tableau par role : 0 destination perdue', () => {
  it.each([
    ['Joueur', 'Mes candidatures', false],
    ['Parent', 'Mes candidatures', false],
    ['Authenticated', 'Mes candidatures', false],
    ['Entraineur', 'Mes activités', true],
    ['Dirigeant', 'Mes activités', true],
    ['SuperAdmin', 'Mes activités', true],
  ])('%s → « %s »', async (role, titre, estStaff) => {
    const tree = await renderFor({
      documentId: `u-${role}`, myTeams: [], role: { name: role }, trainedTeams: [],
    });
    const texte = allText(tree);

    expect(texte).toContain(titre);
    if (estStaff) {
      // Ses PUBLICATIONS et les reponses RECUES : les deux onglets restent.
      expect(texte).toContain('[Publications]');
      expect(texte).toContain('Réponses reçues');
      expect(mockGetMyRecruitmentAds).toHaveBeenCalledTimes(1);
      expect(mockGetMyFriendlyMatchAds).toHaveBeenCalledTimes(1);
      expect(mockGetMyApplications).not.toHaveBeenCalled();
    } else {
      // SES candidatures ET ses propositions de match envoyees : les deux sont lues.
      expect(texte).not.toContain('Publications');
      expect(mockGetMyApplications).toHaveBeenCalledTimes(1);
      expect(mockGetMyFriendlyMatchApplications).toHaveBeenCalledTimes(1);
      expect(mockGetMyRecruitmentAds).not.toHaveBeenCalled();
    }
  });
});
