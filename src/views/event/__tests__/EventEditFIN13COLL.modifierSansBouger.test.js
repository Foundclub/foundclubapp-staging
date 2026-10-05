/* eslint-disable max-len -- des phrases et des appels entiers, compares tels quels */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import EventEdit from '../EventEdit';

// 🧪 FINITIONS13-COLL (04/10/2026), point 6 — « Modifier » une séance acceptée AU-DELÀ de la
// capacité, SANS la déplacer : le serveur garde sa décision (FINITIONS11-COLL, `isSessionMoved`,
// tournée T12 F11C_5 : PUT 200, `status: confirmed`), mais l'écran annonçait « L'événement restera
// en demande en attente jusqu'au traitement d'un dirigeant. ». Le texte suit le serveur : rien
// n'est annoncé tant que la séance n'a pas bougé (même règle que l'aperçu du déplacement), et
// quand la MAIRIE décidera, ses deux phrases parlent seules. Banc : celui de
// EventEditFIN11COLL.deplacementMairie.test.js, repris tel quel ; FacilitySelector rend
// l'occupation que l'écran reçoit (installation pleine, demande à valider). ROUGE avant le lot.

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
  () => {
    const react = jest.requireActual('react');
    const rn = jest.requireActual('react-native');
    return function FacilitySelectorDouble(/** @type {any} */ props) {
      mockSelecteur.props = props;
      const { onOccupancyResolved } = props;
      react.useEffect(() => {
        onOccupancyResolved?.({ requiresApproval: true, saturated: true });
      }, [onOccupancyResolved]);
      return react.createElement(rn.Text, null, 'DOUBLURE_FacilitySelector');
    };
  },
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

// Ce que l'écran donne au sélecteur d'installation (point 8, « Modifier » sans le Gymnase).
/** @type {{ props: any }} */
const mockSelecteur = { props: null };

// Le juge du déplacement (FINITIONS11-COLL) est doublé : son crochet a son propre témoin.
const mockDecide = jest.fn(() => false);
jest.mock('@/services/seasonSlot/seasonSlotQueries', () => ({
  useMairieDecideDuDeplacement: (/** @type {any[]} */ ...args) => mockDecide(...args),
}));

jest.setTimeout(30000);

const eventService = jest.requireMock('@/services/event/eventService');

const LIBELLE_DATE = 'eventEdit.fields.date.label';
const EN_ATTENTE = 'Ce créneau dépasse la capacité de l’installation. L’événement restera en demande en attente jusqu’au traitement d’un dirigeant.';
const MAIRIE = 'Hors des créneaux de ton club : la mairie décidera, même s’il reste de la place.';

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

describe('FINITIONS13-COLL (8) — « Modifier » propose le lieu de la séance', () => {
  test('les installations de la Ville (comme l’assistant) et celle de la séance', async () => {
    await monter();
    expect(mockSelecteur.props?.withVilleSlots).toBe(true);
    expect(mockSelecteur.props?.currentFacility).toEqual(expect.objectContaining({ documentId: 'facility-1' }));
  });
});

describe('FINITIONS13-COLL (6) — « Modifier » suit la décision du serveur', () => {
  test('une séance modifiée SANS bouger : pas de « restera en demande en attente »', async () => {
    await monter();
    expect(textes()).toContain('DOUBLURE_FacilitySelector');
    expect(textes()).not.toContain(EN_ATTENTE);
  });

  test('une séance DÉPLACÉE sur une installation pleine (pas la mairie) : l’avertissement reste', async () => {
    await monter();
    await act(async () => {
      noeud(`date-${LIBELLE_DATE}`).props.onChange('16/05/2030');
    });
    await laisserRepondre();
    expect(textes()).toContain(EN_ATTENTE);
  });

  test('la MAIRIE décidera : ses phrases parlent seules, pas « traitement d’un dirigeant »', async () => {
    mockDecide.mockReturnValue(true);
    await monter();
    await act(async () => {
      noeud(`date-${LIBELLE_DATE}`).props.onChange('16/05/2030');
    });
    await laisserRepondre();
    expect(textes()).toContain(MAIRIE);
    expect(textes()).not.toContain(EN_ATTENTE);
  });
});
