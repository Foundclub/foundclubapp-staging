/* eslint-disable max-len -- des phrases entieres, comparees telles quelles */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

import EventEdit from '../EventEdit.web';

// 🧪 PLANMODIF (27/10, TestFlight 2.6.81) — « je change la date, la case du planning ne bouge pas ».
// Le planning pose deux familles de cles (`domains/refresh/afterAction.js`) : `['planning','personal',…]`
// (onglet Planning, accueil) et `['planning','fullscreen',…]` (le plein ecran, qui reste monte sous la
// fiche). Le telephone (`EventEdit.js`) invalide `['planning']` ; le site (`EventEdit.web.js`) et les
// gestes de la fiche (`useEventMutations`, annuler compris) n invalidaient que `['planning','personal']` :
// le plein ecran gardait l ancienne case. ROUGE avant le lot.

const mockNavigation = {
  goBack: jest.fn(), navigate: jest.fn(), replace: jest.fn(), setOptions: jest.fn(),
};

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => mockNavigation,
}));

jest.mock('@/services/seasonSlot/seasonSlotQueries', () => ({
  useMairieDecideDuDeplacement: () => false,
}));

jest.mock('react-i18next', () => ({
  ...jest.requireActual('react-i18next'),
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => (typeof repli === 'string' ? repli : cle),
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

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({
    userData: {
      club: { documentId: 'club-1' },
      documentId: 'user-1',
      role: { name: 'Entraineur' },
      trainedTeams: [{ club: { documentId: 'club-1' }, documentId: 'team-1', name: 'U15' }],
    },
  }),
}));

// ⛔ Jamais `requireActual` sur un service : le client HTTP exige `API_URL`, absent des copies.
jest.mock('@/services/event/eventService', () => ({
  cancelEvent: jest.fn(),
  createEvent: jest.fn(() => Promise.resolve({})),
  declareSelfLate: jest.fn(),
  getEventByIdForEdit: jest.fn(),
  getEventTypes: jest.fn(() => Promise.resolve([{ documentId: 'type-entrainement', name: 'Entrainement' }])),
  markCoachArrival: jest.fn(),
  markSelfArrival: jest.fn(),
  missingEvent: jest.fn(),
  remindUnansweredPlayers: jest.fn(),
  requestFeatured: jest.fn(),
  resetCoachAttendance: jest.fn(),
  respondToEventRsvp: jest.fn(),
  updateCoachLateMinutes: jest.fn(),
  updateEvent: jest.fn(() => Promise.resolve({})),
}));
jest.mock('@/services/facility/facilityQueries', () => ({
  useGetClubVilleFacilitiesWithSlots: () => ({ data: undefined }),
  useGetCMFacilities: () => ({ data: undefined }),
  useGetFacilities: () => ({
    data: [{ documentId: 'facility-1', name: 'Gymnase des Tilleuls' }], error: null, isLoading: false,
  }),
}));
jest.mock('@/services/team/teamService', () => ({
  getTeams: jest.fn(() => Promise.resolve({ data: [{ club: { documentId: 'club-1' }, documentId: 'team-1', name: 'U15' }] })),
}));
jest.mock('@/services/matchStats/matchStatsService', () => ({ saveEventMatchResult: jest.fn() }));
jest.mock('@/services/eventParticipation/eventParticipationService', () => ({
  acceptEventParticipation: jest.fn(),
  createEventParticipation: jest.fn(),
  declineEventParticipation: jest.fn(),
  deleteEventParticipation: jest.fn(),
}));
jest.mock('@/services/eventReport/eventReportService', () => ({ createEventReport: jest.fn() }));
jest.mock('@/services/reservation/reservationService', () => ({
  bookFullReservation: jest.fn(),
  joinReservation: jest.fn(),
  openForPlayers: jest.fn(),
  triggerSosAlert: jest.fn(),
}));

/* eslint-disable global-require */
jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerDouble(/** @type {any} */ props) {
    return props.children;
  },
);
jest.mock(
  '@/views/event/components/EventTasksEditor',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_EventTasksEditor'),
);
jest.mock(
  '@/views/event/components/EventTeamAudiencesEditor',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_EventTeamAudiencesEditor'),
);
/* eslint-enable global-require */

jest.setTimeout(30000);

const eventService = jest.requireMock('@/services/event/eventService');

const SEANCE = {
  date: '2030-05-15T16:30:00.000Z',
  description: 'Seance technique',
  documentId: 'event-1',
  endTime: '20:00:00.000',
  eventTasks: [],
  facility: { documentId: 'facility-1' },
  invitedTeams: [],
  sessionStatus: 'closed',
  startTime: '18:30:00.000',
  team: { club: { documentId: 'club-1' }, documentId: 'team-1' },
  teamAudiences: [],
  type: { documentId: 'type-entrainement', name: 'Entrainement' },
  validationMode: 'manual',
};

// Les cles exactes des deux lecteurs du planning personnel (onglet, puis plein ecran).
const CLE_ONGLET = ['planning', 'personal', '2030-05-13', '2030-05-15'];
const CLE_PLEIN_ECRAN = ['planning', 'fullscreen', 'personal', '2030-05-13', '2030-05-19'];

/**
 * Un cache ou les deux plannings ont deja ete lus, avec la case a l ancienne date.
 * @returns {QueryClient} Le cache.
 */
const cacheAvecLesDeuxPlannings = () => {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, retry: false } } });
  const ancienneCase = { data: [{ date: '2030-05-14', documentId: 'event-1' }] };
  client.setQueryData(CLE_ONGLET, ancienneCase);
  client.setQueryData(CLE_PLEIN_ECRAN, ancienneCase);
  return client;
};

/** @type {any} */
let arbre = null;

afterEach(() => {
  if (arbre) {
    act(() => { arbre.unmount(); });
    arbre = null;
  }
});

const tours = async (/** @type {number} */ n) => {
  for (let tour = 0; tour < n; tour += 1) {
    // eslint-disable-next-line no-await-in-loop -- les tours sont sequentiels par nature
    await act(async () => { await new Promise((resoudre) => { setTimeout(resoudre, 0); }); });
  }
};

describe('PLANMODIF — après « Modifier » sur le site, les deux plannings se relisent', () => {
  test('l onglet ET le plein écran sont périmés après l enregistrement', async () => {
    eventService.getEventByIdForEdit.mockResolvedValue(SEANCE);
    eventService.updateEvent.mockResolvedValue({ data: { documentId: 'event-1' }, meta: {} });
    const client = cacheAvecLesDeuxPlannings();
    act(() => {
      arbre = renderer.create(createElement(
        QueryClientProvider,
        { client },
        createElement(EventEdit, { navigation: mockNavigation, route: { params: { eventId: 'event-1' } } }),
      ));
    });
    await tours(20);
    const [formulaire] = arbre.root.findAll((/** @type {any} */ n) => n.type === 'form');
    await act(async () => { await formulaire.props.onSubmit({ preventDefault: () => {} }); });
    await tours(5);

    expect(eventService.updateEvent).toHaveBeenCalledTimes(1);
    expect(client.getQueryState(CLE_ONGLET)?.isInvalidated).toBe(true);
    expect(client.getQueryState(CLE_PLEIN_ECRAN)?.isInvalidated).toBe(true);
  });
});

describe('PLANMODIF — les gestes de la fiche (annuler…) périment aussi le plein écran', () => {
  test('annuler l événement : l onglet ET le plein écran sont périmés', async () => {
    const client = cacheAvecLesDeuxPlannings();
    const { useEventMutations } = jest.requireActual('../hooks/useEventMutations');
    /** @type {any} */
    let mutations = null;
    /**
     * Fait tourner le hook et rend ses mutations lisibles.
     * @returns {null} Rien a l ecran.
     */
    function Sonde() {
      mutations = useEventMutations('event-1', jest.fn(), jest.fn());
      return null;
    }
    jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(() => {}); // eslint-disable-line global-require
    act(() => {
      arbre = renderer.create(createElement(QueryClientProvider, { client }, createElement(Sonde)));
    });
    eventService.cancelEvent.mockResolvedValue({ data: { documentId: 'event-1' } });
    await act(async () => { await mutations.cancelEventMutation.mutateAsync({ documentId: 'event-1' }); });

    expect(client.getQueryState(CLE_ONGLET)?.isInvalidated).toBe(true);
    expect(client.getQueryState(CLE_PLEIN_ECRAN)?.isInvalidated).toBe(true);
  });
});
