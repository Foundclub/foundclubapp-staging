/* eslint-disable max-len -- des phrases entières, comparées telles quelles */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { addDays, format } from 'date-fns';
import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

import { createReccurrentEventPayload } from '@/domains/event/eventUseCases';

import DateEtHoraire from '@/components/organisms/dateEtHoraire/DateEtHoraire';

import { EventWizardProvider, useEventWizard } from '../EventWizardContext';
import EventWizardLogistics from '../EventWizardLogistics';

// VACANCES-REPETE (04/11/2026, retour de testeur M0707, décision d'Adel « 55/ B ») — « Quand je mets
// un entrainement répéter sur un créneau d'une installation de la ville prévu avec la mention "sauf
// vacances scolaires" les entrainements se créait quand meme pendant les vacances scolaires ».
// Les doublures du service reprennent le contrat du serveur : le planning refuse plus de 31 jours
// (`resolveFacilityPlanningWindow`), l'aperçu des créneaux rend la zone de la période demandée.

// Horloge fixée à 14 h : passé 23 h, l'écran reporte une séance au lendemain, un autre jour que le créneau.
jest.useFakeTimers({
  doNotFake: [
    'cancelAnimationFrame', 'cancelIdleCallback', 'clearImmediate', 'clearInterval', 'clearTimeout',
    'hrtime', 'nextTick', 'performance', 'queueMicrotask', 'requestAnimationFrame',
    'requestIdleCallback', 'setImmediate', 'setInterval', 'setTimeout',
  ],
  now: new Date(2027, 8, 15, 14, 0, 0),
});

const mockJour = (/** @type {number} */ decalage) => format(addDays(new Date(), decalage), 'yyyy-MM-dd');
const TOUSSAINT = {
  end: mockJour(27), key: 'toussaint', name: 'Toussaint', start: mockJour(14),
};
const NOEL = {
  end: mockJour(69), key: 'noel', name: 'Noël', start: mockJour(56),
};
const mockVacances = {
  label: 'Zone B', periods: [TOUSSAINT, NOEL], zone: 'B',
};
const mockLectureDuPlanning = jest.fn();
const mockLectureDeLApercu = jest.fn();
/** @type {any[]} */
const mockGabarits = [];
let mockVille = /** @type {any[]} */ ([]);

jest.mock('@/services/facility/facilityService', () => ({
  getFacilityPlanning: (/** @type {any[]} */ ...args) => mockLectureDuPlanning(...args),
}));
jest.mock('@/services/seasonSlot/seasonSlotService', () => ({
  previewFacilitySeasonSlot: (/** @type {any[]} */ ...args) => mockLectureDeLApercu(...args),
}));
jest.mock('@/services/facility/facilityQueries', () => ({
  useGetClubVilleFacilitiesWithSlots: (/** @type {any} */ club) => ({ data: club ? mockVille : [] }),
  useGetFacilityHolidays: jest.requireActual('@/services/facility/facilityQueries').useGetFacilityHolidays,
  useGetFacilityOccupancy: () => ({
    data: { data: { blocked: false, saturated: false } },
    isError: false,
    isFetching: false,
    isLoading: false,
    refetch: () => {},
  }),
}));
jest.mock('../useMairieDecideALaCreation', () => ({
  __esModule: true,
  default: () => ({
    complet: false, deLaVille: true, mairie: false, tuAcceptes: false, ville: 'Ville de Montrivage',
  }),
}));
jest.mock('react-i18next', () => ({
  ...jest.requireActual('react-i18next'),
  useTranslation: () => ({
    t: (/** @type {any[]} */ ...args) => jest.requireActual('i18next').t(...args),
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
      Images: { chevronDown: 1 },
      Spaces: espaces,
    }),
  };
});
jest.mock('@/components/molecules/wizardStepLayout/WizardStepLayout', () => function GabaritMock(
  /** @type {any} */ props,
) {
  mockGabarits.push(props);
  return props.children;
});
jest.mock('@/components/molecules/datePickerInput/DatePickerInput', () => function DateMock() {
  return null;
});
jest.mock('@/components/molecules/timePickerInput/TimePickerInput', () => function HeureMock() {
  return null;
});
jest.mock('@/components/molecules/dayPicker/DayPicker', () => function JoursMock() { return null; });
jest.mock('@/components/molecules/bottomModal/BottomModal', () => function FeuilleMock() { return null; });
jest.mock('@/components/atoms/button/Button', () => function BoutonMock() { return null; });

const i18nextTemoin = require('i18next');

const frTemoin = require('@/theme/strings/translations/fr');

(i18nextTemoin.default || i18nextTemoin).init({
  compatibilityJSON: 'v4',
  fallbackLng: 'fr',
  lng: 'fr',
  resources: { fr: { translation: frTemoin.default } },
});

const EQUIPE = {
  club: { documentId: 'club-A', name: 'AS Montrivage' },
  documentId: 'u13',
  name: 'U13',
};
const AUJOURDHUI = new Date();
const JOUR_ISO = ((AUJOURDHUI.getDay() + 6) % 7) + 1;
// La série : chaque semaine pendant 5 mois, le jour d'aujourd'hui. 22 séances, dont 2 à la
// Toussaint (J+14, J+21) et 2 à Noël (J+56, J+63).
const FIN_DE_SERIE = addDays(AUJOURDHUI, 150);
const toutesLesSeances = Array.from({ length: 22 }, (_, semaine) => mockJour(semaine * 7));

const creneau = (/** @type {any} */ forme = {}) => ({
  documentId: 'cr-1',
  endTime: '23:59',
  startTime: '00:00',
  validFrom: mockJour(-60),
  validUntil: mockJour(300),
  weekday: JOUR_ISO,
  ...forme,
});
const SAUF_VACANCES = {
  exceptHolidays: true,
  holidayDates: [mockJour(14), mockJour(21), mockJour(56), mockJour(63)],
};
const gymnase = (/** @type {any} */ forme) => [{
  clubSeasonSlots: [creneau(forme)],
  documentId: 'gym-ville',
  isVilleSlot: true,
}];

/** @type {any} */
let arbre;
let semer = (/** @type {any} */ action) => action;
/** @type {any} */
let etatDuTunnel = null;
/**
 * Sonde : le `dispatch` et l'état du tunnel.
 * @returns {null} Rien.
 */
function PriseDeCourant() {
  const tunnel = useEventWizard();
  semer = tunnel.dispatch;
  etatDuTunnel = tunnel.state;
  return null;
}
const attendre = async () => {
  for (let tour = 0; tour < 5; tour += 1) {
    // eslint-disable-next-line no-await-in-loop -- la lecture, puis l'effet qui remonte son résultat
    await act(async () => {
      await new Promise((resolve) => { setTimeout(resolve, 5); });
    });
  }
};
const navigation = { goBack: () => {}, navigate: () => {}, setParams: () => {} };
/** @type {QueryClient} */
let requetes;
const rendre = (/** @type {any} */ contenu) => createElement(
  QueryClientProvider,
  { client: requetes },
  createElement(EventWizardProvider, null, createElement(PriseDeCourant), contenu),
);
const lEcran = () => createElement(EventWizardLogistics, { navigation, route: { params: {} } });
const afficherLaSerie = async () => {
  requetes = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() => { arbre = renderer.create(rendre(null)); });
  act(() => semer({ payload: { team: EQUIPE, type: { name: 'Entraînement' } }, type: 'SET_META' }));
  act(() => semer({ payload: { facility: 'gym-ville', location: null }, type: 'SET_LOCATION' }));
  act(() => arbre.update(rendre(lEcran())));
  act(() => arbre.root.findByType(DateEtHoraire).props.onRepetition({
    au: FIN_DE_SERIE,
    du: AUJOURDHUI,
    frequence: 'week',
    intervalleTexte: '1',
    jours: [AUJOURDHUI.getDay()],
  }));
  await attendre();
};
const laCase = () => arbre.root.findByProps({ testID: 'date-et-horaire-sauf-vacances' });
const dernierGabarit = () => mockGabarits[mockGabarits.length - 1];
const suivant = () => act(() => dernierGabarit().onNext());
const seancesDeLaSerie = () => createReccurrentEventPayload({
  capacity: 10,
  date: format(AUJOURDHUI, 'dd/MM/yyyy'),
  endTime: '21:00',
  exceptHolidays: etatDuTunnel.exceptHolidays,
  holidayPeriods: etatDuTunnel.holidayPeriods,
  isRecurrent: true,
  recurrenceDays: etatDuTunnel.recurrenceDays,
  recurrenceEndDate: format(FIN_DE_SERIE, 'dd/MM/yyyy'),
  recurrenceFrequency: 'week',
  recurrenceInterval: 1,
  recurrenceStartDate: format(AUJOURDHUI, 'dd/MM/yyyy'),
  sessionStatus: 'closed',
  startTime: '19:30',
  time: '19:30',
}).map((seance) => format(new Date(seance.date), 'yyyy-MM-dd'));
const sauf = (/** @type {number[]} */ ...decalages) => {
  const retirees = decalages.map(mockJour);
  return toutesLesSeances.filter((jour) => !retirees.includes(jour));
};

beforeEach(() => {
  mockGabarits.length = 0;
  mockVille = [];
  mockLectureDuPlanning.mockReset();
  mockLectureDeLApercu.mockReset();
  mockLectureDuPlanning.mockImplementation(async (_id, { from, to }) => {
    const jours = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000 + 1;
    if (jours > 31) throw Object.assign(new Error('from et to sur 31 jours au plus'), { response: { status: 400 } });
    return { meta: { holidays: mockVacances } };
  });
  mockLectureDeLApercu.mockImplementation(async () => ({
    data: {
      holidays: {
        ...mockVacances, exceptHolidays: false, keep: [], wouldRemove: [],
      },
    },
  }));
});
afterEach(() => {
  if (arbre) act(() => arbre.unmount());
  arbre = null;
  requetes.clear();
});

// ponytail: le 1er test monte l'écran à froid (13 à 22 s mesurés sous charge le 06/11) ; 30 s pour ce
// seul fichier, au lieu de 5 s qui donnaient 8 faux rouges en cascade. Sortie : alléger le montage.
jest.setTimeout(30000);

describe('VACANCES-REPETE — répéter sur un créneau « sauf vacances » de la Ville', () => {
  test('une série de 5 mois : le coach voit la case (le planning refuse plus de 31 jours)', async () => {
    mockVille = gymnase();
    await afficherLaSerie();

    expect(arbre.root.findAllByProps({ testID: 'date-et-horaire-sauf-vacances' }, { deep: false })).toHaveLength(1);
    expect(laCase().props.accessibilityState).toEqual({ checked: false });
  });

  test('un créneau « sauf vacances » : la case arrive cochée, et les séances des vacances ne partent pas', async () => {
    mockVille = gymnase(SAUF_VACANCES);
    await afficherLaSerie();

    expect(laCase().props.accessibilityState).toEqual({ checked: true });
    suivant();
    expect(etatDuTunnel.exceptHolidays).toBe(true);
    expect(seancesDeLaSerie()).toEqual(sauf(14, 21, 56, 63));
  });

  test('le coach la décoche : les séances des vacances partent, et son choix tient au retour sur l étape', async () => {
    mockVille = gymnase(SAUF_VACANCES);
    await afficherLaSerie();

    act(() => laCase().props.onPress());
    expect(laCase().props.accessibilityState).toEqual({ checked: false });
    suivant();
    expect(etatDuTunnel.exceptHolidays).toBe(false);
    expect(seancesDeLaSerie()).toEqual(toutesLesSeances);

    act(() => arbre.update(rendre(null)));
    act(() => arbre.update(rendre(lEcran())));
    await attendre();
    expect(laCase().props.accessibilityState).toEqual({ checked: false });
  });

  test('une période gardée par la Ville (la Toussaint) : ses séances restent, seules celles de Noël partent', async () => {
    mockVille = gymnase({ exceptHolidays: true, holidayDates: [mockJour(56), mockJour(63)] });
    await afficherLaSerie();

    suivant();
    expect(seancesDeLaSerie()).toEqual(sauf(56, 63));
  });

  test('la série commence pendant des vacances : le créneau se reconnaît quand même', async () => {
    mockVille = gymnase({ exceptHolidays: true, holidayDates: [mockJour(0), mockJour(14), mockJour(21)] });
    mockLectureDeLApercu.mockImplementation(async () => ({
      data: {
        holidays: {
          ...mockVacances,
          periods: [{
            end: mockJour(3), key: 'en-cours', name: 'Automne', start: mockJour(-3),
          }, TOUSSAINT],
        },
      },
    }));
    await afficherLaSerie();

    expect(laCase().props.accessibilityState).toEqual({ checked: true });
    suivant();
    expect(seancesDeLaSerie()).toEqual(sauf(0, 14, 21));
  });

  test('tant que les vacances se lisent, « Suivant » attend : la série ne part pas sans elles', async () => {
    mockVille = gymnase(SAUF_VACANCES);
    let repondre = (/** @type {any} */ reponse) => reponse;
    mockLectureDeLApercu.mockImplementation(() => new Promise((resolve) => { repondre = resolve; }));
    await afficherLaSerie();

    expect(dernierGabarit().isNextDisabled).toBe(true);

    await act(async () => repondre({ data: { holidays: mockVacances } }));
    await attendre();
    expect(dernierGabarit().isNextDisabled).toBe(false);
  });

  test('un créneau « sauf vacances », vacances illisibles : « Suivant » attend, et « Réessayer » relit', async () => {
    mockVille = gymnase(SAUF_VACANCES);
    mockLectureDeLApercu.mockRejectedValueOnce(new Error('panne'));
    await afficherLaSerie();

    expect(dernierGabarit().isNextDisabled).toBe(true);
    const leTexte = arbre.root.findByProps({ children: 'Réessayer' });
    let bouton = leTexte;
    while (bouton && typeof bouton.props.onPress !== 'function') bouton = bouton.parent;
    await act(async () => bouton.props.onPress());
    await attendre();
    expect(dernierGabarit().isNextDisabled).toBe(false);
    expect(laCase().props.accessibilityState).toEqual({ checked: true });
  });

  test('sans règle sur le créneau, vacances illisibles : la case manque, rien ne retient le coach', async () => {
    mockVille = gymnase();
    mockLectureDeLApercu.mockRejectedValue(new Error('panne'));
    await afficherLaSerie();

    expect(arbre.root.findAllByProps({ testID: 'date-et-horaire-sauf-vacances' }, { deep: false })).toHaveLength(0);
    expect(dernierGabarit().isNextDisabled).toBe(false);
  });
});
