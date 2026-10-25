/* eslint-disable max-len -- donnees de test : les fixtures se lisent mieux sur une ligne */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { addDays, format } from 'date-fns';
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { formatDay } from '@/domains/seasonSlot/seasonSlotDisplay';

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

const iso = (/** @type {number} */ jours) => format(addDays(new Date(), jours), 'yyyy-MM-dd');
const saisie = (/** @type {number} */ jours) => format(addDays(new Date(), jours), 'dd/MM/yyyy');

const CRENEAU = {
  club: { documentId: 'montrivage-fc', name: 'Montrivage FC' },
  documentId: 'slot-lundi',
  endTime: '19:30',
  facility: { documentId: 'gym-tilleuls', name: 'Gymnase des Tilleuls' },
  startTime: '18:00',
  team: { documentId: 'senior-b', name: 'Senior B' },
  validFrom: iso(-30),
  validUntil: iso(200),
  weekday: 1,
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
const monter = async (/** @type {any} */ props = {}) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <QueryClientProvider client={client}>
        <SeasonSlotManage
          canManage
          etapeInitiale={props.etape || 'retirer'}
          installationName="Gymnase des Tilleuls"
          onClose={props.onClose || jest.fn()}
          onModify={jest.fn()}
          onWithdrawn={props.onWithdrawn || jest.fn()}
          slot={props.slot || CRENEAU}
        />
      </QueryClientProvider>,
    );
  });
  await tours();
  arbresMontes.push(arbre);
  return arbre;
};
const champ = () => [...mockDateProps].reverse().find((props) => props.label === 'À partir du');
const phrase = (/** @type {any} */ arbre) => textes(arbre).find((texte) => texte.startsWith('Montrivage FC · Senior B perd le lundi'));

beforeEach(() => {
  jest.clearAllMocks();
  mockDateProps.length = 0;
  /** @type {any} */ (getSeasonSlot).mockResolvedValue({ data: { ...CRENEAU, sessionsCount: 4 }, meta: { canManage: true } });
  /** @type {any} */ (withdrawSeasonSlot).mockResolvedValue({ data: { ...CRENEAU, status: 'withdrawn' } });
});
afterEach(() => {
  act(() => { arbresMontes.splice(0).forEach((arbre) => arbre.unmount()); });
});

describe('COLL-C2B-BIS — planche 23 : retirer à partir d une date choisie', () => {
  it('la confirmation porte « À partir du », aujourd hui par défaut, bornée à la fin du créneau', async () => {
    const arbre = await monter();
    expect(champ()?.value).toBe(saisie(0));
    expect(format(champ().maximumDate, 'yyyy-MM-dd')).toBe(iso(200));
    expect(phrase(arbre)).toContain(`à partir du ${formatDay(iso(0), { withYear: false })}`);
    expect(textes(arbre)).toContain('Ses entraînements déjà posés sur ce créneau restent : le club les garde ou les annule lui-même.');
  });

  it('la phrase dit la date choisie, et « Retirer le créneau » l envoie', async () => {
    const onWithdrawn = jest.fn();
    const arbre = await monter({ onWithdrawn });
    act(() => { champ().onChange(saisie(14)); });
    await tours();
    expect(phrase(arbre)).toContain(`à partir du ${formatDay(iso(14), { withYear: false })}`);
    await act(async () => { await presser(arbre, 'Retirer le créneau'); });
    expect(withdrawSeasonSlot).toHaveBeenCalledWith('slot-lundi', { effectiveFrom: iso(14) });
    expect(onWithdrawn).toHaveBeenCalled();
  });
});

// 🐞 FINITIONS15 point 4 (tournée T14, C15b) — LA FICHE D'UN CRÉNEAU RETIRÉ dit la même fin que la
// liste. Créneau Basket retiré à partir du 1er juin (T11) : la liste dit « du 1 sept. au 31 mai »
// (`finDuCreneau` : `effectiveUntil`), la fiche disait « Période 1 sept. 2026 – 30 juin 2027 »
// (`validUntil` brut, la fin de la saison). La date du retrait est bornée au même jour. ROUGE avant
// le lot.
describe('FINITIONS15 point 4 — la fiche d un créneau retiré finit le même jour que la liste', () => {
  const RETIRE = {
    ...CRENEAU,
    effectiveUntil: '2027-05-31',
    validFrom: '2026-09-01',
    validUntil: '2027-06-30',
  };

  it('« Période 1 sept. 2026 – 31 mai 2027 », et le retrait borné au 31 mai', async () => {
    /** @type {any} */ (getSeasonSlot).mockResolvedValue({ data: RETIRE, meta: { canManage: true } });
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
            slot={RETIRE}
          />
        </QueryClientProvider>,
      );
    });
    await tours();
    arbresMontes.push(arbre);

    expect(textes(arbre)).toContain('1 sept. 2026 – 31 mai 2027');
    expect(textes(arbre)).not.toContain('1 sept. 2026 – 30 juin 2027');

    await act(async () => { await presser(arbre, 'Retirer le créneau'); });
    await tours();
    expect(format(champ().maximumDate, 'yyyy-MM-dd')).toBe('2027-05-31');
  });
});

// 🎨 FINITIONS12-COLL (03/10) — point 10 : « … à partir du sam. 3 oct.. » (tournée T11, C23) : la
// date abrégée porte déjà son point, la phrase en ajoutait un. ROUGE avant le lot.
describe('FINITIONS12-COLL point 10 — un seul point après une date abrégée', () => {
  it('« à partir du lun. 5 oct. » : jamais « .. »', async () => {
    const arbre = await monter();
    expect(phrase(arbre)).toMatch(/[^.]\.$|[^.]$/);
    expect(phrase(arbre)).not.toMatch(/\.\.$/);
  });
});

// C05 (BUGHUNT P2, Q3-11, 25/10/2026) — le JOUR DE PARIS, pas celui de l appareil ni d un instant
// UTC coupe. Lancer aussi hors de Paris : `$env:TZ='America/New_York'` (PowerShell).
describe('Q3-11 — le retrait et « Attribué le » lisent le jour de Paris', () => {
  afterEach(() => { jest.useRealTimers(); });

  it('dimanche 25/10 23:30 UTC = lundi 26/10 00:30 à Paris : « À partir du » propose le 26/10', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'queueMicrotask'], now: new Date('2026-10-25T23:30:00.000Z') });
    await monter({ slot: { ...CRENEAU, validFrom: '2026-09-01', validUntil: '2027-06-30' } });
    expect(champ()?.value).toBe('26/10/2026');
  });

  it('attribué à 00:30 heure de Paris le 25/10 : « Attribué le » dit le 25/10, pas la veille', async () => {
    const arbre = await monter({
      etape: 'detail',
      slot: {
        ...CRENEAU, attributedAt: '2026-10-24T22:30:00.000Z', validFrom: '2026-09-01', validUntil: '2027-06-30',
      },
    });
    expect(textes(arbre)).toContain(formatDay('2026-10-25'));
    expect(textes(arbre)).not.toContain(formatDay('2026-10-24'));
  });
});
