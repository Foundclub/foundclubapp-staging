/* eslint-disable max-len -- des phrases entieres, comparees telles quelles */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

import EventEdit from '../EventEdit.web';

process.env.TZ = 'Europe/Paris';

// BH07 (24/10) — P7-08 : une seance qui commence a 1 h 30 a Paris (23:30 UTC la veille) ne doit
// pas reculer d'un jour a la modification. P7-10 : vider l'adresse doit l'effacer (null envoye).
// Montage repris de EventEditWebSERIES.portee.test.js.

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
  date: '2030-05-15T23:30:00.000Z',
  description: 'Seance technique',
  documentId: 'event-1',
  endTime: '20:00:00.000',
  eventTasks: [],
  facility: { documentId: 'facility-1' },
  invitedTeams: [],
  location: { lat: 43.3, lng: 5.4 },
  locationDetails: JSON.stringify({ address: { label: '21 rue Fortia' } }),
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

const envoyer = async () => {
  const [formulaire] = arbre.root.findAll((/** @type {any} */ n) => n.type === 'form');
  await act(async () => { await formulaire.props.onSubmit({ preventDefault: () => {} }); });
  for (let tour = 0; tour < 5; tour += 1) {
    // eslint-disable-next-line no-await-in-loop -- les tours sont sequentiels par nature
    await act(async () => { await new Promise((resoudre) => { setTimeout(resoudre, 0); }); });
  }
};

test('P7-08 — la date ouverte est le jour de Paris, pas le jour UTC', async () => {
  await monter();
  const champs = arbre.root.findAll((/** @type {any} */ n) => n.type === 'input' && n.props.type === 'date');
  expect(champs.map((/** @type {any} */ c) => c.props.value)).toContain('2030-05-16');
});

test('P7-10 — vider l adresse l efface', async () => {
  await monter();
  const [champ] = arbre.root.findAll((/** @type {any} */ n) => n.type === 'input'
    && n.props.value === '21 rue Fortia');
  await act(async () => { champ.props.onChange({ target: { value: '' } }); });
  await envoyer();
  const charge = eventService.updateEvent.mock.calls[0][0].eventData;
  expect(charge.location).toBeNull();
  expect(charge.locationDetails).toBeNull();
});
