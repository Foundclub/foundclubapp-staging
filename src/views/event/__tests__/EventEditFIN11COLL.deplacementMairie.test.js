/* eslint-disable max-len -- des phrases et des appels entiers, compares tels quels */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import EventEdit from '../EventEdit';

// 🧪 FINITIONS11-COLL (03/10/2026), point 7 — décision d'Adel « deplacer A » : un club qui DÉPLACE une
// séance hors de son créneau lit, AVANT d'enregistrer, « Si la mairie refuse, la séance sera
// annulée. » (le serveur annule la séance refusée : COLL-C2B-BIS, circuit des demandes). Les
// doublures sont celles d'EventEditSaisieRelecture.test.js, reprises telles quelles. ROUGE avant.

jest.mock('react-i18next', () => ({
  ...jest.requireActual('react-i18next'),
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => (
      typeof repli === 'string' ? repli : cle
    ),
  }),
}));

// Publie en TypeScript non transforme : sans doublure, la SUITE ENTIERE meurt
// au chargement et aucun test ne s'execute (piege connu du depot).
jest.mock('react-native-gesture-handler', () => {
  const { ScrollView: DefilementRN } = jest.requireActual('react-native');
  return { ScrollView: DefilementRN };
});

// ⛔ Jamais un Proxy pour le theme : il rend les echecs Jest illisibles.
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
      Images: new Proxy({}, { get: () => 1 }),
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

// ⛔ Jamais `requireActual` sur un service : le client HTTP exige `API_URL`,
// absent de toute copie de travail, et la suite entiere meurt au chargement.
jest.mock('@/services/event/eventService', () => ({
  createEvent: jest.fn(() => Promise.resolve({})),
  getEventByIdForEdit: jest.fn(() => Promise.resolve(null)),
  getEventTypes: jest.fn(() => Promise.resolve([
    { documentId: 'type-entrainement', name: 'Entrainement' },
    { documentId: 'type-detection', name: 'Detection' },
  ])),
  updateEvent: jest.fn(() => Promise.resolve({})),
}));

jest.mock('@/services/team/teamService', () => ({
  getTeams: jest.fn(() => Promise.resolve({ data: [] })),
}));

jest.mock('@/components/molecules/autocompleteSelect/AutocompleteSelect', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function AutocompleteSelectDouble(/** @type {any} */ props) {
    return react.createElement(rn.View, {
      testID: `select-${props.label || 'sans-libelle'}`,
      valeurAffichee: props.value,
    });
  };
});

// 🎯 LES TROIS DOUBLURES QUI FONT LE TRAVAIL : elles gardent `value` (ce que
// l'ecran AFFICHE) et le rappel de saisie (ce que le doigt ENVOIE). Le temoin
// saisit par le meme chemin que le calendrier, l'horloge et le clavier.
/* eslint-disable global-require */
jest.mock('@/components/molecules/datePickerInput/DatePickerInput', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function DatePickerInputDouble(/** @type {any} */ props) {
    return react.createElement(rn.View, {
      onChange: props.onChange,
      testID: `date-${props.label || 'sans-libelle'}`,
      value: props.value,
    });
  };
});
jest.mock('@/components/molecules/timePickerInput/TimePickerInput', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function TimePickerInputDouble(/** @type {any} */ props) {
    return react.createElement(rn.View, {
      onChange: props.onChange,
      testID: `heure-${props.label || 'sans-libelle'}`,
      value: props.value,
    });
  };
});
jest.mock('@/components/molecules/input/Input', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function InputDouble(/** @type {any} */ props) {
    return react.createElement(rn.View, {
      onChangeText: props.onChangeText,
      testID: `champ-${props.label || 'sans-libelle'}`,
      value: props.value,
    });
  };
});
jest.mock('@/components/atoms/button/Button', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function BoutonDouble(/** @type {any} */ props) {
    return react.createElement(rn.View, {
      disabled: Boolean(props.disabled),
      onPress: props.onPress,
      testID: `bouton-${props.title || 'sans-titre'}`,
    });
  };
});
jest.mock(
  '@/components/molecules/dayPicker/DayPicker',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_DayPicker'),
);
jest.mock(
  '@/components/organisms/facilitySelector/FacilitySelector',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_FacilitySelector'),
);
jest.mock(
  '@/components/templates/ScreenContainer',
  () => {
    const react = jest.requireActual('react');
    const rn = jest.requireActual('react-native');
    return function ScreenContainerDouble(/** @type {any} */ props) {
      return react.createElement(rn.View, null, props.children);
    };
  },
);
jest.mock(
  '../components/EventTasksEditor',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_EventTasksEditor'),
);
jest.mock(
  '../components/EventTeamAudiencesEditor',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_EventTeamAudiencesEditor'),
);
/* eslint-enable global-require */

// FINITIONS11-COLL (03/10), point 7 — le crochet du juge est DOUBLÉ : ce témoin prouve ce que
// l'écran en fait (sa saisie, et la phrase). Le crochet lui-même a son témoin
// (useMairieDecideDuDeplacement.FIN11COLL.test.js).
const mockDecide = jest.fn(() => false);
jest.mock('@/services/seasonSlot/seasonSlotQueries', () => ({
  useMairieDecideDuDeplacement: (/** @type {any[]} */ ...args) => mockDecide(...args),
}));

jest.setTimeout(30000);

const eventService = jest.requireMock('@/services/event/eventService');

const LIBELLE_DATE = 'eventEdit.fields.date.label';
const MAIRIE = 'Hors des créneaux de ton club : la mairie décidera, même s’il reste de la place.';
const ANNULEE = 'Si la mairie refuse, la séance sera annulée.';

/** @type {any} */
let arbre = null;

const evenementLu = () => ({
  date: new Date(2030, 4, 15, 18, 30),
  description: 'Seance technique',
  documentId: 'event-1',
  endTime: '20:00:00.000',
  eventTasks: [],
  facility: { documentId: 'facility-1' },
  invitedTeams: [],
  participantIdentityVisibility: 'VISIBLE',
  sessionStatus: 'closed',
  startTime: '18:30:00.000',
  team: { documentId: 'team-1' },
  teamAudiences: [],
  type: { documentId: 'type-entrainement', name: 'Entrainement' },
  validationMode: 'manual',
});

const laisserRepondre = async () => {
  for (let tour = 0; tour < 20; tour += 1) {
    // eslint-disable-next-line no-await-in-loop -- les tours sont sequentiels par nature
    await act(async () => {
      await new Promise((resoudre) => { setTimeout(resoudre, 0); });
    });
  }
};

const monter = async () => {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, retry: false } } });
  act(() => {
    arbre = renderer.create(createElement(
      QueryClientProvider,
      { client },
      createElement(EventEdit, {
        navigation: {
          canGoBack: () => false,
          goBack: jest.fn(),
          navigate: jest.fn(),
          popTo: jest.fn(),
          replace: jest.fn(),
          setOptions: jest.fn(),
        },
        route: { params: { eventId: 'event-1' } },
      }),
    ));
  });
  await laisserRepondre();
};

const aplatir = (/** @type {any} */ enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatir).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatir(enfants?.props?.children);
  return String(enfants);
};
const textes = () => arbre.root.findAllByType(Text).map((n) => aplatir(n.props.children).trim());
const noeud = (/** @type {string} */ testID) => arbre.root.findAll(
  (/** @type {any} */ candidat) => candidat.props?.testID === testID,
  { deep: false },
)[0];

beforeEach(() => {
  mockDecide.mockReset();
  mockDecide.mockReturnValue(false);
  eventService.getEventByIdForEdit.mockReset();
  eventService.getEventByIdForEdit.mockImplementation(() => Promise.resolve(evenementLu()));
});

afterEach(() => {
  if (arbre) {
    act(() => { arbre.unmount(); });
    arbre = null;
  }
});

describe('FINITIONS11-COLL (7) — « Si la mairie refuse, la séance sera annulée. »', () => {
  test('la mairie ne décidera pas : aucune phrase', async () => {
    await monter();
    expect(textes()).not.toContain(ANNULEE);
  });

  test('l écran donne au juge la séance enregistrée et la saisie, au jour près', async () => {
    await monter();
    await act(async () => {
      noeud(`date-${LIBELLE_DATE}`).props.onChange('16/05/2030');
    });
    await laisserRepondre();
    const [seance, saisie] = mockDecide.mock.calls[mockDecide.mock.calls.length - 1];
    expect(seance?.documentId).toBe('event-1');
    expect(saisie).toEqual({
      club: 'club-1', debut: '18:30', facilityId: 'facility-1', fin: '20:00', jour: '2030-05-16', team: 'team-1',
    });
  });

  test('la mairie décidera : les deux phrases, juste au-dessus de « Enregistrer »', async () => {
    mockDecide.mockReturnValue(true);
    await monter();
    const lus = textes();
    expect(lus).toContain(MAIRIE);
    expect(lus).toContain(ANNULEE);
    const avertissement = noeud('event-edit-mairie-decide');
    expect(avertissement).toBeTruthy();
    const zone = avertissement.parent;
    const enfants = zone.children.filter((/** @type {any} */ enfant) => typeof enfant !== 'string');
    const rangAvertissement = enfants.indexOf(avertissement);
    const rangBouton = enfants.findIndex((/** @type {any} */ enfant) => enfant.props?.title === 'eventEdit.actions.save');
    expect(rangAvertissement).toBeGreaterThanOrEqual(0);
    expect(rangBouton).toBe(rangAvertissement + 1);
  });
});
