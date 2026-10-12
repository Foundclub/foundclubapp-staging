/* eslint-disable max-len -- des phrases entieres, comparees telles quelles */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

import EventEdit from '../EventEdit.web';

// 🧪 SERIES (08/10/2026, décision du chef d'orchestre, point 2 de sa réponse) — LE SITE JETAIT LA PORTÉE.
// Le formulaire du site (EventEdit.web.js) propose « Cet événement / Cet événement et les suivants /
// Toute la série », mais sa mutation (`mutationFn`) n'envoyait que `documentId` et `eventData` : « Toute
// la série » ne modifiait qu'UNE date, sans rien dire. ROUGE avant le lot. Ce fichier exige :
//   - « Toute la série » / « Cet événement et les suivants » : `recurrenceMode` 'all' / 'future' part ;
//   - « Cet événement » : rien (la date seule, comme avant) ;
//   - le serveur neuf rend son bilan (`meta.recurrence`) : des dates attendent la Ville => le site le dit
//     (fenêtre du navigateur, comme Conversation.web.js), PUIS ouvre la fiche ; sans bilan : rien.

const mockNavigation = {
  goBack: jest.fn(), navigate: jest.fn(), replace: jest.fn(), setOptions: jest.fn(),
};

const mockDecide = jest.fn(() => false);
jest.mock('@/services/seasonSlot/seasonSlotQueries', () => ({
  useMairieDecideDuDeplacement: (/** @type {any[]} */ ...args) => mockDecide(...args),
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
  createEvent: jest.fn(() => Promise.resolve({})),
  getEventByIdForEdit: jest.fn(),
  getEventTypes: jest.fn(() => Promise.resolve([{ documentId: 'type-entrainement', name: 'Entrainement' }])),
  updateEvent: jest.fn(() => Promise.resolve({})),
}));
jest.mock('@/services/facility/facilityQueries', () => ({
  // FINITIONS16 · 4 : le formulaire lit aussi l omnisport et la Ville (listes vides ici).
  useGetClubVilleFacilitiesWithSlots: () => ({ data: undefined }),
  useGetCMFacilities: () => ({ data: undefined }),
  useGetFacilities: () => ({
    data: [{ documentId: 'facility-1', name: 'Gymnase des Tilleuls' }], error: null, isLoading: false,
  }),
}));
jest.mock('@/services/team/teamService', () => ({
  getTeams: jest.fn(() => Promise.resolve({ data: [{ club: { documentId: 'club-1' }, documentId: 'team-1', name: 'U15' }] })),
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
  recurrenceGroupId: 'serie-1',
  sessionStatus: 'closed',
  startTime: '18:30:00.000',
  team: { club: { documentId: 'club-1' }, documentId: 'team-1' },
  teamAudiences: [],
  type: { documentId: 'type-entrainement', name: 'Entrainement' },
  validationMode: 'manual',
};

/** @type {any} */
let arbre = null;

const monter = async () => {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, retry: false } } });
  act(() => {
    arbre = renderer.create(createElement(
      QueryClientProvider,
      { client },
      createElement(EventEdit, {
        navigation: mockNavigation,
        route: { params: { eventId: 'event-1' } },
      }),
    ));
  });
  for (let tour = 0; tour < 20; tour += 1) {
    // eslint-disable-next-line no-await-in-loop -- les tours sont sequentiels par nature
    await act(async () => {
      await new Promise((resoudre) => { setTimeout(resoudre, 0); });
    });
  }
};

beforeEach(() => {
  mockDecide.mockReset();
  mockDecide.mockReturnValue(false);
  mockNavigation.replace.mockReset();
  eventService.getEventByIdForEdit.mockReset();
  eventService.getEventByIdForEdit.mockResolvedValue(SEANCE);
  eventService.updateEvent.mockReset();
  eventService.updateEvent.mockResolvedValue({ data: { documentId: 'event-1', status: 'confirmed' }, meta: {} });
});

afterEach(() => {
  if (arbre) {
    act(() => { arbre.unmount(); });
    arbre = null;
  }
});

const choisirLaPortee = async (/** @type {string} */ portee) => {
  const [liste] = arbre.root.findAll((/** @type {any} */ n) => n.type === 'select'
    && (n.props.children || []).some?.((/** @type {any} */ o) => o?.props?.value === 'all'));
  await act(async () => { liste.props.onChange({ target: { value: portee } }); });
};
const envoyer = async () => {
  const [formulaire] = arbre.root.findAll((/** @type {any} */ n) => n.type === 'form');
  await act(async () => { await formulaire.props.onSubmit({ preventDefault: () => {} }); });
  for (let tour = 0; tour < 5; tour += 1) {
    // eslint-disable-next-line no-await-in-loop -- les tours sont sequentiels par nature
    await act(async () => { await new Promise((resoudre) => { setTimeout(resoudre, 0); }); });
  }
};

describe('SERIES — le site envoie la portée choisie, et dit les dates en attente', () => {
  test.each([['all'], ['future']])('« %s » : recurrenceMode part avec l enregistrement', async (portee) => {
    await monter();
    await choisirLaPortee(portee);
    await envoyer();
    expect(eventService.updateEvent).toHaveBeenCalledTimes(1);
    expect(eventService.updateEvent.mock.calls[0][0]).toEqual(expect.objectContaining({ documentId: 'event-1', recurrenceMode: portee }));
  });

  test('« Cet événement » : la date seule, comme avant', async () => {
    await monter();
    await envoyer();
    expect(eventService.updateEvent.mock.calls[0][0].recurrenceMode).toBeUndefined();
  });

  test('« Toute la série » qui met des dates en attente de la Ville : le site le dit, puis ouvre la fiche', async () => {
    const alerte = jest.fn();
    /** @type {any} */ (window).alert = alerte;
    eventService.updateEvent.mockResolvedValue({
      data: { documentId: 'event-1', pendingReason: 'facility_overbooking', status: 'pending_validation' },
      meta: {
        recurrence: {
          awaitingCity: 2, awaitingClub: 0, moved: 2, updated: 2,
        },
      },
    });
    await monter();
    await choisirLaPortee('all');
    await envoyer();
    expect(alerte).toHaveBeenCalledTimes(1);
    expect(alerte.mock.calls[0][0]).toContain('eventEdit.modals.seriesOutcome.awaitingCity');
    expect(mockNavigation.replace).toHaveBeenCalledWith('EventDetails', { eventId: 'event-1' });
    delete /** @type {any} */ (window).alert;
  });

  test('sans bilan (serveur d avant) : aucune fenêtre, la fiche s ouvre', async () => {
    const alerte = jest.fn();
    /** @type {any} */ (window).alert = alerte;
    await monter();
    await choisirLaPortee('all');
    await envoyer();
    expect(alerte).not.toHaveBeenCalled();
    expect(mockNavigation.replace).toHaveBeenCalledWith('EventDetails', { eventId: 'event-1' });
    delete /** @type {any} */ (window).alert;
  });
});
