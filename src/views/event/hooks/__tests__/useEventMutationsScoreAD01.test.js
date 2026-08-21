import renderer, { act } from 'react-test-renderer';

import { saveEventMatchResult } from '@/services/matchStats/matchStatsService';

import { useEventMutations } from '../useEventMutations';

// ==========================================================================
// AD01 — LA DERNIERE COUTURE DU SCORE, CELLE QUE PERSONNE NE VOYAIT.
//
// 🧵 `EventDetailsPortesAD01` prouve que la feuille appelle bien la mutation
// avec `{ eventId, scoreFor, scoreAgainst, teamId }`. Mais entre cette mutation
// et le serveur, il reste UN maillon : le `mutationFn` de ce hook, qui doit
// rappeler `saveEventMatchResult(eventId, { ... })` — deux arguments, pas un.
//
// 🧨 C'est exactement le genre de maillon qui casse en silence : l'ecran dit
// « enregistre », et la charge part vide ou mal formee. Le projet a deja paye
// ce defaut (une charge recopiee clef par clef qui en oubliait trois).
// Ce temoin lit le vrai appel au service, pas une intention.
// ==========================================================================

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: jest.fn(), navigate: jest.fn() }),
}));

jest.mock('react-i18next', () => ({
  ...jest.requireActual('react-i18next'),
  useTranslation: () => ({ t: (/** @type {string} */ cle) => cle }),
}));

jest.mock('@tanstack/react-query', () => ({
  // La doublure GARDE les options : c'est ce qui rend le `mutationFn`
  // appelable directement, sans faire tourner react-query.
  useMutation: (/** @type {any} */ options) => ({
    isPending: false,
    mutate: jest.fn(),
    mutateAsync: jest.fn(),
    options,
  }),
  useQueryClient: () => ({ invalidateQueries: jest.fn(), setQueryData: jest.fn() }),
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

describe('AD01 — le maillon entre la feuille du score et le serveur', () => {
  test('la mutation existe, la ou toutes les ecritures de cet ecran vivent deja', () => {
    expect(typeof mutations.saveMatchResultMutation?.options?.mutationFn).toBe('function');
  });

  test('elle appelle le service avec l evenement A PART, et les deux scores dedans', () => {
    mutations.saveMatchResultMutation.options.mutationFn({
      eventId: 'event-77',
      scoreAgainst: 1,
      scoreFor: 3,
      teamId: 'team-9',
    });

    expect(saveEventMatchResult).toHaveBeenCalledWith(
      'event-77',
      { scoreAgainst: 1, scoreFor: 3, teamId: 'team-9' },
    );
  });

  test('un score de ZERO part bien — il ne se perd pas dans un test de verite', () => {
    mutations.saveMatchResultMutation.options.mutationFn({
      eventId: 'event-77',
      scoreAgainst: 0,
      scoreFor: 0,
      teamId: 'team-9',
    });

    expect(saveEventMatchResult).toHaveBeenCalledWith(
      'event-77',
      { scoreAgainst: 0, scoreFor: 0, teamId: 'team-9' },
    );
  });
});
