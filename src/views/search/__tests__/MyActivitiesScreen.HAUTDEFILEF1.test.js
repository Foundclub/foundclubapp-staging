// I18N-4 : le fil de l'ecran lit ses textes par i18next (le VRAI, en francais).
import '@/theme/strings';
import { FlatList, Text as TexteRN } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import MyActivitiesScreen from '../MyActivitiesScreen';

// HAUT-DEFILE-F1 (12/11/2026, décision d'Adel « 245 B » : « le haut défile ») — Rechercher ›
// « Mes activités » (staff) et « Mes candidatures » (joueur). Le titre et, pour le staff, les
// sous-onglets « Publications / Réponses » restaient FIGÉS au-dessus de la liste : ils passent en
// tête de ce qui défile. Rien ne disparaît : pendant le chargement, le titre reste affiché.
// Doublures reprises de MyActivitiesScreen.gererAnnonce.test.js.

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

// MES-CANDIDATURES (A12) : le medaillon du club des lignes du joueur.
jest.mock('@/components/molecules/clubLogoMark/ClubLogoMark', () => ({
  __esModule: true,
  default: () => null,
}));

// MES-CANDIDATURES (A13) : l'ecran marque vues les reponses a mes candidatures. Doublure
// ENTIERE, pour la meme raison que les services ci-dessus (client HTTP sans API_URL).
const mockInvalidateQueries = jest.fn();
jest.mock('@tanstack/react-query', () => {
  // Une seule identite, comme le vrai client : l'ecran le met dans ses dependances.
  const client = { invalidateQueries: (...args) => mockInvalidateQueries(...args) };
  return { useQueryClient: () => client };
});

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

const COACH = {
  documentId: 'u-coach',
  myTeams: [],
  role: { name: 'Entraineur' },
  trainedTeams: [{ club: { documentId: 'club-a' }, documentId: 'team-a', name: 'U15' }],
};
const JOUEUR = { documentId: 'u-joueur', myTeams: [], role: { name: 'Joueur' } };

/** @type {any[]} */
let montes = [];

/**
 * Monte l'ecran pour un compte donne, les lectures servies.
 * @param {any} userData Le compte connecte.
 * @returns {Promise<any>} L'arbre rendu.
 */
const monter = async (userData) => {
  mockUseAuth.mockReturnValue({ userData });
  mockGetMyRecruitmentAds.mockResolvedValue({ data: [] });
  mockGetMyApplications.mockResolvedValue({ data: [] });
  mockGetMyFriendlyMatchAds.mockResolvedValue({ data: [] });
  mockGetMyFriendlyMatchApplications.mockResolvedValue({ data: [] });
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<MyActivitiesScreen navigation={{ navigate: jest.fn() }} />);
  });
  await act(async () => { await new Promise((r) => { setTimeout(r, 0); }); });
  montes.push(arbre);
  return arbre;
};

afterEach(() => {
  montes.forEach((arbre) => { act(() => { arbre.unmount(); }); });
  montes = [];
});

/**
 * Les textes posés DANS la liste qui défile.
 * @param {any} arbre
 * @returns {string[]} Les textes, dans l'ordre.
 */
const textesDeLaListe = (arbre) => arbre.root.findByType(FlatList).findAllByType(TexteRN)
  .map((/** @type {any} */ n) => [n.props.children].flat().join(''));

describe('HAUT-DEFILE-F1 — Mes activités : le haut défile', () => {
  it('staff : le titre et les sous-onglets sont en tête de la liste', async () => {
    const lus = textesDeLaListe(await monter(COACH));
    expect(lus[0]).toBe('Mes activités');
    expect(lus[1]).toBe('[Publications]');
    expect(lus[2]).toMatch(/^Réponses/);
  });

  it('joueur : « Mes candidatures » est en tête de la liste, sans sous-onglets', async () => {
    const lus = textesDeLaListe(await monter(JOUEUR));
    expect(lus[0]).toBe('Mes candidatures');
    expect(lus).not.toContain('[Publications]');
  });
});
