/* eslint-disable max-len -- des appels entiers, compares tels quels */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import EventEdit from '../EventEdit';

// ⌨️ SAIS (08/10/2026, tournée T20 lot 3 « EVENTEDIT-CLAVIER ») — « Modifier l'événement » de type
// RÉSERVATION affichait « Heure de début » / « Heure de fin » DEUX FOIS (capture T10e) : tapées au
// clavier numérique (masque qui laisse passer 25:70), PUIS en sélecteurs. Les sélecteurs suffisent :
// la paire tapée part. Et la récurrence d'une CRÉATION (dates « DD/MM/YYYY » tapées) n'est jamais
// atteinte : le seul appelant (EventDetails.js, « Modifier ») ouvre toujours l'écran AVEC
// `eventId`, et aucun lien n'y mène (appNavigator : EventDetails seul) ; elle part aussi.
// Banc : celui d'EventEditFIN13COLL.modifierSansBouger.test.js, repris tel quel.

jest.mock('react-i18next', () => ({
  ...jest.requireActual('react-i18next'),
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => (
      typeof repli === 'string' ? repli : cle
    ),
  }),
}));

// Publie en TypeScript non transforme : sans doublure, la SUITE ENTIERE meurt au chargement.
jest.mock('react-native-gesture-handler', () => {
  const { ScrollView: DefilementRN } = jest.requireActual('react-native');
  return { ScrollView: DefilementRN };
});

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

// ⛔ Jamais `requireActual` sur un service : le client HTTP exige `API_URL`.
jest.mock('@/services/event/eventService', () => ({
  createEvent: jest.fn(() => Promise.resolve({})),
  getEventByIdForEdit: jest.fn(() => Promise.resolve(null)),
  getEventTypes: jest.fn(() => Promise.resolve([
    { documentId: 'type-entrainement', name: 'Entrainement' },
    { documentId: 'type-reservation', name: 'Réservation' },
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

// Chaque doublure garde ce que l'écran AFFICHE (`value`) et son rappel de saisie ; son testID dit
// la FAMILLE du champ : `champ-` = clavier, `heure-` = sélecteur d'heure, `date-` = calendrier.
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
      keyboardType: props.keyboardType,
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

jest.mock('@/services/seasonSlot/seasonSlotQueries', () => ({
  useMairieDecideDuDeplacement: () => false,
}));

jest.setTimeout(30000);

const eventService = jest.requireMock('@/services/event/eventService');

const DEBUT = 'eventEdit.fields.startTime.label';
const FIN = 'eventEdit.fields.endTime.label';

/** @type {any} */
let arbre = null;

const reservationLue = () => ({
  date: new Date(2030, 4, 15, 18, 30),
  description: 'Five du jeudi',
  documentId: 'event-1',
  endTime: '20:00:00.000',
  eventTasks: [],
  facility: { documentId: 'facility-1' },
  invitedTeams: [],
  participantIdentityVisibility: 'VISIBLE',
  pricePerPerson: 6,
  startTime: '18:30:00.000',
  team: { documentId: 'team-1' },
  teamAudiences: [],
  totalPlayers: 10,
  type: { documentId: 'type-reservation', name: 'Réservation' },
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
const noeuds = (/** @type {string} */ testID) => arbre.root.findAll(
  (/** @type {any} */ candidat) => candidat.props?.testID === testID,
  { deep: false },
);

beforeEach(() => {
  eventService.getEventByIdForEdit.mockReset();
  eventService.getEventByIdForEdit.mockImplementation(() => Promise.resolve(reservationLue()));
});

afterEach(() => {
  if (arbre) {
    act(() => { arbre.unmount(); });
    arbre = null;
  }
});

describe('SAIS lot 3 — « Modifier l’événement » d’une Réservation : les heures se CHOISISSENT, une fois', () => {
  test('SAIS-3/1 aucune heure tapée au clavier ; un seul sélecteur de début, un seul de fin, remplis', async () => {
    await monter();
    expect(noeuds(`champ-${DEBUT}`)).toHaveLength(0);
    expect(noeuds(`champ-${FIN}`)).toHaveLength(0);
    expect(noeuds(`heure-${DEBUT}`)).toHaveLength(1);
    expect(noeuds(`heure-${FIN}`)).toHaveLength(1);
    expect(noeuds(`heure-${DEBUT}`)[0].props.value).toBe('18:30');
    expect(noeuds(`heure-${FIN}`)[0].props.value).toBe('20:00');
  });

  test('SAIS-3/2 ce qui est propre à la Réservation reste : prix par personne, joueurs', async () => {
    await monter();
    expect(noeuds('champ-eventEdit.fields.pricePerPerson.label')).toHaveLength(1);
    expect(noeuds('champ-eventEdit.fields.totalPlayers.label')).toHaveLength(1);
  });

  test('SAIS-3/3 « Modifier » ne montre jamais la récurrence d’une création (dates tapées « DD/MM/YYYY »)', async () => {
    await monter();
    expect(textes()).not.toContain('eventEdit.fields.isRecurrent.label');
    expect(noeuds('champ-eventEdit.fields.recurrenceStartDate.label')).toHaveLength(0);
    expect(noeuds('champ-eventEdit.fields.recurrenceEndDate.label')).toHaveLength(0);
  });
});
