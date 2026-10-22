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

// 🌴 R17-QUAND-2, point 3 (REC17-007 Q3, planches P11-quand-v2-tel et -ordi, validées par Adel le
// 19/10) — « SAUF VACANCES SCOLAIRES » DANS L'ÉTAPE « QUAND ? ». Adel : « il faut identifier les
// dates des vacances dans chaque secteur ».
// Avant (ROUGE) : aucune case, aucune zone, aucune liste.
// Ce fichier exige : la case sous les 4 formes, la zone lue dessous ; cochée, le compte juste
// (37 -> 29 mercredis, « 8 retirés pendant les vacances : Toussaint, Noël, hiver, printemps. ») ;
// la liste des dates retirées, une ligne par période, décochable ; ce qui part au serveur ; sans
// zone connue, pas de case ; le calendrier libre marque les jours de vacances ; une modification
// relit la case et les périodes gardées.

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
const ZONE_B = {
  academie: 'Normandie',
  departement: '14',
  departementName: 'Calvados',
  label: 'Zone B',
  origin: 'deduced',
  periods: [
    {
      end: '2026-11-01', key: '2026-2027:toussaint', name: 'Toussaint', start: '2026-10-17',
    },
    {
      end: '2027-01-03', key: '2026-2027:noel', name: 'Noël', start: '2026-12-19',
    },
    {
      end: '2027-03-07', key: '2026-2027:hiver', name: 'Hiver', start: '2027-02-20',
    },
    {
      end: '2027-05-02', key: '2026-2027:printemps', name: 'Printemps', start: '2027-04-17',
    },
  ],
  zone: 'B',
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
      capacity: 2, closures: [], holidays: ZONE_B, needsConfirmation: false, occupants: [],
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

// Club, équipe (tout le club), mercredi, 17:30 – 19:00, puis « Quand ? ».
const jusquAuQuand = async (/** @type {any} */ arbre, { jour = 'Mercredi' } = {}) => {
  await choisir(arbre, 'Montrivage Basket');
  // A7-UX-2 (22/10, Adel « P2 oui ») : le club et l'équipe sur une étape, un « Suivant » de moins.
  await avancer(arbre);
  await choisir(arbre, jour);
  await avancer(arbre);
  await choisirHeure('Début', '17:30');
  await choisirHeure('Fin', '19:00');
  await avancer(arbre);
};

const caseVacances = (/** @type {any} */ arbre) => arbre.root.findAll(
  (/** @type {any} */ n) => n.props.testID === 'quand-sauf-vacances' && typeof n.props.onPress === 'function',
)[0];
const periode = (/** @type {any} */ arbre, /** @type {string} */ cle) => arbre.root.findAll(
  (/** @type {any} */ n) => n.props.testID === `vacances-${cle}` && typeof n.props.onPress === 'function',
)[0];
const bouton = (/** @type {any} */ arbre, /** @type {string} */ titre) => arbre.root.findAll(
  (/** @type {any} */ n) => n.type === TouchableOpacity && n.findAllByType(Text).some((/** @type {any} */ x) => texte(x) === titre),
)[0];

describe('R17Q2-3 — « Sauf vacances scolaires » dans « Quand ? »', () => {
  test('1. la case sous les formes, la zone dessous ; cochée : 29 mercredis, 8 retirés, et ce qui part au serveur', async () => {
    const arbre = await monter();
    await jusquAuQuand(arbre);
    const cocher = caseVacances(arbre);
    expect(cocher).toBeDefined();
    expect(cocher.props.accessibilityRole).toBe('checkbox');
    expect(cocher.props.accessibilityState).toEqual({ checked: false });
    expect(lus(arbre)).toEqual(expect.arrayContaining(['Sauf vacances scolaires', 'Zone B · académie de Normandie', '37 mercredis']));
    await appeler(() => cocher.props.onPress());
    expect(caseVacances(arbre).props.accessibilityState).toEqual({ checked: true });
    expect(lus(arbre)).toEqual(expect.arrayContaining([
      '29 mercredis',
      '8 retirés pendant les vacances : Toussaint, Noël, hiver, printemps.',
    ]));
    expect(previewFacilitySeasonSlot).toHaveBeenLastCalledWith('salle-t18', expect.objectContaining({ exceptHolidays: '1' }));
    await avancer(arbre);
    expect(lus(arbre)).toContain('29 mercredis, sauf vacances scolaires (Zone B)');
    await appeler(() => tunnel(arbre).onNext());
    expect(attributeSeasonSlot).toHaveBeenCalledWith('salle-t18', {
      club: 'basket', endTime: '19:00', exceptHolidays: true, startTime: '17:30', weekday: 3,
    });
  });

  test('2. « Voir les dates retirées » : une ligne par période, décochable ; la Toussaint gardée part au serveur', async () => {
    const arbre = await monter();
    await jusquAuQuand(arbre);
    await appeler(() => caseVacances(arbre).props.onPress());
    await appeler(() => bouton(arbre, 'Voir les dates retirées').props.onPress());
    expect(lus(arbre)).toEqual(expect.arrayContaining([
      'Vacances retirées · Zone B',
      'Calendrier officiel 2026-2027',
      'Toussaint',
      '17 oct. – 1 nov. · mer. 21 oct. · mer. 28 oct.',
      'Noël',
      'Zone déduite de votre commune (Calvados). Une erreur ? Écrivez à FoundClub : nous la corrigeons.',
    ]));
    expect(periode(arbre, '2026-2027:toussaint').props.accessibilityState).toEqual({ checked: true });
    await appeler(() => periode(arbre, '2026-2027:toussaint').props.onPress());
    expect(periode(arbre, '2026-2027:toussaint').props.accessibilityState).toEqual({ checked: false });
    expect(lus(arbre)).toEqual(expect.arrayContaining(['31 mercredis', '6 retirés pendant les vacances : Noël, hiver, printemps.']));
    expect(previewFacilitySeasonSlot).toHaveBeenLastCalledWith('salle-t18', expect.objectContaining({
      exceptHolidays: '1', keepHolidays: '2026-2027:toussaint',
    }));
    await avancer(arbre);
    await appeler(() => tunnel(arbre).onNext());
    expect(attributeSeasonSlot).toHaveBeenCalledWith('salle-t18', expect.objectContaining({
      exceptHolidays: true, keepHolidays: ['2026-2027:toussaint'],
    }));
  });

  test('3. sans zone connue (aperçu sans vacances) : pas de case, rien ne change', async () => {
    /** @type {any} */ (previewFacilitySeasonSlot).mockResolvedValue({
      data: {
        capacity: 2, closures: [], holidays: null, needsConfirmation: false, occupants: [],
      },
    });
    const arbre = await monter();
    await jusquAuQuand(arbre);
    expect(caseVacances(arbre)).toBeUndefined();
    expect(lus(arbre)).toContain('37 mercredis');
  });

  test('4. des jours différents : le calendrier marque les vacances de la zone', async () => {
    /** @type {any} */ (listFacilitySeasonSlots).mockResolvedValue({
      data: [], meta: { facility: { ...SALLE, plateaux: [] }, holidays: ZONE_B, season: SAISON },
    });
    const arbre = await monter();
    await choisir(arbre, 'Montrivage Basket');
    // A7-UX-2 (22/10, Adel « P2 oui ») : le club et l'équipe sur une étape, un « Suivant » de moins.
    await avancer(arbre);
    await choisir(arbre, 'Des jours différents');
    await avancer(arbre);
    await choisirHeure('Début', '17:30');
    await choisirHeure('Fin', '19:00');
    await avancer(arbre);
    // Avant toute date cochée : la zone de la liste des créneaux suffit.
    expect(jourDuCalendrier(arbre, '2026-10-21').props.accessibilityLabel).toMatch(/vacances \(Toussaint\)/);
    expect(lus(arbre)).toContain('Vacances (Zone B)');
    await appeler(() => jourDuCalendrier(arbre, '2026-10-28').props.onPress());
    expect(jourDuCalendrier(arbre, '2026-10-28').props.accessibilityLabel).toMatch(/vacances \(Toussaint\), choisi/);
    const suivant = arbre.root.findAll((/** @type {any} */ n) => n.type === TouchableOpacity && /Mois suivant/.test(String(n.props.accessibilityLabel)))[0];
    await appeler(() => suivant.props.onPress());
    expect(jourDuCalendrier(arbre, '2026-11-04').props.accessibilityLabel).not.toMatch(/vacances/);
    expect(jourDuCalendrier(arbre, '2026-11-01').props.accessibilityLabel).toMatch(/vacances \(Toussaint\)/);
  });

  test('5. modifier un créneau « sauf vacances » : la case est cochée, Noël reste gardé, rien ne part si rien ne change', async () => {
    const slot = {
      club: { documentId: 'basket', name: 'Montrivage Basket' },
      documentId: 'creneau-1',
      endTime: '19:00',
      everyWeeks: 1,
      exceptHolidays: true,
      holidayDates: ['2026-10-21', '2026-10-28', '2027-02-24', '2027-03-03', '2027-04-21', '2027-04-28'],
      recurrence: 'weekly',
      startTime: '17:30',
      validFrom: '2026-10-21',
      validUntil: '2027-06-30',
      weekday: 3,
    };
    // Le panneau « Modifier » (sans parcours guidé) : toutes ses parties sont visibles.
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    /** @type {any} */
    let arbre;
    await act(async () => {
      arbre = renderer.create(
        <QueryClientProvider client={client}>
          <SeasonSlotForm facilityId="salle-t18" onDone={jest.fn()} slot={slot} />
        </QueryClientProvider>,
      );
    });
    await tours();
    arbresMontes.push(arbre);
    expect(caseVacances(arbre).props.accessibilityState).toEqual({ checked: true });
    expect(lus(arbre)).toContain('31 mercredis');
    await appeler(() => bouton(arbre, 'Voir les dates retirées').props.onPress());
    expect(periode(arbre, '2026-2027:noel').props.accessibilityState).toEqual({ checked: false });
    expect(periode(arbre, '2026-2027:toussaint').props.accessibilityState).toEqual({ checked: true });
  });
});

jest.mock(
  '@/components/atoms/skeletonLoader/SkeletonLoader',
  () => function SkeletonMock({ children }) { return children; },
);
jest.mock('@/context/AppFeedbackContext', () => ({
  useAppFeedback: () => ({ showBanner: jest.fn() }),
}));
