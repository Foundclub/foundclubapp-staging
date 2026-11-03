import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import renderer, { act } from 'react-test-renderer';

import { lireMesReservations } from '@/services/complexe/complexeJoueurService';
import { getMyPlanning } from '@/services/event/eventService';

// T3-RESA-PLANNING (03/11/2026, Adel « 9- A ») — la réservation apparaît dans « Mon planning », et
// son bloc ouvre « Ma réservation ». Doublures reprises de PersonalPlanningContainer.R17EV1BIS.
// Rouge avant : la grille ne recevait que les événements du club.

jest.setTimeout(30000);

let mockAllume = true;
jest.mock('@/config/fonctionsMasquees', () => {
  const doublure = { ...jest.requireActual('@/config/fonctionsMasquees') };
  Object.defineProperty(doublure, 'COMPLEXES_JOUEUR', { get: () => mockAllume });
  return doublure;
});
jest.mock('@/utils/planning/planningSlots', () => ({
  ...jest.requireActual('@/utils/planning/planningSlots'),
  getPlanningDefaultDate: () => new Date(2026, 10, 5, 12, 0, 0),
}));
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));
jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));
jest.mock('@/theme/themeContext', () => {
  const styleLeaf = {};
  const makeRamp = () => new Proxy({}, { get: () => styleLeaf });
  return {
    __esModule: true,
    default: () => ({
      Alignments: makeRamp(),
      Colors: new Proxy({}, { get: (_target, key) => `couleur-${String(key)}` }),
      Fonts: makeRamp(),
      Spaces: new Proxy({}, { get: () => makeRamp() }),
    }),
  };
});
jest.mock('@/services/event/eventService', () => ({ getMyPlanning: jest.fn() }));
jest.mock('@/services/complexe/complexeJoueurService', () => ({ lireMesReservations: jest.fn() }));

/** @type {any[]} */
const mockGrilles = [];
jest.mock('@/components/atoms/loader/Loader', () => function LoaderDouble() {
  return null;
});
jest.mock(
  '@/components/molecules/segmentedControl/SegmentedControl',
  () => function SelecteurDouble() { return null; },
);
jest.mock(
  '@/components/organisms/planning/PlanningFullscreenButton',
  () => function PleinEcranDouble() { return null; },
);
jest.mock(
  '@/components/organisms/planningCalendarView',
  () => function CalendrierDouble() { return null; },
);
jest.mock(
  '@/components/organisms/planningWeekTimelineView',
  () => function GrilleDouble(/** @type {any} */ props) {
    mockGrilles.push(props);
    return null;
  },
);

// eslint-disable-next-line import/first
import PersonalPlanningContainer from '../PersonalPlanningContainer';

const RESERVATION = {
  complexe: { name: 'Le Five' },
  date: '2026-11-05',
  documentId: 'r-1',
  endsAt: '2026-11-05T21:00:00.000Z',
  from: '21:00',
  startsAt: '2026-11-05T20:00:00.000Z',
  status: 'confirmee',
  terrain: { name: 'Terrain 1' },
  to: '22:00',
};

/** @type {Array<{ arbre: any, client: QueryClient }>} */
const montes = [];
const monter = async () => {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: 0, retry: false } } });
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <QueryClientProvider client={client}>
        <PersonalPlanningContainer />
      </QueryClientProvider>,
    );
  });
  await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 20); }); });
  montes.push({ arbre, client });
};
const derniersEvenements = () => mockGrilles[mockGrilles.length - 1]?.events || [];

beforeEach(() => {
  mockAllume = true;
  mockGrilles.length = 0;
  mockNavigate.mockClear();
  /** @type {any} */ (getMyPlanning).mockReset().mockResolvedValue({
    data: [{ documentId: 'evt-1', startAt: '2026-11-05T17:00:00.000Z', title: 'Entraînement' }],
  });
  /** @type {any} */ (lireMesReservations).mockReset().mockImplementation(
    async (/** @type {string} */ periode) => ({ data: periode === 'a-venir' ? [RESERVATION] : [] }),
  );
});
afterEach(() => {
  act(() => {
    montes.splice(0).forEach(({ arbre, client }) => {
      arbre.unmount();
      client.clear();
    });
  });
});

describe('T3-RESA-PLANNING — la réservation dans « Mon planning »', () => {
  test('la grille reçoit l’événement ET la réservation', async () => {
    await monter();

    expect(derniersEvenements().map((/** @type {any} */ e) => e.documentId))
      .toEqual(['evt-1', 'r-1']);
    expect(derniersEvenements()[1].title).toBe('Terrain 1 · Le Five');
  });

  test('toucher le bloc ouvre « Ma réservation », pas la fiche d’un événement', async () => {
    await monter();

    act(() => { mockGrilles[mockGrilles.length - 1].onEventPress(derniersEvenements()[1]); });

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('ReserverMaReservation', { reservationId: 'r-1' });
  });

  test('toucher un événement du club ne change pas', async () => {
    await monter();

    act(() => { mockGrilles[mockGrilles.length - 1].onEventPress(derniersEvenements()[0]); });

    expect(mockNavigate).toHaveBeenCalledWith(
      'EventStack',
      { params: { eventId: 'evt-1' }, screen: 'EventDetails' },
    );
  });

  test('le calendrier refusé (parent, 403) montre quand même la réservation', async () => {
    /** @type {any} */ (getMyPlanning).mockReset().mockRejectedValue(new Error('403'));
    await monter();

    expect(derniersEvenements().map((/** @type {any} */ e) => e.documentId)).toEqual(['r-1']);
  });

  test('interrupteur éteint : rien de lu, rien de plus', async () => {
    mockAllume = false;
    await monter();

    expect(lireMesReservations).not.toHaveBeenCalled();
    expect(derniersEvenements().map((/** @type {any} */ e) => e.documentId)).toEqual(['evt-1']);
  });

  test('une lecture des réservations en échec n’empêche pas le planning', async () => {
    /** @type {any} */ (lireMesReservations).mockReset().mockRejectedValue(new Error('500'));
    await monter();

    expect(derniersEvenements().map((/** @type {any} */ e) => e.documentId)).toEqual(['evt-1']);
  });
});
