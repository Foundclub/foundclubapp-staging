/* eslint-disable max-len -- les témoins se lisent en entier. */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import renderer, { act } from 'react-test-renderer';

import TournamentSettingsEdit from '../TournamentSettingsEdit';

// ORGANISATEUR 6 (19/11/2026, carte 11c, décisions d'Adel) — LES RÉGLAGES DU TOURNOI.
// · Un tournoi PAYANT valide l'équipe au seuil des joueurs payés, quel que soit le mode choisi (serveur :
//   tournament-payment.js recountTeam, `pending` -> `accepted` au seuil). La case « Validation manuelle »
//   mentait : sur un tournoi payant, l'écran dit la règle au lieu de proposer un choix sans effet.
// · Un tournoi GRATUIT garde son choix : recountTeam sort tout de suite sans prix, la validation y est réelle.
// · Les mots techniques (« équipes éphémères », « cockpit organisateur ») sont remplacés ; le titre suit la planche.
// Le mode enregistré n'est jamais réécrit par l'écran (`registrationMode` repart tel qu'il est lu).

jest.setTimeout(30000);

jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));
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
const mockEvenement = { value: /** @type {any} */ (null) };
jest.mock('@/services/event/eventQueries', () => ({
  useGetEvent: () => ({
    data: mockEvenement.value, error: null, isLoading: false, refetch: jest.fn(),
  }),
}));
jest.mock('@/services/event/eventService', () => ({ updateEvent: jest.fn(() => Promise.resolve({})) }));

const PAYANT = {
  club: { documentId: 'club-1' },
  documentId: 'evt-1',
  tournamentConfig: {
    entryFeeCents: 2000, formatMode: 'groups_only', paidMembersToValidate: 5, registrationMode: 'manual',
  },
};
const GRATUIT = {
  club: { documentId: 'club-1' },
  documentId: 'evt-2',
  tournamentConfig: { formatMode: 'groups_only', registrationMode: 'manual' },
};

/** @type {any[]} */
const montes = [];
const monter = async (/** @type {any} */ evenement) => {
  mockEvenement.value = evenement;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  /** @type {any} */
  let arbre = null;
  await act(async () => {
    arbre = renderer.create(
      <QueryClientProvider client={client}>
        <TournamentSettingsEdit navigation={{ goBack: jest.fn() }} route={{ params: { eventId: evenement.documentId } }} />
      </QueryClientProvider>,
    );
  });
  montes.push(arbre);
  return arbre;
};
const texte = (/** @type {any} */ arbre) => JSON.stringify(arbre.toJSON());

afterEach(async () => {
  const arbres = montes.splice(0);
  await act(async () => { arbres.forEach((arbre) => arbre?.unmount?.()); });
});

test('🔴 payant : plus de case « Validation manuelle » ; la règle « à 5 joueurs payés » est dite', async () => {
  const rendu = texte(await monter(PAYANT));
  expect(rendu).not.toContain('Validation manuelle');
  expect(rendu).not.toContain('Validation automatique');
  expect(rendu).toContain('À 5 joueurs payés, l’équipe se valide seule.');
});

test('caractérisant : gratuit, le choix manuel / automatique reste', async () => {
  const rendu = texte(await monter(GRATUIT));
  expect(rendu).toContain('Validation manuelle');
  expect(rendu).toContain('Validation automatique');
});

test('🔴 plus de mots techniques : ni « éphémère », ni « cockpit »', async () => {
  const rendu = texte(await monter(PAYANT));
  expect(rendu).not.toMatch(/éphémère/);
  expect(rendu).not.toMatch(/cockpit/);
  expect(rendu).toContain('Synchroniser la structure');
});

test('🔴 le titre : « Réglages du tournoi »', async () => {
  const rendu = texte(await monter(PAYANT));
  expect(rendu).toContain('Réglages du tournoi');
  expect(rendu).not.toContain('Paramètres du tournoi');
});
