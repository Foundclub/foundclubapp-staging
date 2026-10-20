/* eslint-disable max-len -- donnees de test : les fixtures se lisent mieux sur une ligne */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { getSeasonSlot, withdrawSeasonSlot } from '@/services/seasonSlot/seasonSlotService';

import SeasonSlotManage from '../SeasonSlotManage';

// 📐 COLL-C2B-BIS (03/10) — planche 23 : RETIRER « À PARTIR DU » une date choisie (design HY521H1,
// P4v2-creneaux écran 5 et P4v2-creneaux-ordi D : « … perd le lundi 18:00 – 19:30, à partir du
// [date] »). Le serveur l accepte depuis C2A (§4.6, `effectiveFrom`) ; l écran retirait toujours
// « aujourd hui ». Contrat §4.6 / D67 : AUCUNE séance n est touchée, celles d après la date
// comprises — le club les garde ou les annule lui-même.
//
// Ce que ce témoin exige (ROUGE avant le lot) :
//   - la confirmation porte « À partir du », aujourd hui par défaut, borné à la fin du créneau ;
//   - la phrase dit la date CHOISIE ;
//   - « Retirer le créneau » envoie cette date (`effectiveFrom`) ;
//   - la phrase D67 reste : les entraînements déjà posés restent.

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

// 🧪 R17-QUAND-1, point 5 (REC17-007, décision d'Adel Q1 A, planche P10-quand-tel état 7) — LA VILLE
// TOUCHE UN CRÉNEAU EN SÉRIE : la feuille dit la forme et la prochaine séance ; « Modifier la série »
// et « Retirer la série » valent à partir d'une date (le geste d'avant) ; « Retirer le mer. 21 oct.
// seulement » retire UNE date. ROUGE avant : « Chaque mercredi » écrit en dur, aucun geste pour une
// seule date.

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

describe('R17Q1-5 — la Ville touche un créneau en série', () => {
  it('1. « un mercredi sur deux » : la forme, la prochaine séance, et les 3 gestes de la planche', async () => {
    const arbre = await monter(UN_SUR_DEUX);
    expect(textes(arbre)).toEqual(expect.arrayContaining([
      'AS Montrivage · U13',
      'Un mercredi sur deux, 17:30 – 19:00 · Gymnase des Tilleuls',
      'Prochaine séance',
      'mer. 21 oct.',
      'Modifier la série',
      'Retirer le mer. 21 oct. seulement',
      'Retirer la série',
      '« Modifier » et « Retirer la série » demandent « à partir du » : les dates passées restent. Le club est prévenu.',
    ]));
  });

  it('2. « Retirer le mer. 21 oct. seulement » : une confirmation, puis cette date seule part', async () => {
    const arbre = await monter(UN_SUR_DEUX);
    await act(async () => { await presser(arbre, 'Retirer le mer. 21 oct. seulement'); });
    await tours();
    expect(textes(arbre)).toEqual(expect.arrayContaining([
      'Retirer une seule date ?',
      'AS Montrivage · U13 n’aura pas de séance le mer. 21 oct. ; les autres dates restent. Le club est prévenu.',
    ]));
    expect([...mockDateProps].reverse().find((p) => p.label === 'Quelle date ?')?.value).toBe('21/10/2026');
    await act(async () => { await presser(arbre, 'Retirer cette date'); });
    expect(withdrawSeasonSlot).toHaveBeenCalledWith('slot-2s', { skipDate: '2026-10-21' });
  });

  it('3. chaque lundi : les gestes d’avant, plus « Retirer le lun. 19 oct. seulement »', async () => {
    const arbre = await monter(CHAQUE_LUNDI);
    expect(textes(arbre)).toEqual(expect.arrayContaining([
      'Chaque lundi, 18:00 – 19:30 · Gymnase des Tilleuls',
      'Modifier le créneau',
      'Retirer le lun. 19 oct. seulement',
      'Retirer le créneau',
    ]));
  });

  it('4. des dates choisies : leur nombre et la liste', async () => {
    const arbre = await monter(TROIS_DATES);
    expect(textes(arbre)).toEqual(expect.arrayContaining([
      '3 dates, 17:30 – 19:00 · Gymnase des Tilleuls',
      'Dates',
      'sam. 7 nov. · mar. 17 nov. · mer. 25 nov.',
      'Retirer le sam. 7 nov. seulement',
      'Retirer la série',
    ]));
  });
});

describe('R17Q1-5 — « Retirer la série » à partir d’une date', () => {
  it('5. le titre et la phrase disent la série, pas « le créneau du  »', async () => {
    const arbre = await monter(TROIS_DATES);
    await act(async () => { await presser(arbre, 'Retirer la série'); });
    await tours();
    expect(textes(arbre)).toContain('Retirer la série à partir d’une date ?');
    expect(textes(arbre).some((texte) => texte.startsWith('AS Montrivage · U17 perd 3 dates, 17:30 – 19:00, Gymnase des Tilleuls, à partir du'))).toBe(true);
  });
});
