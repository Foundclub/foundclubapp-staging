import '@/theme/strings';
import renderer, { act } from 'react-test-renderer';

import MyActivitiesScreen from '../MyActivitiesScreen';

// ANNONCE-RENOUVELER, point 6 (choix du chef « badge A », 05/10) — « Mes annonces » ne dit
// plus « En ligne » d'une annonce EXPIREE.
//
// Mesure avant ce point : la pastille d'une publication lit `isActive` seul
// (domains/search/myActivitiesFeed.js, `isOnline: Boolean(ad?.isActive)`), et AUCUN serveur ne
// passe `isActive` a false a l'echeance. Une annonce expiree depuis un mois s'affichait
// « En ligne » alors qu'elle a disparu des alertes et des cartes d'equipe.
// Meme borne que la fiche : utils/recruitmentAdRenewal.js (echeance serveur, `expiresAt < now`).
// Lance sous TZ=UTC et TZ=Europe/Paris (la borne est un instant : meme verdict).
//
// Harnais repris de MyActivitiesScreen.gererAnnonce.test.js.

// Premier montage a froid lent sur une machine chargee (voir le harnais d'origine).
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
jest.mock('@/components/molecules/segmentedControl/SegmentedControl', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/components/atoms/emptyState/EmptyState', () => {
  // eslint-disable-next-line global-require
  const { Text } = require('react-native');
  return { __esModule: true, default: (/** @type {any} */ props) => <Text>{props.title}</Text> };
});
jest.mock('@/navigation/webNavigationGuard', () => ({ navigateOrExplainOnWeb: jest.fn() }));

// Doublures ENTIERES des services (piege L35 : client HTTP sans API_URL).
const mockGetMyRecruitmentAds = jest.fn();
jest.mock('@/services/recruitment/recruitmentService', () => ({
  getMyApplications: jest.fn(async () => []),
  getMyRecruitmentAds: (/** @type {any} */ filters) => mockGetMyRecruitmentAds(filters),
}));
jest.mock('@/services/friendlyMatch/friendlyMatchService', () => ({
  getMyFriendlyMatchAds: jest.fn(async () => []),
  getMyFriendlyMatchApplications: jest.fn(async () => []),
}));
jest.mock('@/components/molecules/clubLogoMark/ClubLogoMark', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/services/notification/notificationService', () => ({
  markApplicationResponsesAsRead: () => Promise.resolve({ ok: true, updated: 0 }),
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

const DAY = 24 * 60 * 60 * 1000;
const inDays = (/** @type {number} */ days) => new Date(Date.now() + days * DAY).toISOString();

const EQUIPE = { club: { documentId: 'club-a' }, documentId: 'team-u15', name: 'U15' };
const COACH = {
  documentId: 'u-coach', myTeams: [], role: { name: 'Entraineur' }, trainedTeams: [EQUIPE],
};
const ANNONCE = {
  applications: [],
  documentId: 'ad-1',
  expirationDate: inDays(3),
  isActive: true,
  team: EQUIPE,
  title: 'Defenseur central',
};

/** @type {any[]} */
let montes = [];

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
 * Monte « Mes annonces » de l'entraineur avec ces annonces.
 * @param {any[]} annonces Ce que rend le serveur.
 * @returns {Promise<string[]>} Les textes rendus.
 */
const textesDeMesAnnonces = async (annonces) => {
  mockUseAuth.mockReturnValue({ userData: COACH });
  mockGetMyRecruitmentAds.mockResolvedValue(annonces);
  let tree;
  await act(async () => {
    tree = renderer.create(<MyActivitiesScreen navigation={{ navigate: jest.fn() }} />);
  });
  montes.push(tree);
  return collectText(/** @type {any} */ (tree).toJSON());
};

afterEach(async () => {
  await act(async () => {
    montes.forEach((tree) => tree.unmount());
  });
  montes = [];
});

describe('ANNONCE-RENOUVELER 6 — « Mes annonces » dit « Expirée » apres l echeance', () => {
  it('annonce expiree depuis 2 jours : « Expirée », plus « En ligne »', async () => {
    const textes = await textesDeMesAnnonces([{ ...ANNONCE, expirationDate: inDays(-2) }]);

    expect(textes).toContain('Expirée');
    expect(textes).not.toContain('En ligne');
  });

  it('echeance dans 3 jours : toujours « En ligne »', async () => {
    const textes = await textesDeMesAnnonces([ANNONCE]);

    expect(textes).toContain('En ligne');
    expect(textes).not.toContain('Expirée');
  });

  it('sans echeance (ancienne annonce) : « En ligne », comme avant', async () => {
    const textes = await textesDeMesAnnonces([{ ...ANNONCE, expirationDate: null }]);

    expect(textes).toContain('En ligne');
  });

  it('une annonce desactivee reste « Hors ligne », meme expiree', async () => {
    const textes = await textesDeMesAnnonces([
      { ...ANNONCE, expirationDate: inDays(-2), isActive: false },
    ]);

    expect(textes).toContain('Hors ligne');
    expect(textes).not.toContain('Expirée');
  });
});
