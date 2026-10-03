import { Alert } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { useEventMutations } from '../useEventMutations';

// ==========================================================================
// 🏛️ COLL-FIX2 (03/10) — point 8, planche 46 (D33, tournée T10 T10_C46_*).
//
// Un club annule un entraînement sur une installation de la Ville : la mairie
// est prévenue (D33, serveur), mais RIEN ne le disait au club — il ne lisait
// que « Événement annulé ». Seul le serveur sait à qui est l'installation : il
// le dit dans la réponse de l'annulation (`meta.collectivitePrevenue`, admin
// COLL-FIX2 (8)). L'écran le dit alors au club, juste après l'annulation.
// Même montage que useEventMutationsScoreAD01 (les mutations restent lisibles).
// ==========================================================================

const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: mockGoBack, navigate: jest.fn() }),
}));

jest.mock('react-i18next', () => ({
  ...jest.requireActual('react-i18next'),
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli, /** @type {any} */ options) => (
      typeof repli === 'string'
        ? repli.replace(/\{\{(\w+)\}\}/g, (_tout, nom) => String(options?.[nom] ?? ''))
        : cle
    ),
  }),
}));

jest.mock('@tanstack/react-query', () => ({
  useMutation: (/** @type {any} */ options) => ({
    isPending: false,
    mutate: jest.fn(),
    mutateAsync: jest.fn(),
    options,
  }),
  useQueryClient: () => ({ invalidateQueries: jest.fn(), setQueryData: jest.fn() }),
}));

jest.mock('@/services/matchStats/matchStatsService', () => ({ saveEventMatchResult: jest.fn() }));
jest.mock('@/services/event/eventService', () => ({
  cancelEvent: jest.fn(),
  declareSelfLate: jest.fn(),
  markCoachArrival: jest.fn(),
  markSelfArrival: jest.fn(),
  missingEvent: jest.fn(),
  remindUnansweredPlayers: jest.fn(),
  requestFeatured: jest.fn(),
  resetCoachAttendance: jest.fn(),
  respondToEventRsvp: jest.fn(),
  updateCoachLateMinutes: jest.fn(),
  updateEvent: jest.fn(),
}));
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

/** @type {any} */
let mutations = null;
/** @type {any} */
let monte = null;

/**
 * Fait tourner le hook et rend ses mutations lisibles.
 * @returns {null} Rien à l'écran.
 */
function Sonde() {
  mutations = useEventMutations('event-1', jest.fn(), jest.fn());
  return null;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  act(() => {
    monte = renderer.create(<Sonde />);
  });
});

afterEach(() => {
  act(() => {
    monte.unmount();
  });
  monte = null;
  mutations = null;
});

describe('COLL-FIX2 — l’annulation dit au club que la Ville est prévenue (D33)', () => {
  test('la Ville prévenue : le club le lit, puis l’écran se ferme', () => {
    mutations.cancelEventMutation.options.onSuccess({
      data: { documentId: 'event-1' },
      meta: { collectivitePrevenue: { collectiviteName: 'Ville de Montrivage' } },
    });
    expect(Alert.alert).toHaveBeenCalledWith(
      'C’est annulé',
      'La Ville de Montrivage est prévenue : la place se libère.',
    );
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  test('aucune Ville prévenue (installation d’un club) : rien de plus qu’avant', () => {
    mutations.cancelEventMutation.options.onSuccess({ data: { documentId: 'event-1' }, meta: {} });
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });
});
