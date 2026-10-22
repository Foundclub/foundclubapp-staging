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

// 🧪 R17-QUAND-1, point 4 (REC17-007) — L'ÉTAPE « QUAND ? » DU TUNNEL « ATTRIBUER UN CRÉNEAU »
// (planches P10-quand-tel et P11-quand-v2-tel, validées par Adel le 19/10 : « ok go »).
// Avant (ROUGE) : après le jour et l'heure, le tunnel allait au récapitulatif avec une période
// figée (« Toute la saison ») et n'envoyait AUCUNE période ; ni « toutes les 2 semaines », ni
// « des dates choisies », ni « Des jours différents » (Q4 B).
// Ce fichier exige : l'étape vient après les heures (6 étapes ; 5 depuis A7-UX-2), ses quatre formes avec leur nombre
// de séances et celles qui tombent dans une fermeture ; la forme part au serveur ; « Des jours
// différents » ouvre le calendrier libre ; la ligne « Quand » du récapitulatif se touche.

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
// Des champs choisis : un écart sur les props entières du gabarit (enfants React) épuise la mémoire de jest.
const etape = (/** @type {any} */ arbre) => {
  const {
    stepCount, stepIndex, subtitle, title,
  } = tunnel(arbre);
  return {
    stepCount, stepIndex, subtitle, title,
  };
};
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
const ligneDuRecap = (/** @type {any} */ arbre, /** @type {string} */ cle) => arbre.root.findAll(
  (/** @type {any} */ n) => n.props.testID === `recap-${cle}`,
)[0];

// Club et équipe (tout le club), mercredi, 17:30 – 19:00, puis « Quand ? ».
// A7-UX-2 (22/10, Adel « P2 oui ») : le club et l'équipe sur UNE étape, un « Suivant » de moins.
const jusquAuQuand = async (/** @type {any} */ arbre, { jour = 'Mercredi' } = {}) => {
  await choisir(arbre, 'Montrivage Basket');
  await avancer(arbre);
  await choisir(arbre, jour);
  await avancer(arbre);
  await choisirHeure('Début', '17:30');
  await choisirHeure('Fin', '19:00');
  await avancer(arbre);
};

describe('R17Q1-4 — « Quand ? » : quatre formes, après le jour et l’heure', () => {
  // INVERSÉ PAR A7-UX-2 (22/10) — motif : club et équipe sur une étape (Adel « P2 oui ») : 5/6 → 4/5.
  test('1. l’étape 4/5, déjà répondue « Toute la saison » : 37 mercredis, 2 dans « Vacances de Noël »', async () => {
    const arbre = await monter();
    await jusquAuQuand(arbre);
    expect(etape(arbre)).toEqual({
      stepCount: 5, stepIndex: 4, subtitle: 'Mercredi 17:30 – 19:00 · T18 Salle essai', title: 'Quand ?',
    });
    expect(['Toute la saison', 'Une période', 'Toutes les 2 semaines', 'Des dates choisies'].map((libelle) => choix(arbre, libelle)?.props.accessibilityState))
      .toEqual([{ checked: true }, { checked: false }, { checked: false }, { checked: false }]);
    expect(lus(arbre)).toEqual(expect.arrayContaining([
      'Chaque mercredi, du 21 oct. au 30 juin',
      '37 mercredis',
      '2 tombent dans « Vacances de Noël » (23 déc., 30 déc.) : le club y verra « fermé », comme aujourd’hui.',
    ]));
    await avancer(arbre);
    expect(tunnel(arbre).title).toBe('Récapitulatif');
    expect(lus(arbre)).toEqual(expect.arrayContaining(['Toute la saison · 21 oct. – 30 juin', '37 mercredis, dont 2 fermés (23 déc., 30 déc.)']));
    await appeler(() => tunnel(arbre).onNext());
    expect(attributeSeasonSlot).toHaveBeenCalledWith('salle-t18', {
      club: 'basket', endTime: '19:00', startTime: '17:30', weekday: 3,
    });
  });

  test('2. toutes les 2 semaines : à partir du 1er mercredi, jusqu’à la fin de saison ; les prochaines dates s’écrivent', async () => {
    const arbre = await monter();
    await jusquAuQuand(arbre);
    await choisir(arbre, 'Toutes les 2 semaines');
    expect(mockDateProps.filter((p) => p.label === 'À partir du').at(-1).value).toBe('21/10/2026');
    expect(lus(arbre)).toEqual(expect.arrayContaining(['19 mercredis', 'Fin\u00a0de\u00a0saison', 'Une\u00a0date', '21 oct.', '4 nov.', '18 nov.']));
    await avancer(arbre);
    expect(lus(arbre)).toContain('Toutes les 2 semaines · 21 oct. – 30 juin');
    await appeler(() => tunnel(arbre).onNext());
    expect(attributeSeasonSlot).toHaveBeenCalledWith('salle-t18', {
      anchorDate: '2026-10-21', club: 'basket', endTime: '19:00', everyWeeks: 2, recurrence: 'weekly', startTime: '17:30', validFrom: '2026-10-21', validUntil: '2027-06-30', weekday: 3,
    });
    // L'aperçu de place juge la même forme.
    expect(previewFacilitySeasonSlot).toHaveBeenLastCalledWith('salle-t18', expect.objectContaining({ anchorDate: '2026-10-21', everyWeeks: 2, recurrence: 'weekly' }));
  });

  test('3. une période : « Du » / « Au » ; « Au » avant « Du » se dit et bloque', async () => {
    const arbre = await monter();
    await jusquAuQuand(arbre);
    await choisir(arbre, 'Une période');
    expect(tunnel(arbre).isNextDisabled).toBe(true);
    await appeler(() => mockDateProps.filter((p) => p.label === 'Du').at(-1).onChange('18/12/2026'));
    await appeler(() => mockDateProps.filter((p) => p.label === 'Au').at(-1).onChange('21/10/2026'));
    expect(lus(arbre)).toContain('« Au » doit venir après « Du ».');
    expect(tunnel(arbre).isNextDisabled).toBe(true);
    await appeler(() => mockDateProps.filter((p) => p.label === 'Du').at(-1).onChange('21/10/2026'));
    await appeler(() => mockDateProps.filter((p) => p.label === 'Au').at(-1).onChange('18/12/2026'));
    expect(lus(arbre)).toEqual(expect.arrayContaining(['9 mercredis', 'Aucune ne tombe dans une fermeture.']));
    await avancer(arbre);
    await appeler(() => tunnel(arbre).onNext());
    expect(attributeSeasonSlot).toHaveBeenCalledWith('salle-t18', expect.objectContaining({ validFrom: '2026-10-21', validUntil: '2026-12-18', weekday: 3 }));
  });
});

describe('R17Q1-4 — « Des jours différents » (Q4 B) : le calendrier libre', () => {
  test('4. trois dates, deux jours différents : « Quelles dates ? », rien avant la 1re coche, la liste part sans jour', async () => {
    const arbre = await monter();
    await choisir(arbre, 'Montrivage Basket');
    await avancer(arbre); // A7-UX-2 : club et équipe sur une étape
    await choisir(arbre, 'Des jours différents');
    await avancer(arbre);
    expect(tunnel(arbre).subtitle).toBe('Dates choisies · T18 Salle essai');
    await choisirHeure('Début', '17:30');
    await choisirHeure('Fin', '19:00');
    await avancer(arbre);
    expect(etape(arbre)).toEqual({
      stepCount: 5, stepIndex: 4, subtitle: '17:30 – 19:00 · T18 Salle essai', title: 'Quelles dates ?',
    });
    expect(choix(arbre, 'Toute la saison')).toBeUndefined();
    expect(lus(arbre)).toContain('Aucune date cochée.');
    expect(tunnel(arbre).isNextDisabled).toBe(true);
    await appeler(() => jourDuCalendrier(arbre, '2026-10-24').props.onPress());
    await appeler(() => jourDuCalendrier(arbre, '2026-10-21').props.onPress());
    await appeler(() => jourDuCalendrier(arbre, '2026-10-27').props.onPress());
    expect(jourDuCalendrier(arbre, '2026-10-21').props.accessibilityState).toEqual({ disabled: false, selected: true });
    expect(jourDuCalendrier(arbre, '2026-10-16').props.accessibilityState.disabled).toBe(true);
    expect(lus(arbre)).toEqual(expect.arrayContaining(['3 dates choisies', 'mer. 21 oct. · sam. 24 oct. · mar. 27 oct.']));
    await avancer(arbre);
    expect(lus(arbre)).toEqual(expect.arrayContaining(['Heures', '17:30 – 19:00', '3 dates choisies']));
    await appeler(() => tunnel(arbre).onNext());
    expect(attributeSeasonSlot).toHaveBeenCalledWith('salle-t18', {
      club: 'basket', dates: ['2026-10-21', '2026-10-24', '2026-10-27'], endTime: '19:00', recurrence: 'dates', startTime: '17:30',
    });
  });

  test('5. une date dans une fermeture ne se coche pas, et le dit', async () => {
    const arbre = await monter();
    await choisir(arbre, 'Montrivage Basket');
    await avancer(arbre); // A7-UX-2 : club et équipe sur une étape
    await choisir(arbre, 'Mercredi');
    await avancer(arbre);
    await choisirHeure('Début', '17:30');
    await choisirHeure('Fin', '19:00');
    await avancer(arbre);
    await choisir(arbre, 'Des dates choisies');
    await appeler(() => jourDuCalendrier(arbre, '2026-10-21').props.onPress());
    // Le mois de décembre, où tombe « Vacances de Noël » (aperçu : fermetures de la saison).
    for (let mois = 0; mois < 2; mois += 1) {
      // eslint-disable-next-line no-await-in-loop
      await appeler(() => arbre.root.findAll((n) => n.type === TouchableOpacity && /calendrier\.suivant|Mois suivant/.test(String(n.props.accessibilityLabel)))[0].props.onPress());
    }
    const noel = jourDuCalendrier(arbre, '2026-12-23');
    expect(noel.props.accessibilityState).toEqual({ disabled: true, selected: false });
    expect(noel.props.accessibilityLabel).toBe('mer. 23 déc., fermé (Vacances de Noël)');
  });
});

describe('R17Q1-4 — la ligne « Quand » du récapitulatif se touche', () => {
  // INVERSÉ PAR A7-UX-2 (22/10) — motif : club et équipe sur une étape (Adel « P2 oui ») : 3 → 2.
  test('6. depuis une case du planning (2 étapes) : « Quand » rouvre l’étape, sans étape de plus au départ', async () => {
    const arbre = await monter({ compact: true, initial: { endTime: '19:30', startTime: '18:00', weekday: 3 } });
    expect(tunnel(arbre).stepCount).toBe(2);
    await choisir(arbre, 'Montrivage Basket');
    await avancer(arbre);
    expect(tunnel(arbre).title).toBe('Récapitulatif');
    await appeler(() => ligneDuRecap(arbre, 'quand').props.onPress());
    expect([tunnel(arbre).title, tunnel(arbre).stepIndex, tunnel(arbre).stepCount]).toEqual(['Quand ?', 2, 3]);
    await choisir(arbre, 'Toutes les 2 semaines');
    await avancer(arbre);
    expect(lus(arbre)).toContain('Toutes les 2 semaines · 21 oct. – 30 juin');
  });
});

jest.mock(
  '@/components/atoms/skeletonLoader/SkeletonLoader',
  () => function SkeletonMock({ children }) { return children; },
);
jest.mock('@/context/AppFeedbackContext', () => ({
  useAppFeedback: () => ({ showBanner: jest.fn() }),
}));
