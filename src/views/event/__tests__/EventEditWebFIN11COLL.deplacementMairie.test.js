/* eslint-disable max-len -- des phrases entieres, comparees telles quelles */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

import EventEdit from '../EventEdit.web';

// 🧪 FINITIONS11-COLL (03/10/2026), point 7 — décision d'Adel « deplacer A », côté SITE : le formulaire
// du site (EventEdit.web.js) dit, comme le téléphone, « Si la mairie refuse, la séance sera annulée. »
// AVANT les boutons, quand la séance est déplacée hors du créneau du club. Le juge (le crochet
// useMairieDecideDuDeplacement) est doublé : son propre témoin prouve la question au serveur. ROUGE avant.

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

const MAIRIE = 'Hors des créneaux de ton club : la mairie décidera, même s’il reste de la place.';
const ANNULEE = 'Si la mairie refuse, la séance sera annulée.';
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

/** @type {any} */
let arbre = null;

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
  for (let tour = 0; tour < 20; tour += 1) {
    // eslint-disable-next-line no-await-in-loop -- les tours sont sequentiels par nature
    await act(async () => {
      await new Promise((resoudre) => { setTimeout(resoudre, 0); });
    });
  }
};

const aplatir = (/** @type {any} */ noeud) => {
  if (noeud === null || noeud === undefined || typeof noeud === 'boolean') return '';
  if (typeof noeud === 'string' || typeof noeud === 'number') return String(noeud);
  if (Array.isArray(noeud)) return noeud.map(aplatir).join('');
  return aplatir(noeud.children);
};
const blocDecision = () => arbre.root.findAll(
  (/** @type {any} */ n) => n.type === 'div' && n.props['data-testid'] === 'event-edit-mairie-decide',
)[0];

beforeEach(() => {
  mockDecide.mockReset();
  mockDecide.mockReturnValue(false);
  eventService.getEventByIdForEdit.mockReset();
  eventService.getEventByIdForEdit.mockResolvedValue(SEANCE);
});

afterEach(() => {
  if (arbre) {
    act(() => { arbre.unmount(); });
    arbre = null;
  }
});

describe('FINITIONS11-COLL (7) — le site dit aussi « Si la mairie refuse, la séance sera annulée. »', () => {
  test('la mairie ne décidera pas : aucune phrase', async () => {
    await monter();
    expect(blocDecision()).toBeUndefined();
    expect(aplatir(arbre.toJSON())).not.toContain(ANNULEE);
  });

  test('le formulaire donne au juge la séance enregistrée et sa saisie', async () => {
    await monter();
    const [seance, saisie] = mockDecide.mock.calls[mockDecide.mock.calls.length - 1];
    expect(seance?.documentId).toBe('event-1');
    expect(saisie).toEqual({
      club: 'club-1', debut: '18:30', facilityId: 'facility-1', fin: '20:00', jour: '2030-05-15', team: 'team-1',
    });
  });

  test('la mairie décidera : les deux phrases, avant les boutons « Annuler » et « Enregistrer »', async () => {
    mockDecide.mockReturnValue(true);
    await monter();
    const bloc = blocDecision();
    expect(bloc).toBeTruthy();
    expect(aplatir(bloc)).toContain(MAIRIE);
    expect(aplatir(bloc)).toContain(ANNULEE);
    const texte = aplatir(arbre.toJSON());
    expect(texte.indexOf(ANNULEE)).toBeLessThan(texte.lastIndexOf('Annuler'));
  });
});
