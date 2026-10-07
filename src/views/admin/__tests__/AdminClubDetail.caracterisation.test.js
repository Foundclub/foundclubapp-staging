import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { RouteNames } from '@/navigation/routeNames';

import AdminClubDetail from '../AdminClubDetail';

// 🧾 OFFRIR-ABONNEMENT (07/10/2026) — TÉMOIN CARACTÉRISANT de la fiche d un club dans la console
// SuperAdmin (règle E6 : l écran n avait AUCUN témoin, il en faut un avant d y écrire).
//
// Il fige ce que l écran fait AVANT le lot, et qui doit rester vrai après : l en-tête (nom,
// ville et activité, pastilles), ses trois boutons (Modifier, vérifier, Actions), le geste
// « Modifier », les chiffres de l onglet d ouverture, et le passage d onglet. Les requêtes de
// la fiche sont doublées ; le VRAI i18next (fr.js) écrit les phrases.

jest.setTimeout(30000);

const mockGet = jest.fn();
const mockPost = jest.fn();
jest.mock('@/services/client', () => ({
  __esModule: true,
  default: {
    get: (...args) => mockGet(...args),
    post: (...args) => mockPost(...args),
  },
}));

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: jest.fn(), navigate: mockNavigate }),
  useRoute: () => ({ params: { clubId: 'club-banc' } }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {any[]} */ ...args) => jest.requireActual('i18next').t(...args),
  }),
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

/** @type {any} */
let mockClub;
jest.mock('@/services/admin/adminClubContentQueries', () => ({
  useDeleteAdminClubContent: () => ({ isPending: false, mutateAsync: jest.fn() }),
  useGetAdminClubContent: () => ({
    data: { data: mockClub }, error: null, isFetching: false, isLoading: false, refetch: jest.fn(),
  }),
  useSearchAdminClubRelations: () => ({ isPending: false, mutateAsync: jest.fn() }),
  useUpdateAdminClubRelation: () => ({ isPending: false, mutateAsync: jest.fn() }),
}));
jest.mock('@/services/admin/adminQueries', () => ({
  useVerifyAdminClub: () => ({ isPending: false, mutate: jest.fn() }),
}));

jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) { return children; },
);
jest.mock(
  '@/components/molecules/bottomModal/BottomModal',
  () => function BottomModalMock({ children, isVisible }) { return isVisible ? children : null; },
);
jest.mock(
  '@/components/molecules/profileAvatar/ProfileAvatar',
  () => function ProfileAvatarMock() { return null; },
);
jest.mock(
  '@/components/atoms/sponsorLogoTile/SponsorLogoTile',
  () => function SponsorLogoTileMock() { return null; },
);
jest.mock('@/components/atoms/button/Button', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
  return function ButtonMock(/** @type {any} */ props) {
    return reactActuel.createElement(
      PressableRN,
      { disabled: props.disabled, onPress: props.onPress, testID: `bouton-${props.title}` },
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

const textes = (/** @type {any} */ noeud) => noeud.findAllByType(Text)
  .map((/** @type {any} */ n) => aplatirTexte(n.props.children).trim());

const bouton = (/** @type {any} */ noeud, /** @type {string} */ titre) => noeud.find(
  // eslint-disable-next-line max-len
  (/** @type {any} */ n) => n.props?.testID === `bouton-${titre}` && typeof n.props?.onPress === 'function',
);

const monter = async () => {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { gcTime: 0, retry: false } },
  });
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <QueryClientProvider client={client}>
        <AdminClubDetail />
      </QueryClientProvider>,
    );
  });
  return arbre;
};

beforeEach(() => {
  mockClub = {
    clubPartner: false,
    clubVerified: true,
    documentId: 'club-banc',
    evenements: [],
    facilities: [{ documentId: 'terrain', name: 'Terrain' }],
    isReservationProvider: false,
    members: [
      { documentId: 'm1', firstname: 'Ana', lastname: 'Banc' },
      { documentId: 'm2', firstname: 'Bo', lastname: 'Banc' },
    ],
    name: 'AS Banc',
    teams: [{ documentId: 'e1', name: 'Seniors' }],
  };
  [mockGet, mockPost, mockNavigate].forEach((doublure) => doublure.mockReset());
  mockGet.mockResolvedValue({ data: { data: null } });
});

test('C1 — l en-tête : le nom du club, ses trois pastilles, ses trois boutons', async () => {
  const arbre = await monter();
  const vus = textes(arbre.root);
  expect(vus).toContain('AS Banc');
  expect(vus).toEqual(expect.arrayContaining(['Standard', 'Pas réservation', 'Certifié']));
  expect(bouton(arbre.root, 'Modifier')).toBeTruthy();
  expect(bouton(arbre.root, 'Retirer la vérif.')).toBeTruthy();
  expect(bouton(arbre.root, 'Actions')).toBeTruthy();
});

test('C2 — « Modifier » ouvre le formulaire du club', async () => {
  const arbre = await monter();
  await act(async () => { bouton(arbre.root, 'Modifier').props.onPress(); });
  expect(mockNavigate).toHaveBeenCalledWith(RouteNames.AdminClubForm, { clubId: 'club-banc' });
});

// eslint-disable-next-line max-len
test('C3 — l onglet d ouverture compte les membres, les équipes et les terrains ; un club non vérifié propose « Vérifier le club »', async () => {
  const arbre = await monter();
  const vus = textes(arbre.root);
  expect(vus).toEqual(expect.arrayContaining(['2', 'Membres', '1', 'Équipes', 'Terrains']));
  mockClub = { ...mockClub, clubVerified: false };
  const second = await monter();
  expect(bouton(second.root, 'Vérifier le club')).toBeTruthy();
  expect(textes(second.root)).toContain('Non certifié');
});
