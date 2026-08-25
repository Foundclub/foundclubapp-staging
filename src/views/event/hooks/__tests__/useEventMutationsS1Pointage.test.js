import renderer, { act } from 'react-test-renderer';

import { useEventMutations } from '../useEventMutations';

// ==========================================================================
// S1 / D4 — LE BADGE « ARRIVE » FANTOME.
//
// 📸 Sur le screenshot d Adel (recette 2.6.27, 12h33), le joueur qui vient de
// se declarer absent portait encore son ancien pointage « Arrive ».
//
// 🔎 LE MAILLON : quand une reponse change, l ecran invalide l evenement, les
// participations, les annonces et le planning — mais PAS `['eventAttendance']`.
// Le pointage affiche reste donc celui d avant la bascule. Le motif existe
// pourtant deja cinq fois dans ce meme fichier, du cote des mutations de
// pointage : c est une clef qui manquait a l appel, pas une mecanique a batir.
//
// 🎯 CORRIGE DANS LA FONCTION PARTAGEE, pas dans la seule mutation d absence :
// les cinq portes de participation (absence, suppression, acceptation, refus,
// creation) passent toutes par `invalidateEventParticipationState`. Reparer
// l appelant cite par le ticket aurait laisse les quatre freres casses.
//
// 🧊 LE PIEGE QUI GUETTAIT, ecarte par la mesure : invalider une query EN
// VEILLE ne relit rien. Ici la query de pointage est montee dans le MEME ecran
// (`EventDetails.js`, `useGetEventAttendance`) et n est active QUE lorsque le
// badge est affiche — donc exactement quand le fantome existe. L invalidation
// la fait bien retomber. Repli si la recette prouvait le contraire :
// `refetchAttendance`, deja destructure a cote de la query.
// ==========================================================================

const mockInvalidateQueries = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: jest.fn(), navigate: jest.fn() }),
}));

jest.mock('react-i18next', () => ({
  ...jest.requireActual('react-i18next'),
  useTranslation: () => ({ t: (/** @type {string} */ cle) => cle }),
}));

jest.mock('@tanstack/react-query', () => ({
  // La doublure GARDE les options : c est ce qui rend `onSuccess` appelable
  // directement, sans faire tourner react-query.
  useMutation: (/** @type {any} */ options) => ({
    isPending: false,
    mutate: jest.fn(),
    mutateAsync: jest.fn(),
    options,
  }),
  useQueryClient: () => ({
    invalidateQueries: mockInvalidateQueries,
    setQueryData: jest.fn(),
  }),
}));

jest.mock('@/services/matchStats/matchStatsService', () => ({
  saveEventMatchResult: jest.fn(),
}));

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

jest.mock('@/services/eventReport/eventReportService', () => ({
  createEventReport: jest.fn(),
}));

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
 * Un composant qui ne dessine rien : il ne sert qu a faire tourner le hook et a
 * en rendre les mutations lisibles depuis le test.
 * @returns {null} - Rien a l ecran.
 */
function Sonde() {
  mutations = useEventMutations('event-1', jest.fn(), jest.fn());
  return null;
}

beforeEach(() => {
  jest.clearAllMocks();
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

const clefsInvalidees = () => mockInvalidateQueries.mock.calls
  .map(([argument]) => JSON.stringify(argument?.queryKey));

const aInvalide = (/** @type {any[]} */ queryKey) => clefsInvalidees()
  .includes(JSON.stringify(queryKey));

describe('S1/D4 — la bascule absent rafraichit le pointage affiche', () => {
  test('S1/7 — 🥇 se declarer absent invalide le POINTAGE, pas seulement la reponse', () => {
    mutations.missingEventMutation.options.onSuccess();

    expect(aInvalide(['eventAttendance', 'event-1'])).toBe(true);
  });

  test('S1/8 — 🎯 les CINQ portes de participation en profitent, pas seulement l absence', () => {
    // Cause racine : elles partagent `invalidateEventParticipationState`.
    // Ne reparer que la porte citee par le ticket aurait laisse 4 freres casses.
    [
      'acceptParticipationMutation',
      'createEventParticipationMutation',
      'declineParticipationMutation',
      'deleteParticipationMutation',
    ].forEach((nom) => {
      mockInvalidateQueries.mockClear();
      mutations[nom].options.onSuccess();
      expect(aInvalide(['eventAttendance', 'event-1'])).toBe(true);
    });
  });

  test('S1/9 — 🔒 ACQUIS : elle invalide toujours tout ce qu elle invalidait', () => {
    mutations.missingEventMutation.options.onSuccess();

    expect(aInvalide(['events'])).toBe(true);
    expect(aInvalide(['recruitmentAds'])).toBe(true);
    expect(aInvalide(['myApplications'])).toBe(true);
    expect(aInvalide(['event', 'event-1'])).toBe(true);
    expect(aInvalide(['eventParticipations', 'event-1'])).toBe(true);
    expect(aInvalide(['planning', 'personal'])).toBe(true);
  });

  test('S1/10 — 🔒 ACQUIS : les mutations de POINTAGE gardent leur invalidation', () => {
    // Le motif d origine, celui qu on recopie : il ne doit pas bouger.
    mockInvalidateQueries.mockClear();
    mutations.coachArrivalMutation.options.onSuccess();

    expect(aInvalide(['eventAttendance', 'event-1'])).toBe(true);
    expect(aInvalide(['teamStats'])).toBe(true);
  });
});
