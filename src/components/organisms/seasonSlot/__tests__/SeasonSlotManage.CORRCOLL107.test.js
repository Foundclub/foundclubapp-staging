/* eslint-disable max-len -- donnees de test : les fixtures se lisent mieux sur une ligne */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { getSeasonSlot, withdrawSeasonSlot } from '@/services/seasonSlot/seasonSlotService';

import SeasonSlotManage from '../SeasonSlotManage';

// CORR-COLLECTIVITES point 107 (31/10/2026, decision d Adel B « un seul mot, toujours juste ») —
// « Modifier la série » s affichait sur un créneau d une seule date, et « Modifier le créneau » sur
// un créneau « chaque mardi ». Désormais toujours « Modifier le créneau / Retirer le créneau ».

const i18nextTemoin = require('i18next');

const frTemoin = require('@/theme/strings/translations/fr');

(i18nextTemoin.default || i18nextTemoin).init({
  compatibilityJSON: 'v4',
  fallbackLng: 'fr',
  lng: 'fr',
  resources: { fr: { translation: frTemoin.default } },
});

/** @type {any[]} */
const mockDateProps = [];

// Les phrases passent par le vrai i18next (interpolation comprise).
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {any[]} */ ...args) => jest.requireActual('i18next').t(...args),
  }),
}));
jest.mock('@/services/seasonSlot/seasonSlotService', () => ({
  getSeasonSlot: jest.fn(),
  withdrawSeasonSlot: jest.fn(),
}));
// FINITIONS13-COLL (04/10) : seasonSlotQueries lit « Chiffres » de la Ville (même client HTTP).
jest.mock('@/services/collectivite/collectiviteService', () => ({
  getCollectiviteChiffres: jest.fn(),
}));
jest.mock('@/services/facility/facilityService', () => ({ getFacilityPlanning: jest.fn() }));
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
jest.mock('@/components/atoms/button/Button', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
  return function ButtonMock(/** @type {any} */ props) {
    return reactActuel.createElement(PressableRN, { disabled: props.disabled, onPress: props.onPress }, reactActuel.createElement(TexteRN, null, props.title));
  };
});
jest.mock('@/components/atoms/loader/Loader', () => function LoaderMock() { return null; });
jest.mock('@/components/molecules/datePickerInput/DatePickerInput', () => function DatePickerInputMock(/** @type {any} */ props) {
  mockDateProps.push(props);
  return null;
});

const SALLE = { documentId: 'gym-tilleuls', name: 'Gymnase des Tilleuls' };
const UN_SUR_DEUX = {
  anchorDate: '2026-10-21', club: { documentId: 'as', name: 'AS Montrivage' }, documentId: 'slot-2s', endTime: '19:00', everyWeeks: 2, facility: SALLE, recurrence: 'weekly', startTime: '17:30', team: { documentId: 'u13', name: 'U13' }, validFrom: '2026-10-21', validUntil: '2027-06-30', weekday: 3,
};
const CHAQUE_LUNDI = {
  club: { documentId: 'fc', name: 'Montrivage FC' }, documentId: 'slot-lundi', endTime: '19:30', facility: SALLE, startTime: '18:00', team: { documentId: 'sb', name: 'Senior B' }, validFrom: '2026-09-01', validUntil: '2027-06-30', weekday: 1,
};
const TROIS_DATES = {
  club: { documentId: 'as', name: 'AS Montrivage' }, dates: ['2026-11-07', '2026-11-17', '2026-11-25'], documentId: 'slot-dates', endTime: '19:00', facility: SALLE, recurrence: 'dates', startTime: '17:30', team: { documentId: 'u17', name: 'U17' }, validFrom: '2026-11-07', validUntil: '2026-11-25', weekday: null,
};

/** @type {any[]} */
const arbresMontes = [];
const aplatir = (/** @type {any} */ enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatir).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatir(enfants?.props?.children);
  return String(enfants);
};
const textes = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text).map((/** @type {any} */ n) => aplatir(n.props.children).trim());
const presser = (/** @type {any} */ arbre, /** @type {string} */ libelle) => {
  const [cible] = arbre.root.findAll((/** @type {any} */ n) => typeof n.props?.onPress === 'function'
    && n.findAllByType(Text).some((/** @type {any} */ t) => aplatir(t.props.children).trim() === libelle), { deep: false });
  return cible.props.onPress();
};
const tours = async () => {
  for (let tour = 0; tour < 3; tour += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => { await new Promise((fini) => { setTimeout(fini, 0); }); });
  }
};
const monter = async (/** @type {any} */ slot) => {
  /** @type {any} */ (getSeasonSlot).mockResolvedValue({ data: { ...slot, sessionsCount: 0 }, meta: { canManage: true } });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <QueryClientProvider client={client}>
        <SeasonSlotManage
          canManage
          installationName="Gymnase des Tilleuls"
          onClose={jest.fn()}
          onModify={jest.fn()}
          onWithdrawn={jest.fn()}
          slot={slot}
        />
      </QueryClientProvider>,
    );
  });
  await tours();
  arbresMontes.push(arbre);
  return arbre;
};

beforeEach(() => {
  // Le lundi 19 octobre 2026, midi.
  jest.useFakeTimers({
    doNotFake: ['nextTick', 'setImmediate', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'queueMicrotask'],
    now: new Date(2026, 9, 19, 12, 0, 0),
  });
  jest.clearAllMocks();
  mockDateProps.length = 0;
  /** @type {any} */ (withdrawSeasonSlot).mockResolvedValue({ data: {} });
});
afterEach(() => {
  act(() => { arbresMontes.splice(0).forEach((arbre) => arbre.unmount()); });
  jest.useRealTimers();
});
const UNE_DATE = {
  club: { documentId: 'as', name: 'AS Montrivage' }, dates: ['2026-11-17'], documentId: 'slot-une', endTime: '19:00', facility: SALLE, recurrence: 'dates', startTime: '17:30', team: { documentId: 'u17', name: 'U17' }, validFrom: '2026-11-17', validUntil: '2026-11-17', weekday: null,
};

describe('CORR-COLLECTIVITES 107 — un seul mot : « le créneau »', () => {
  it.each([
    ['une seule date', UNE_DATE],
    ['des dates choisies', TROIS_DATES],
    ['un mercredi sur deux', UN_SUR_DEUX],
    ['chaque lundi', CHAQUE_LUNDI],
  ])('%s : « Modifier le créneau » et « Retirer le créneau », jamais « la série »', async (_nom, slot) => {
    const arbre = await monter(slot);
    const vus = textes(arbre);
    expect(vus).toEqual(expect.arrayContaining(['Modifier le créneau', 'Retirer le créneau']));
    expect(vus.some((texte) => /la série/.test(texte))).toBe(false);
  });

  it('la confirmation du retrait dit aussi « le créneau »', async () => {
    const arbre = await monter(TROIS_DATES);
    await act(async () => { await presser(arbre, 'Retirer le créneau'); });
    await tours();
    expect(textes(arbre)).toContain('Retirer le créneau à partir d’une date ?');
    expect(textes(arbre).some((texte) => /la série/.test(texte))).toBe(false);
  });
});
