/* eslint-disable max-len -- donnees de test : les fixtures se lisent mieux sur une ligne */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Text, TouchableOpacity, View } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';

import {
  attributeSeasonSlot,
  getClubTeamsForSlot,
  listFacilitySeasonSlots,
  modifySeasonSlot,
  previewFacilitySeasonSlot,
} from '@/services/seasonSlot/seasonSlotService';

import RondsDePlaces from '../RondsDePlaces';
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
// RET-FERMETURE-HEURES, question 9 (Adel, 03/11) : attribuer sur une fermeture se confirme.
const confirmerFermeture = (/** @type {any} */ arbre) => appeler(() => arbre.root.findAll(
  (/** @type {any} */ n) => n.props.testID === 'confirmer-fermeture-oui' && typeof n.props.onPress === 'function',
)[0].props.onPress());
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

describe('R17Q1-4 — « Quand ? » : quatre formes, après le jour et l’heure', () => {
  // INVERSÉ PAR A7-UX-2 (22/10) — motif : club et équipe sur une étape (Adel « P2 oui ») : 5/6 → 4/5.
  // INVERSÉ PAR DATESDABORD (23/10) — motif : « Date & horaire » réunit jour, heures et « Quand ? »
  // (4/5 → 2/3) ; « Répéter » dit « Toutes les semaines » (jusqu'à la fin de saison) au lieu des
  // quatre puces.
  test('1. l’étape 2/3, déjà répondue « Toutes les semaines » : 37 mercredis, 2 dans « Vacances de Noël »', async () => {
    const arbre = await monter();
    await jusquAuQuand(arbre);
    expect(etape(arbre)).toEqual({
      stepCount: 3, stepIndex: 2, subtitle: 'Montrivage Basket · Tout le club · T18 Salle essai', title: 'Date & horaire',
    });
    expect(choix(arbre, 'Toute la saison')).toBeUndefined();
    expect(lus(arbre)).toEqual(expect.arrayContaining([
      // DATESDABORD (26/10) : « RÉPÉTER » sur l'écran, « Chaque semaine » choisi.
      'RÉPÉTER',
      'Chaque semaine',
      '37 mercredis',
      '2 tombent dans « Vacances de Noël » (23 déc., 30 déc.) : le club y verra « fermé », comme aujourd’hui.',
    ]));
    await avancer(arbre);
    expect(tunnel(arbre).title).toBe('Récapitulatif');
    expect(lus(arbre)).toEqual(expect.arrayContaining(['Toute la saison · 21 oct. – 30 juin', '37 mercredis, dont 2 fermés (23 déc., 30 déc.)']));
    await appeler(() => tunnel(arbre).onNext());
    await confirmerFermeture(arbre);
    expect(attributeSeasonSlot).toHaveBeenCalledWith('salle-t18', {
      club: 'basket', endTime: '19:00', startTime: '17:30', weekday: 3,
    });
  });

  test('2. toutes les 2 semaines : à partir du 1er mercredi, jusqu’à la fin de saison ; les prochaines dates s’écrivent', async () => {
    const arbre = await monter();
    await jusquAuQuand(arbre);
    await repeter(arbre, { intervalleTexte: '2' });
    expect(lus(arbre)).toEqual(expect.arrayContaining(['Toutes les 2 semaines', '19 mercredis']));
    await avancer(arbre);
    expect(lus(arbre)).toContain('Toutes les 2 semaines · 21 oct. – 30 juin');
    await appeler(() => tunnel(arbre).onNext());
    await confirmerFermeture(arbre);
    expect(attributeSeasonSlot).toHaveBeenCalledWith('salle-t18', {
      anchorDate: '2026-10-21', club: 'basket', endTime: '19:00', everyWeeks: 2, recurrence: 'weekly', startTime: '17:30', validFrom: '2026-10-21', validUntil: '2027-06-30', weekday: 3,
    });
    // L'aperçu de place juge la même forme.
    expect(previewFacilitySeasonSlot).toHaveBeenLastCalledWith('salle-t18', expect.objectContaining({ anchorDate: '2026-10-21', everyWeeks: 2, recurrence: 'weekly' }));
  });

  test('3. une période : « Du » / « Au » ; « Au » avant « Du » se dit et bloque', async () => {
    const arbre = await monter();
    await jusquAuQuand(arbre);
    await repeter(arbre, { au: new Date(2026, 9, 21), du: new Date(2026, 11, 18) });
    expect(lus(arbre)).toContain('« Au » doit venir après « Du ».');
    expect(tunnel(arbre).isNextDisabled).toBe(true);
    await repeter(arbre, { au: new Date(2026, 11, 18), du: new Date(2026, 9, 21) });
    expect(lus(arbre)).toEqual(expect.arrayContaining(['9 mercredis', 'Aucune ne tombe dans une fermeture.']));
    await avancer(arbre);
    await appeler(() => tunnel(arbre).onNext());
    expect(attributeSeasonSlot).toHaveBeenCalledWith('salle-t18', expect.objectContaining({ validFrom: '2026-10-21', validUntil: '2026-12-18', weekday: 3 }));
  });
});

describe('R17Q1-4 — « Des jours différents » (Q4 B) : le calendrier libre', () => {
  // INVERSÉ PAR DATESDABORD (23/10) — motif : les jours différents se disent par « Répéter »
  // (plusieurs jours de la semaine, du … au …), comme pour un événement ; la liste part pareil.
  test('4. trois dates, deux jours différents : « Répéter » mercredi, samedi et mardi, la liste part sans jour', async () => {
    const arbre = await monter();
    await jusquAuQuand(arbre);
    await repeter(arbre, { au: new Date(2026, 9, 27), jours: [3, 6, 2] });
    expect(lus(arbre)).toEqual(expect.arrayContaining(['3 créneaux ponctuels', 'mer. 21 oct. · sam. 24 oct. · mar. 27 oct.']));
    await avancer(arbre);
    expect(lus(arbre)).toEqual(expect.arrayContaining(['Heures', '17:30 – 19:00', '3 créneaux ponctuels']));
    await appeler(() => tunnel(arbre).onNext());
    expect(attributeSeasonSlot).toHaveBeenCalledWith('salle-t18', {
      club: 'basket', dates: ['2026-10-21', '2026-10-24', '2026-10-27'], endTime: '19:00', recurrence: 'dates', startTime: '17:30',
    });
  });

  // DATESDABORD (23/10) : le calendrier libre n'est plus à la création ; il reste à « Modifier »
  // un créneau à dates choisies (sa 3e étape, « Quelles dates ? »).
  test('5. une date dans une fermeture ne se coche pas, et le dit', async () => {
    const arbre = await monter({
      slot: {
        club: { documentId: 'basket', name: 'Montrivage Basket' }, dates: ['2026-10-21'], documentId: 'c-dates', endTime: '19:00', recurrence: 'dates', startTime: '17:30', validFrom: '2026-10-21', validUntil: '2026-10-21', weekday: null,
      },
    });
    await avancer(arbre);
    await avancer(arbre);
    expect(tunnel(arbre).title).toBe('Quelles dates ?');
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

// RET-FERMETURE-HEURES, question 9 (Adel, 03/11, « A oui avec un petit message d'avertissement êtes-vous
// sûr car ») : la Ville garde le droit d'attribuer pendant une fermeture, mais on lui demande de confirmer.
describe('RET-FERMETURE-HEURES Q9 — attribuer pendant une fermeture se confirme', () => {
  const TRAVAUX = {
    endDate: '2026-10-21', endTime: '20:00:00.000', kind: 'closure', label: 'Travaux', startDate: '2026-10-21', startTime: '17:00:00.000',
  };
  const dialogue = (/** @type {any} */ arbre) => arbre.root.findAll(
    (/** @type {any} */ n) => n.props.testID === 'confirmer-fermeture' && n.type === View,
  )[0];
  const bouton = (/** @type {any} */ arbre, /** @type {string} */ testID) => arbre.root.findAll(
    (/** @type {any} */ n) => n.props.testID === testID && typeof n.props.onPress === 'function',
  )[0];
  const jusquAuRecap = async (/** @type {any} */ arbre, /** @type {any} */ suite) => {
    await jusquAuQuand(arbre);
    if (suite) await repeter(arbre, suite);
    await avancer(arbre);
    expect(tunnel(arbre).title).toBe('Récapitulatif');
  };

  test('une séance sur une fermeture à heures : le motif et les heures, rien ne part avant « Attribuer quand même »', async () => {
    /** @type {any} */ (previewFacilitySeasonSlot).mockResolvedValue({
      data: {
        capacity: 2, closures: [TRAVAUX], needsConfirmation: false, occupants: [],
      },
    });
    const arbre = await monter();
    await jusquAuRecap(arbre, { au: MERCREDI });
    await appeler(() => tunnel(arbre).onNext());
    expect(attributeSeasonSlot).not.toHaveBeenCalled();
    expect(dialogue(arbre)).toBeDefined();
    expect(lus(arbre)).toEqual(expect.arrayContaining([
      'Êtes-vous sûr ?',
      'Cette installation est fermée sur ce créneau (Travaux, 17:00 – 20:00). Attribuer quand même ?',
    ]));
    await appeler(() => bouton(arbre, 'confirmer-fermeture-oui').props.onPress());
    expect(attributeSeasonSlot).toHaveBeenCalledTimes(1);
    expect(/** @type {any} */ (attributeSeasonSlot).mock.calls[0][1]).not.toHaveProperty('confirmOverCapacity');
  });

  test('plusieurs séances : combien, sur combien, et le motif ; « Annuler » ne fait rien partir', async () => {
    const arbre = await monter();
    await jusquAuRecap(arbre);
    await appeler(() => tunnel(arbre).onNext());
    expect(lus(arbre)).toContain(
      '2 séances sur 37 tombent dans une fermeture (Vacances de Noël). Attribuer quand même ?',
    );
    await appeler(() => bouton(arbre, 'confirmer-fermeture-non').props.onPress());
    expect(dialogue(arbre)).toBeUndefined();
    expect(attributeSeasonSlot).not.toHaveBeenCalled();
  });

  test('sans fermeture touchée : pas de question, ça part', async () => {
    /** @type {any} */ (previewFacilitySeasonSlot).mockResolvedValue({
      data: {
        capacity: 2, closures: [], needsConfirmation: false, occupants: [],
      },
    });
    const arbre = await monter();
    await jusquAuRecap(arbre);
    await appeler(() => tunnel(arbre).onNext());
    expect(dialogue(arbre)).toBeUndefined();
    expect(attributeSeasonSlot).toHaveBeenCalledTimes(1);
  });

  test('complet ET fermé : la confirmation du complet part avec, une seule question', async () => {
    /** @type {any} */ (previewFacilitySeasonSlot).mockResolvedValue({
      data: {
        capacity: 2, closures: [NOEL], needsConfirmation: true, occupants: [],
      },
    });
    const arbre = await monter();
    await jusquAuRecap(arbre);
    await appeler(() => tunnel(arbre).onNext());
    await appeler(() => bouton(arbre, 'confirmer-fermeture-oui').props.onPress());
    expect(/** @type {any} */ (attributeSeasonSlot).mock.calls[0][1]).toMatchObject({ confirmOverCapacity: true });
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
    // DATESDABORD (23/10) : la ligne rouvre « Date & horaire » ; la forme se choisit par « Répéter ».
    expect([tunnel(arbre).title, tunnel(arbre).stepIndex, tunnel(arbre).stepCount]).toEqual(['Date & horaire', 2, 3]);
    await repeter(arbre, { intervalleTexte: '2' });
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

describe('T3-FINITIONS-VILLE — la carte de place', () => {
  const carte = (/** @type {any} */ arbre, /** @type {string} */ id) => arbre.root.findAll(
    (/** @type {any} */ n) => n.props.testID === id,
  )[0];

  test('point 4 : la seule séance tombe dans une fermeture : ni « place libre », ni « Personne n’y est »', async () => {
    /** @type {any} */ (previewFacilitySeasonSlot).mockResolvedValue({
      data: {
        capacity: 2,
        closures: [{
          endDate: '2026-10-21', endTime: '20:00:00.000', kind: 'closure', label: 'Travaux', startDate: '2026-10-21', startTime: '17:00:00.000',
        }],
        needsConfirmation: false,
        occupants: [],
      },
    });
    const arbre = await monter();
    await jusquAuQuand(arbre);
    await repeter(arbre, { au: MERCREDI });
    // T3-FINITIONS-VILLE-3 (contre-recette du train 3) : pas de « Toutes » pour une seule date.
    const dateEtHoraire = lus(arbre).join(' | ');
    expect(dateEtHoraire).not.toContain('Toutes tombent');
    expect(dateEtHoraire).toContain('Cette date tombe dans une fermeture (Travaux).');
    expect(dateEtHoraire).toContain('le club verra sa séance « fermé »');
    await avancer(arbre);
    const textes = lus(arbre).join(' | ');
    expect(textes).not.toContain('place libre');
    expect(textes).not.toContain('Personne n’y est.');
    expect(textes).toContain(': installation fermée');
    expect(carte(arbre, 'carte-fermee')).toBeDefined();
    // Pas de rond de place libre sur la carte fermée.
    expect(carte(arbre, 'carte-fermee').findAllByType(RondsDePlaces)).toHaveLength(0);
  });

  test('point 4 : une séance sur 37 fermée : la place reste libre le reste de l année', async () => {
    const arbre = await monter();
    await jusquAuQuand(arbre);
    await avancer(arbre);
    expect(lus(arbre).join(' | ')).toContain('place libre');
  });

  test('point 3 : complet, le message passe AU-DESSUS du choix des heures', async () => {
    /** @type {any} */ (previewFacilitySeasonSlot).mockResolvedValue({
      data: {
        capacity: 1,
        closures: [],
        needsConfirmation: true,
        occupants: [{ club: { name: 'T20 Club Karim' } }],
        overCapacity: true,
        peak: 1,
        teamsAfter: 2,
      },
    });
    const arbre = await monter();
    await jusquAuQuand(arbre);
    // Dans `sousLaDate` : au-dessus de Début et Fin, et une seule fois sur l étape.
    const parTest = (/** @type {any} */ n) => n.props.testID === 'carte-complet' && n.type === View;
    expect(arbre.root.findAll(parTest)).toHaveLength(1);
    expect(modele(arbre).props.sousLaDate).not.toBeNull();
  });
});
