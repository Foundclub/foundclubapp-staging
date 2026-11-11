import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import renderer, { act } from 'react-test-renderer';

import { useEventMutations } from '../useEventMutations';

// ==========================================================================
// PERF-EQUIPE (10/11, demande d'Adel « les vitesses de chargement sont trop lentes ») — UNE
// REPONSE, UNE RELECTURE DE LA FICHE.
//
// 📏 Prod 06-10/11 (journal de Caddy) : `GET /api/events/:id` est l'appel le plus lent de l'app
// (mediane 3,37 s, 90 % a 12,35 s). Apres chaque reponse (present, absent, accepter, refuser…)
// et chaque pointage, l'ecran l'INVALIDAIT puis appelait `refetch()` juste derriere. Avec des
// donnees deja la, react-query annule la 1re lecture COTE APP et en relance une : la 1re est deja
// partie au serveur (aucun `signal` n'est passe a axios). Deux lectures de la fiche, et deux des
// participations, pour une seule reponse.
//
// Ce temoin fait tourner le VRAI react-query et compte les appels du `queryFn`, c'est-a-dire les
// requetes qui partent au serveur.
// ==========================================================================

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: jest.fn(), navigate: jest.fn() }),
}));

jest.mock('react-i18next', () => ({
  ...jest.requireActual('react-i18next'),
  useTranslation: () => ({ t: (/** @type {string} */ cle) => cle }),
}));

jest.mock('@/services/matchStats/matchStatsService', () => ({
  remindEventMatchResponses: jest.fn(),
  saveEventMatchResult: jest.fn(),
}));

jest.mock('@/services/event/eventService', () => ({
  cancelEvent: jest.fn(),
  declareSelfLate: jest.fn(),
  markCoachArrival: jest.fn(),
  markSelfArrival: jest.fn(() => Promise.resolve({})),
  missingEvent: jest.fn(),
  remindUnansweredPlayers: jest.fn(),
  requestFeatured: jest.fn(),
  resetCoachAttendance: jest.fn(),
  respondToEventRsvp: jest.fn(() => Promise.resolve({})),
  updateCoachLateMinutes: jest.fn(),
  updateEvent: jest.fn(),
}));

jest.mock('@/services/eventParticipation/eventParticipationService', () => ({
  acceptEventParticipation: jest.fn(),
  createEventParticipation: jest.fn(),
  declineEventParticipation: jest.fn(),
  deleteEventParticipation: jest.fn(),
}));

jest.mock('@/services/eventReport/eventReportService', () => ({
  createEventReport: jest.fn(),
}));

jest.mock('@/services/reservation/reservationService', () => ({
  bookFullReservation: jest.fn(),
  joinReservation: jest.fn(),
  openForPlayers: jest.fn(),
  triggerSosAlert: jest.fn(),
}));

/** Les requetes parties au serveur, par famille. */
const lectures = { fiche: 0, participations: 0 };

/** @type {any} */
let mutations = null;
/** @type {any} */
let monte = null;
/** @type {QueryClient} */
let client;

/**
 * La fiche telle qu'EventDetails la monte : sa requete, ses participations, et les mutations
 * qui recoivent leurs `refetch`.
 * @returns {null} - Rien a l ecran.
 */
function Fiche() {
  const fiche = useQuery({
    queryFn: () => { lectures.fiche += 1; return Promise.resolve({ documentId: 'evt-1' }); },
    queryKey: ['event', 'evt-1'],
    staleTime: 30000,
  });
  const participations = useQuery({
    queryFn: () => { lectures.participations += 1; return Promise.resolve([]); },
    queryKey: ['eventParticipations', 'evt-1', 'all'],
  });
  mutations = useEventMutations('evt-1', fiche.refetch, participations.refetch);
  return null;
}

const attendre = async () => {
  for (let i = 0; i < 10; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 0); }); });
  }
};

beforeEach(async () => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  lectures.fiche = 0;
  lectures.participations = 0;
  act(() => {
    monte = renderer.create(
      <QueryClientProvider client={client}>
        <Fiche />
      </QueryClientProvider>,
    );
  });
  await attendre();
  // La fiche est chargee : une lecture de chaque.
  expect(lectures).toEqual({ fiche: 1, participations: 1 });
  lectures.fiche = 0;
  lectures.participations = 0;
});

afterEach(() => {
  act(() => monte.unmount());
  client.clear();
});

describe('PERF-EQUIPE — une reponse ne relit la fiche qu une fois', () => {
  test('🚨 repondre present : 1 GET /events/:id et 1 GET des participations', async () => {
    await act(async () => {
      await mutations.respondToEventRsvpMutation.mutateAsync({ answer: 'yes', eventId: 'evt-1' });
    });
    await attendre();

    expect(lectures).toEqual({ fiche: 1, participations: 1 });
    // La fiche reste marquee perimee pour tout autre lecteur de la meme famille.
    expect(client.getQueryState(['event', 'evt-1'])?.isInvalidated).toBe(false);
  });

  test('🚨 se pointer arrive : 1 GET /events/:id', async () => {
    await act(async () => {
      await mutations.selfArrivalMutation.mutateAsync({ eventId: 'evt-1', payload: {} });
    });
    await attendre();

    expect(lectures.fiche).toBe(1);
  });
});
