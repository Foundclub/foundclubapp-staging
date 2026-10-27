/* eslint-disable max-len -- donnees de test : les fixtures se lisent mieux sur une ligne */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';

import {
  attributeSeasonSlot,
  getClubTeamsForSlot,
  listFacilitySeasonSlots,
  modifySeasonSlot,
  previewFacilitySeasonSlot,
} from '@/services/seasonSlot/seasonSlotService';

import SeasonSlotForm from '../SeasonSlotForm';

// 🧪 APRESDATES (27/10) — trois bugs de l'assistant « Attribuer un créneau » qui attendaient
// « Date & horaire » (DATESDABORD), revérifiés sur le code récolté (BUGHUNT P2, TECHNIQUE.md) :
// - Q3-02 : modifier un créneau à dates choisies (sans jour de semaine) proposait « À partir du »
//   au lundi suivant ; le serveur coupe le créneau à cette date, les séances d'avant gardaient
//   l'ancienne heure.
// - Q3-09 : des jours différents n'ont pas de « jour » : « Voir les heures libres du <jour> »
//   proposait 8 h – 22 h (aucune heure pleine n'est calculée dans ce cas).
// - Q3-13 : « Mercredi » puis « Des dates choisies » : le récapitulatif annonçait « Mercredi »,
//   un jour de semaine qui ne part pas au serveur.
// - Voisin (trouvé par le lot, « Q1 = A » du chef 27/10) : « Répéter » toutes les 2 semaines (ou une
//   période), puis retour à « chaque semaine jusqu'à la fin de saison » : la forme restait l'ancienne,
//   le récapitulatif la disait et elle partait au serveur (`everyWeeks: 2`).
// Montage repris de SeasonSlotForm.R17Q1.quand.test.js.

const i18nextTemoin = require('i18next');

const frTemoin = require('@/theme/strings/translations/fr');

(i18nextTemoin.default || i18nextTemoin).init({
  compatibilityJSON: 'v4',
  fallbackLng: 'fr',
  lng: 'fr',
  resources: { fr: { translation: frTemoin.default } },
});

/** @type {any[]} */
const mockHeureProps = [];
/** @type {any[]} */
const mockDateProps = [];

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {any[]} */ ...args) => jest.requireActual('i18next').t(...args),
  }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 34, left: 0, right: 0, top: 47,
  }),
}));
jest.mock('@/services/seasonSlot/seasonSlotService', () => ({
  attributeSeasonSlot: jest.fn(),
  getClubTeamsForSlot: jest.fn(),
  listFacilitySeasonSlots: jest.fn(),
  modifySeasonSlot: jest.fn(),
  previewFacilitySeasonSlot: jest.fn(),
}));
jest.mock('@/services/collectivite/collectiviteService', () => ({ getCollectiviteChiffres: jest.fn() }));
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
    return reactActuel.createElement(PressableRN, {
      accessibilityLabel: props.accessibilityLabel, disabled: props.disabled, onPress: props.onPress, testID: props.testID,
    }, reactActuel.createElement(TexteRN, null, props.title));
  };
});
jest.mock('@/components/templates/ScreenContainer', () => function ScreenContainerMock({ children }) { return children; });
jest.mock('@/components/molecules/clubLogoMark/ClubLogoMark', () => function ClubLogoMarkMock() { return null; });
jest.mock('@/components/molecules/timePickerInput/TimePickerInput', () => function TimePickerInputMock(/** @type {any} */ props) {
  mockHeureProps.push(props);
  return null;
});
jest.mock('@/components/molecules/datePickerInput/DatePickerInput', () => function DatePickerInputMock(/** @type {any} */ props) {
  mockDateProps.push(props);
  return null;
});
jest.mock('@/components/organisms/seasonSlot/RondsDePlaces', () => function RondsDePlacesMock() { return null; });

jest.setTimeout(30000);

const SAISON = { validFrom: '2026-09-01', validUntil: '2027-06-30' };
const SALLE = {
  documentId: 'salle-t18', maxSlots: 2, name: 'T18 Salle essai', type: 'gymnase',
};
const NOEL = {
  endDate: '2027-01-03', endTime: null, kind: 'closure', label: 'Vacances de Noël', startDate: '2026-12-19', startTime: null,
};

/** @type {any[]} */
const arbresMontes = [];
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
        <SeasonSlotForm
          clubs={[{ documentId: 'basket', name: 'Montrivage Basket' }]}
          compact={props.compact}
          facilityId="salle-t18"
          guided
          initial={props.initial}
          onCancel={jest.fn()}
          onDone={jest.fn()}
          pleinEcran
          slot={props.slot}
        />
      </QueryClientProvider>,
    );
  });
  await tours();
  arbresMontes.push(arbre);
  return arbre;
};

beforeEach(() => {
  // Le lundi 19 octobre 2026, midi : les comptes de séances sont ceux de la planche (37 mercredis).
  jest.useFakeTimers({
    doNotFake: ['nextTick', 'setImmediate', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'queueMicrotask'],
    now: new Date(2026, 9, 19, 12, 0, 0),
  });
  jest.clearAllMocks();
  mockHeureProps.length = 0;
  mockDateProps.length = 0;
  /** @type {any} */ (getClubTeamsForSlot).mockResolvedValue([{ documentId: 'u13', name: 'U13' }]);
  /** @type {any} */ (listFacilitySeasonSlots).mockResolvedValue({ data: [], meta: { facility: { ...SALLE, plateaux: [] }, season: SAISON } });
  /** @type {any} */ (previewFacilitySeasonSlot).mockResolvedValue({
    data: {
      capacity: 2, closures: [NOEL], needsConfirmation: false, occupants: [],
    },
  });
  /** @type {any} */ (attributeSeasonSlot).mockResolvedValue({ data: { documentId: 'neuf' } });
  /** @type {any} */ (modifySeasonSlot).mockResolvedValue({ data: {} });
});
afterEach(() => {
  act(() => { arbresMontes.splice(0).forEach((arbre) => arbre.unmount()); });
  jest.useRealTimers();
});

const tunnel = (/** @type {any} */ arbre) => arbre.root.findByType(WizardStepLayout).props;
const appeler = async (/** @type {() => any} */ geste) => {
  await act(async () => { await geste(); });
  await tours();
};
const avancer = (/** @type {any} */ arbre) => {
  expect(tunnel(arbre).isNextDisabled).not.toBe(true);
  return appeler(() => tunnel(arbre).onNext());
};
const texte = (/** @type {any} */ n) => [].concat(n.props.children).join('');
const lus = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text).map(texte);
const choix = (/** @type {any} */ arbre, /** @type {string} */ libelle) => arbre.root.findAll(
  (/** @type {any} */ n) => n.props.accessibilityRole === 'radio' && typeof n.props.onPress === 'function'
    && n.findAllByType(Text).some((/** @type {any} */ x) => texte(x) === libelle),
)[0];
const choisir = async (/** @type {any} */ arbre, /** @type {string} */ libelle) => {
  const cible = choix(arbre, libelle);
  expect(cible).toBeDefined();
  await appeler(() => cible.props.onPress());
};
const choisirHeure = async (/** @type {string} */ label, /** @type {string} */ valeur) => {
  const champ = mockHeureProps.filter((p) => p.label === label).at(-1);
  await appeler(() => champ.onChange(valeur));
};
const jourDuCalendrier = (/** @type {any} */ arbre, /** @type {string} */ jour) => arbre.root.findAll(
  (/** @type {any} */ n) => n.type === TouchableOpacity && n.props.testID === `date-${jour}`,
)[0];

// 🗓️ DATESDABORD (23/10, point 9 d'Adel) — à la création, « Quel jour ? », « À quelle heure ? » et
// « Quand ? » ne font plus qu'une étape, « Date & horaire » : le modèle de la création d'événement
// (une date, des heures, « Répéter »). Les quatre formes restent celles du serveur ; elles se
// choisissent par « Répéter » (seasonSlotWhen.DATESDABORD.test.js) ; les corps envoyés et les
// séances comptées ci-dessous sont ceux d'avant. Le calendrier libre reste à « Modifier ».
const modele = (/** @type {any} */ arbre) => arbre.root.findAll(
  (/** @type {any} */ n) => typeof n.props?.onRepetition === 'function',
)[0];
// Le mercredi 21 octobre 2026 (on est le lundi 19).
const MERCREDI = new Date(2026, 9, 21, 12, 0, 0);
const repeter = (/** @type {any} */ arbre, /** @type {any} */ suite) => appeler(
  () => modele(arbre).props.onRepetition({
    au: new Date(2027, 5, 30), du: null, frequence: 'week', intervalleTexte: '1', jours: [3], ...suite,
  }),
);

// Club et équipe (tout le club), mercredi, 17:30 – 19:00 : l'étape « Date & horaire ».
// A7-UX-2 (22/10, Adel « P2 oui ») : le club et l'équipe sur UNE étape, un « Suivant » de moins.
const jusquAuQuand = async (/** @type {any} */ arbre, { jour = MERCREDI } = {}) => {
  await choisir(arbre, 'Montrivage Basket');
  await avancer(arbre);
  await appeler(() => modele(arbre).props.onDate(jour));
  await choisirHeure('Début', '17:30');
  await choisirHeure('Fin', '19:00');
};

const CRENEAU_A_DATES = {
  club: { documentId: 'basket', name: 'Montrivage Basket' }, dates: ['2026-10-29', '2026-10-31'], documentId: 'c-dates', endTime: '19:00', recurrence: 'dates', startTime: '17:30', validFrom: '2026-10-29', validUntil: '2026-10-31', weekday: null,
};
const CRENEAU_DU_MERCREDI = {
  club: { documentId: 'basket', name: 'Montrivage Basket' }, documentId: 'c-mer', endTime: '19:30', recurrence: 'weekly', startTime: '18:00', validFrom: '2026-09-01', validUntil: '2027-06-30', weekday: 3,
};
const jusquAuRecap = async (/** @type {any} */ arbre) => {
  for (let pas = 0; pas < 6 && tunnel(arbre).title !== 'Récapitulatif'; pas += 1) {
    // eslint-disable-next-line no-await-in-loop
    await avancer(arbre);
  }
  expect(tunnel(arbre).title).toBe('Récapitulatif');
};

test('Q3-02 — modifier un créneau à dates choisies : « À partir du » vaut aujourd’hui, pas le lundi suivant', async () => {
  // Le mardi 27 octobre 2026 : les séances du jeudi 29 et du samedi 31 sont avant le lundi 2/11.
  jest.setSystemTime(new Date(2026, 9, 27, 10, 0, 0));
  const arbre = await monter({ slot: CRENEAU_A_DATES });
  await jusquAuRecap(arbre);
  expect(lus(arbre).filter((ligne) => /^\d\d\/\d\d\/2026$/.test(ligne))).toEqual(['27/10/2026']);
  await appeler(() => tunnel(arbre).onNext());
  expect(modifySeasonSlot).toHaveBeenCalledWith('c-dates', expect.objectContaining({ effectiveFrom: '2026-10-27' }));
});

test('Q3-09 — des jours différents, place complète : pas de « Voir les heures libres du mercredi »', async () => {
  /** @type {any} */ (previewFacilitySeasonSlot).mockResolvedValue({
    data: {
      capacity: 2, closures: [], needsConfirmation: true, occupants: [], peak: 2,
    },
  });
  const arbre = await monter();
  await jusquAuQuand(arbre);
  await repeter(arbre, { au: new Date(2026, 9, 27), jours: [3, 6] });
  expect(lus(arbre)).toContain('17:30 – 19:00 : complet');
  expect(arbre.root.findAll((/** @type {any} */ n) => n.props.testID === 'attribuer-voir-libres')).toHaveLength(0);
});

test('Q3-13 — « Mercredi » puis « Des dates choisies » : le récapitulatif ne dit plus « Mercredi »', async () => {
  const arbre = await monter({ slot: CRENEAU_DU_MERCREDI });
  for (let pas = 0; pas < 4 && !choix(arbre, 'Des dates choisies'); pas += 1) {
    // eslint-disable-next-line no-await-in-loop
    await avancer(arbre);
  }
  await choisir(arbre, 'Des dates choisies');
  await appeler(() => jourDuCalendrier(arbre, '2026-10-24').props.onPress());
  await appeler(() => jourDuCalendrier(arbre, '2026-10-31').props.onPress());
  await jusquAuRecap(arbre);
  const heures = lus(arbre).filter((ligne) => ligne.includes('18:00 – 19:30'));
  expect(heures.length).toBeGreaterThan(0);
  expect(heures.join(' | ')).not.toMatch(/Mercredi/);
  await appeler(() => tunnel(arbre).onNext());
  expect(modifySeasonSlot).toHaveBeenCalledWith('c-mer', expect.not.objectContaining({ weekday: expect.anything() }));
});

test.each([
  ['toutes les 2 semaines', { intervalleTexte: '2' }],
  ['une période', { au: new Date(2026, 11, 18), du: new Date(2026, 9, 21) }],
])('Voisin — %s, puis « chaque semaine » jusqu’à la fin de saison : retour à toute la saison', async (_nom, avant) => {
  const arbre = await monter();
  await jusquAuQuand(arbre);
  await repeter(arbre, avant);
  await repeter(arbre, {});
  await avancer(arbre);
  expect(lus(arbre)).toContain('Toute la saison · 21 oct. – 30 juin');
  await appeler(() => tunnel(arbre).onNext());
  expect(attributeSeasonSlot).toHaveBeenCalledWith('salle-t18', {
    club: 'basket', endTime: '19:00', startTime: '17:30', weekday: 3,
  });
});

jest.mock(
  '@/components/atoms/skeletonLoader/SkeletonLoader',
  () => function SkeletonMock({ children }) { return children; },
);
jest.mock('@/context/AppFeedbackContext', () => ({
  useAppFeedback: () => ({ showBanner: jest.fn() }),
}));
// R17-QUAND-2-BIS — l'étape « Quand ? » ouvre ses dates retirées dans une feuille du bas.
jest.mock('@/components/molecules/bottomModal/BottomModal', () => function BottomModalMock(
  /** @type {any} */ { children, footerComponent, isVisible },
) {
  return isVisible ? (
    <>
      {children}
      {footerComponent}
    </>
  ) : null;
});
