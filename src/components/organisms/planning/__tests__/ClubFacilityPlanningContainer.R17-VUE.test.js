import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import renderer, { act } from 'react-test-renderer';

import { getClubPlanning } from '@/services/event/eventService';

// 🗓️ R17-VUE (19/10/2026, REC17-010) — LE PLANNING DU CLUB S OUVRE LA OU IL Y A QUELQUE CHOSE.
// Sa vue de base est la semaine : vide, mais un evenement plus tard ⇒ le MOIS de ce prochain
// evenement, trouve par UNE lecture bornee (31 jours apres la semaine) ; rien ⇒ la semaine.
// Premier temoin de ce conteneur (E6) : les tests 1 et 2 caracterisent ce qui existait.

// Mercredi 21 octobre 2026, midi (semaine du 19 au 25).
jest.mock('@/utils/planning/planningSlots', () => ({
  ...jest.requireActual('@/utils/planning/planningSlots'),
  getPlanningDefaultDate: () => new Date(2026, 9, 21, 12, 0, 0),
}));
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: jest.fn() }) }));
jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));
jest.mock('@/theme/themeContext', () => {
  const styleLeaf = {};
  const makeRamp = () => new Proxy({}, { get: () => styleLeaf });
  return {
    __esModule: true,
    default: () => ({
      ApplicationStyle: makeRamp(),
      Colors: new Proxy({}, { get: (_target, key) => `couleur-${String(key)}` }),
      Fonts: makeRamp(),
      Spaces: new Proxy({}, { get: () => makeRamp() }),
    }),
  };
});
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ canManageTeam: false, USER_ROLES: { president: 'Dirigeant' }, userData: {} }),
}));
jest.mock('@/services/facility/facilityQueries', () => ({
  useClubFacilityContext: () => ({
    data: { clubFacilities: [], cmId: null, sharedFacilities: [] },
    isLoading: false,
  }),
}));
jest.mock('@/services/event/eventService', () => ({ getClubPlanning: jest.fn() }));
jest.mock('@/services/multisportClub/multisportClubService', () => ({
  getClubSharedPlanning: jest.fn(),
}));

/** @type {any[]} */
const mockSelecteurs = [];
/** @type {any[]} */
const mockGrilles = [];
/** @type {any[]} */
const mockCalendriers = [];
jest.mock('@/components/atoms/loader/Loader', () => function LoaderDouble() { return null; });
jest.mock(
  '@/components/molecules/segmentedControl/SegmentedControl',
  () => function SelecteurDouble(/** @type {any} */ props) {
    mockSelecteurs.push(props);
    return null;
  },
);
jest.mock(
  '@/components/organisms/planning/PlanningFullscreenButton',
  () => function PleinEcranDouble() { return null; },
);
jest.mock('../../planningCalendarView', () => function CalendrierDouble(/** @type {any} */ props) {
  mockCalendriers.push(props);
  return null;
});
jest.mock('../../planningWeekTimelineView', () => function GrilleDouble(/** @type {any} */ props) {
  mockGrilles.push(props);
  return null;
});

// eslint-disable-next-line import/first
import ClubFacilityPlanningContainer from '../ClubFacilityPlanningContainer';

/**
 * Un evenement du club, a midi heure de Paris.
 * @param {string} jour - AAAA-MM-JJ.
 * @returns {any} Le bloc.
 */
const evenement = (jour) => ({
  documentId: `evt-${jour}`, kind: 'event', startAt: `${jour}T10:00:00.000Z`, title: 'U13',
});

/** @type {Array<{ arbre: any, client: QueryClient }>} */
const montes = [];
const attendre = async () => {
  await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 10); }); });
};
/**
 * Monte le planning du club ; le serveur rend `parPlage[from]` (sinon rien).
 * @param {Record<string, any[]>} parPlage - Les reponses, par jour de debut.
 * @returns {Promise<void>}
 */
const monter = async (parPlage) => {
  /** @type {any} */ (getClubPlanning).mockImplementation(async (
    /** @type {string} */ _club,
    /** @type {any} */ filtres,
  ) => ({ data: parPlage[filtres.from] || [] }));
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: 0, retry: false } } });
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <QueryClientProvider client={client}>
        <ClubFacilityPlanningContainer clubId="club-1" />
      </QueryClientProvider>,
    );
  });
  await attendre();
  await attendre();
  montes.push({ arbre, client });
};
const vues = () => mockSelecteurs.filter((props) => props.options?.length === 3);
const selecteur = () => vues()[vues().length - 1];
const plagesLues = () => /** @type {any} */ (getClubPlanning).mock.calls
  .map((/** @type {any[]} */ appel) => `${appel[1].from}>${appel[1].to}`);

beforeEach(() => {
  mockSelecteurs.length = 0;
  mockGrilles.length = 0;
  mockCalendriers.length = 0;
  /** @type {any} */ (getClubPlanning).mockReset();
});

afterEach(() => {
  act(() => {
    montes.splice(0).forEach(({ arbre, client }) => {
      arbre.unmount();
      client.clear();
    });
  });
});

describe('R17-VUE — le planning du club a l arrivee', () => {
  test('1 CARACTERISATION — la semaine par defaut, lue du lundi au dimanche', async () => {
    await monter({ '2026-10-19': [evenement('2026-10-22')] });
    expect(selecteur().value).toBe('week');
    expect(selecteur().options.map((/** @type {any} */ o) => o.value))
      .toEqual(['week', '3days', 'month']);
    expect(mockGrilles[mockGrilles.length - 1].mode).toBe('week');
    expect(mockGrilles[mockGrilles.length - 1].events).toHaveLength(1);
  });

  test('2 CARACTERISATION — semaine pleine : AUCUNE lecture de plus', async () => {
    await monter({ '2026-10-19': [evenement('2026-10-22')] });
    expect(plagesLues()).toEqual(['2026-10-19>2026-10-25']);
  });

  test('3 ROUGE-AVANT — semaine vide, un match le 3 novembre : le MOIS de novembre', async () => {
    await monter({ '2026-10-26': [evenement('2026-11-03')] });
    expect(plagesLues()).toContain('2026-10-26>2026-11-25');
    expect(selecteur().value).toBe('month');
    const calendrier = mockCalendriers[mockCalendriers.length - 1];
    expect([calendrier.currentDate.getMonth(), calendrier.currentDate.getDate()]).toEqual([10, 3]);
  });

  test('4 — semaine vide, rien plus tard : la semaine reste (une lecture de plus)', async () => {
    await monter({});
    expect(selecteur().value).toBe('week');
    expect(plagesLues()).toEqual(['2026-10-19>2026-10-25', '2026-10-26>2026-11-25']);
  });

  test('5 — un choix fait a la main ensuite est GARDE', async () => {
    await monter({ '2026-10-26': [evenement('2026-11-03')] });
    expect(selecteur().value).toBe('month');
    await act(async () => { selecteur().onChange('3days'); });
    await attendre();
    expect(selecteur().value).toBe('3days');
  });
});
