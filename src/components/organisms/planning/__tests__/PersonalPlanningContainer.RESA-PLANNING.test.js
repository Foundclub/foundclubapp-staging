import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import renderer, { act } from 'react-test-renderer';

import PersonalPlanningContainer from '../PersonalPlanningContainer';

// T3-RESA-PLANNING (03/11, Adel « 9- A ») — mesuré par RESA-OUVERTURE : une réservation confirmée
// du 05/11 était absente de « Mon planning », en 3 jours comme en Semaine. Elle y entre, et toucher
// son bloc ouvre SA fiche : jamais la fiche d'un événement, dont l'identifiant n'existerait pas.

const mockNavigate = jest.fn();
const mockGetMyPlanning = jest.fn();
const mockLireMesReservations = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ _cle, /** @type {any} */ repli) => (
      typeof repli === 'string' ? repli : _cle
    ),
  }),
}));
jest.mock('@/theme/themeContext', () => {
  const profond = () => new Proxy({}, { get: () => ({}) });
  return {
    __esModule: true,
    default: () => ({
      Alignments: profond(), Colors: profond(), Fonts: profond(), Spaces: profond(),
    }),
  };
});
jest.mock('@/services/event/eventService', () => ({
  getMyPlanning: (/** @type {any} */ plage) => mockGetMyPlanning(plage),
}));
jest.mock('@/services/complexe/complexeJoueurService', () => ({
  lireMesReservations: (/** @type {string} */ periode) => mockLireMesReservations(periode),
}));
jest.mock('@/components/atoms/loader/Loader', () => 'Loader');
jest.mock('@/components/molecules/segmentedControl/SegmentedControl', () => 'SegmentedControl');
jest.mock('@/components/organisms/planning/PlanningFullscreenButton', () => 'FullscreenButton');
jest.mock('@/components/organisms/planningCalendarView', () => 'PlanningCalendarView');
jest.mock('@/components/organisms/planningWeekTimelineView', () => 'PlanningWeekTimelineView');
jest.mock('@/config/fonctionsMasquees', () => ({
  ...jest.requireActual('@/config/fonctionsMasquees'),
  COMPLEXES_JOUEUR: true,
}));

const RESERVATION = {
  complexe: { name: 'Complexe Test' },
  date: '2026-11-05',
  documentId: 'resa-1',
  endsAt: '2026-11-05T19:00:00.000Z',
  from: '19:00',
  role: 'reserveur',
  startsAt: '2026-11-05T18:00:00.000Z',
  status: 'confirmee',
  terrain: { name: 'Terrain 1' },
  to: '20:00',
};

/**
 * Monte le planning et attend ses lectures.
 * @param {string} [dateVisee] - Le jour demandé par « Voir mon planning ».
 * @returns {Promise<any>} L'arbre rendu.
 */
const monter = async (dateVisee) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <QueryClientProvider client={client}>
        <PersonalPlanningContainer dateVisee={dateVisee} />
      </QueryClientProvider>,
    );
    await new Promise((resolve) => { setTimeout(resolve, 0); });
  });
  await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 0); }); });
  return arbre;
};

const grille = (/** @type {any} */ arbre) => arbre.root.findByType('PlanningWeekTimelineView');

describe('T3-RESA-PLANNING — la réservation dans « Mon planning »', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers({ doNotFake: ['setTimeout', 'nextTick', 'setImmediate', 'queueMicrotask'] });
    jest.setSystemTime(new Date('2026-11-05T08:00:00.000Z'));
    mockGetMyPlanning.mockResolvedValue({ data: [] });
    mockLireMesReservations.mockImplementation(async (/** @type {string} */ periode) => ({
      data: periode === 'a-venir' ? [RESERVATION] : [],
    }));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('ROUGE-AVANT — la réservation du jour est un bloc de la grille', async () => {
    const arbre = await monter();
    const blocs = grille(arbre).props.events;
    expect(blocs.map((/** @type {any} */ bloc) => bloc.title)).toEqual(['Complexe Test']);
    expect(blocs[0]).toMatchObject({ documentId: 'resa-1', startTime: '19:00' });
  });

  test('ROUGE-AVANT — la toucher ouvre SA fiche, pas celle d\'un événement', async () => {
    const arbre = await monter();
    const grilleRendue = grille(arbre);
    await act(async () => { grilleRendue.props.onEventPress(grilleRendue.props.events[0]); });
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('ReserverMaReservation', { reservationId: 'resa-1' });
  });

  test('un événement normal ouvre toujours sa fiche d\'événement', async () => {
    mockGetMyPlanning.mockResolvedValue({
      data: [{
        documentId: 'evt-1', startAt: '2026-11-05T17:00:00.000Z', title: 'Entraînement',
      }],
    });
    mockLireMesReservations.mockResolvedValue({ data: [] });
    const arbre = await monter();
    const grilleRendue = grille(arbre);
    await act(async () => { grilleRendue.props.onEventPress(grilleRendue.props.events[0]); });
    expect(mockNavigate).toHaveBeenCalledWith('EventStack', {
      params: { eventId: 'evt-1' },
      screen: 'EventDetails',
    });
  });

  test('une panne des réservations ne coupe jamais le planning', async () => {
    mockGetMyPlanning.mockResolvedValue({
      data: [{
        documentId: 'evt-1', startAt: '2026-11-05T17:00:00.000Z', title: 'Entraînement',
      }],
    });
    mockLireMesReservations.mockRejectedValue(new Error('403'));
    const arbre = await monter();
    expect(grille(arbre).props.events.map((/** @type {any} */ bloc) => bloc.title))
      .toEqual(['Entraînement']);
    expect(arbre.root.findAllByType('Loader')).toHaveLength(0);
  });

  test('ROUGE-AVANT — « dateVisee » ouvre le jour de la réservation, même lointaine', async () => {
    mockLireMesReservations.mockImplementation(async (/** @type {string} */ periode) => ({
      data: periode === 'a-venir'
        ? [{
          ...RESERVATION,
          date: '2026-11-20',
          endsAt: '2026-11-20T19:00:00.000Z',
          startsAt: '2026-11-20T18:00:00.000Z',
        }]
        : [],
    }));
    const arbre = await monter('2026-11-20');
    const blocs = grille(arbre).props.events;
    expect(blocs.map((/** @type {any} */ bloc) => bloc.title)).toEqual(['Complexe Test']);
    expect(mockGetMyPlanning).toHaveBeenLastCalledWith({ from: '2026-11-20', to: '2026-11-22' });
  });

  test('ROUGE-AVANT — seule au planning et loin : la vue d\'arrivée ouvre son mois', async () => {
    mockLireMesReservations.mockImplementation(async (/** @type {string} */ periode) => ({
      data: periode === 'a-venir'
        ? [{
          ...RESERVATION,
          date: '2026-12-20',
          endsAt: '2026-12-20T19:00:00.000Z',
          startsAt: '2026-12-20T18:00:00.000Z',
        }]
        : [],
    }));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    let arbre;
    await act(async () => {
      arbre = renderer.create(
        <QueryClientProvider client={client}>
          <PersonalPlanningContainer datesAVenir={[]} />
        </QueryClientProvider>,
      );
      await new Promise((resolve) => { setTimeout(resolve, 0); });
    });
    await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 0); }); });
    await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 0); }); });
    expect(arbre.root.findAllByType('PlanningCalendarView')).toHaveLength(1);
    expect(mockGetMyPlanning).toHaveBeenLastCalledWith({ from: '2026-12-01', to: '2026-12-31' });
  });

  test('une date illisible est ignorée : le planning reste sur aujourd\'hui', async () => {
    const arbre = await monter('pas-une-date');
    expect(grille(arbre).props.events.map((/** @type {any} */ bloc) => bloc.title))
      .toEqual(['Complexe Test']);
    expect(mockGetMyPlanning).toHaveBeenLastCalledWith({ from: '2026-11-05', to: '2026-11-07' });
  });
});
