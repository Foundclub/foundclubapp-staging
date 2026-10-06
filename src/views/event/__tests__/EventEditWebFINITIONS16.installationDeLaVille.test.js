import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

import EventEdit from '../EventEdit.web';

// 🧪 FINITIONS16 · POINT 4 (tournee T15, photo SITE_C45) — « Modifier » d'un entrainement au
// GYMNASE, SUR LE SITE : la liste « Installation » affichait « Aucune installation ». Le
// formulaire du site ne lisait que les installations DU CLUB ; le Gymnase est une installation
// de la Ville ou le club a un creneau. Le telephone le propose depuis FINITIONS13-COLL
// (`FacilitySelector` : installations du club, de l omnisport, de la Ville ou le club a un
// creneau, et toujours celle de la seance). Meme liste, une seule source :
// `eventFacilityOptions` (domains/seasonSlot/clubInstallations.js). ROUGE avant.

const mockInstallationsDeLaVille = { data: /** @type {any[]} */ ([]) };

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
      trainedTeams: [{ club: { documentId: 'club-1' }, documentId: 'team-1', name: 'Senior B' }],
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
// Les installations DU CLUB : le Club-house seulement. Le Gymnase n'y est pas : il est a la Ville.
jest.mock('@/services/facility/facilityQueries', () => ({
  useGetCMFacilities: () => ({ data: { data: [] }, error: null, isLoading: false }),
  useGetClubVilleFacilitiesWithSlots: () => ({
    data: mockInstallationsDeLaVille.data, error: null, isLoading: false,
  }),
  useGetFacilities: () => ({
    data: [{ documentId: 'club-house', name: 'Club-house' }], error: null, isLoading: false,
  }),
}));
jest.mock('@/services/team/teamService', () => ({
  getTeams: jest.fn(() => Promise.resolve({ data: [{ club: { documentId: 'club-1' }, documentId: 'team-1', name: 'Senior B' }] })),
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

const GYMNASE = { documentId: 'gymnase-ville', name: 'Gymnase municipal' };
const SEANCE_AU_GYMNASE = {
  date: '2030-10-16T16:30:00.000Z',
  description: 'Seance au gymnase',
  documentId: 'event-1',
  endTime: '19:30:00.000',
  eventTasks: [],
  facility: GYMNASE,
  invitedTeams: [],
  sessionStatus: 'closed',
  startTime: '18:00:00.000',
  team: { club: { documentId: 'club-1' }, documentId: 'team-1' },
  teamAudiences: [],
  type: { documentId: 'type-entrainement', name: 'Entrainement' },
  validationMode: 'manual',
};

/** @type {any} */
let arbre = null;

/** La liste « Installation » : le seul `<select>` dont une option dit « Aucune installation ». */
const listeInstallation = () => arbre.root.findAll(
  (/** @type {any} */ n) => n.type === 'select'
    && n.findAll((/** @type {any} */ o) => o.type === 'option' && o.props.value === '').length > 0
    && n.findAll((/** @type {any} */ o) => o.type === 'option' && [].concat(o.props.children).join('') === 'Aucune installation').length > 0,
)[0];

const options = () => listeInstallation().findAll((/** @type {any} */ o) => o.type === 'option')
  .map((/** @type {any} */ o) => ({ libelle: [].concat(o.props.children).join(''), valeur: o.props.value }));

// Borne en TEMPS, pas en tours (piege « attente comptee en tours » : instable sous charge).
const monter = async () => {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, retry: false } } });
  act(() => {
    arbre = renderer.create(createElement(
      QueryClientProvider,
      { client },
      createElement(EventEdit, {
        navigation: {
          goBack: jest.fn(), navigate: jest.fn(), replace: jest.fn(), setOptions: jest.fn(),
        },
        route: { params: { eventId: 'event-1' } },
      }),
    ));
  });
  const limite = Date.now() + 10000;
  while (Date.now() < limite && listeInstallation()?.props.value !== GYMNASE.documentId) {
    // eslint-disable-next-line no-await-in-loop -- attente sequentielle par nature
    await act(async () => {
      await new Promise((resoudre) => { setTimeout(resoudre, 10); });
    });
  }
};

beforeEach(() => {
  mockInstallationsDeLaVille.data = [];
  eventService.getEventByIdForEdit.mockReset();
  eventService.getEventByIdForEdit.mockResolvedValue(SEANCE_AU_GYMNASE);
});

afterEach(() => {
  if (arbre) {
    act(() => { arbre.unmount(); });
    arbre = null;
  }
});

describe('FINITIONS16 4 — « Modifier » une seance au Gymnase, sur le site', () => {
  test('🔴 le Gymnase de la Ville (creneau du club) est propose, et c est lui qui est choisi', async () => {
    mockInstallationsDeLaVille.data = [{ ...GYMNASE, clubSeasonSlots: [] }];
    await monter();

    expect(listeInstallation().props.value).toBe(GYMNASE.documentId);
    expect(options()).toContainEqual({ libelle: 'Gymnase municipal', valeur: GYMNASE.documentId });
    expect(options()).toContainEqual({ libelle: 'Club-house', valeur: 'club-house' });
  });

  test('🔴 meme absent des listes lues, l installation ACTUELLE de la seance reste proposee', async () => {
    await monter();

    expect(options()).toContainEqual({ libelle: 'Gymnase municipal', valeur: GYMNASE.documentId });
    expect(options().filter((o) => o.valeur === GYMNASE.documentId)).toHaveLength(1);
  });
});
