/* eslint-disable max-len -- les témoins se lisent en entier. */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Platform } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import TournamentSettingsEdit from '../TournamentSettingsEdit';

// IMPL-3-ORGA (18/11/2026, check-list page 1, point 7 ; planche 11c) — « une seule flèche retour dans les
// réglages ». Sur le téléphone, la pile (EventStack.js, `commonOptions`) dessine déjà son retour : l'écran en
// ajoutait un second. Sur le site, l'écran n'a pas de barre fine (registre sans `barreDeTitre`) : son
// retour à lui est le seul, il reste.

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => (typeof repli === 'string' ? repli : cle),
  }),
}));
jest.mock('@/theme/themeContext', () => {
  const generateColors = jest.requireActual('@/theme/colors').default;
  const generateFonts = jest.requireActual('@/theme/fonts').default;
  const Colors = generateColors();
  return {
    __esModule: true,
    default: () => ({
      Alignments: jest.requireActual('@/theme/alignements').default,
      ApplicationStyle: jest.requireActual('@/theme/applicationStyle').default(Colors),
      Colors,
      Fonts: generateFonts(Colors),
      Images: new Proxy({}, { get: () => 1 }),
      Spaces: jest.requireActual('@/theme/spaces').default,
    }),
  };
});
jest.mock('@/domains/auth/useAuth', () => ({ __esModule: true, default: () => ({ canManageEvent: () => true }) }));
jest.mock('@/components/atoms/headerBackButton/HeaderBackButton', () => function RetourDouble() { return null; });
jest.mock('@/components/molecules/withDataWrapper/WithDataWrapper', () => (/** @type {any} */ { children }) => children);
jest.mock('@/components/templates/ScreenContainer', () => (/** @type {any} */ { children }) => children);
// Le MÊME objet à chaque rendu : l écran recopie l événement dans un effet qui dépend de lui.
const mockEvent = { documentId: 'evt-1', tournamentConfig: { formatMode: 'groups_only' } };
jest.mock('@/services/event/eventQueries', () => ({
  useGetEvent: () => ({
    data: mockEvent, error: null, isLoading: false, refetch: jest.fn(),
  }),
}));
jest.mock('@/services/event/eventService', () => ({ updateEvent: jest.fn(() => Promise.resolve({})) }));

const OS_DEPART = Platform.OS;
/** @type {any[]} */
const montes = [];

const compterLesRetours = async (/** @type {string} */ os) => {
  Platform.OS = /** @type {any} */ (os);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  /** @type {any} */
  let arbre = null;
  await act(async () => {
    arbre = renderer.create(
      <QueryClientProvider client={client}>
        <TournamentSettingsEdit navigation={{ goBack: jest.fn() }} route={{ params: { eventId: 'evt-1' } }} />
      </QueryClientProvider>,
    );
  });
  montes.push(arbre);
  return arbre.root.findAllByType(jest.requireMock('@/components/atoms/headerBackButton/HeaderBackButton')).length;
};

afterEach(async () => {
  Platform.OS = OS_DEPART;
  const arbres = montes.splice(0);
  await act(async () => { arbres.forEach((arbre) => arbre?.unmount?.()); });
});

test('🔴 téléphone (iOS, Android) : l écran ne dessine pas de second retour, la pile a le sien', async () => {
  expect(await compterLesRetours('ios')).toBe(0);
  expect(await compterLesRetours('android')).toBe(0);
});

test('caractérisant : site, le retour de l écran reste (pas de barre fine)', async () => {
  expect(await compterLesRetours('web')).toBe(1);
});
