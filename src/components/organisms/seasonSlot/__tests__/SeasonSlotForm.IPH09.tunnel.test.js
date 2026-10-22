/* eslint-disable max-len -- donnees de test : les fixtures se lisent mieux sur une ligne */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  Dimensions, StyleSheet, Text, View,
} from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { isoWeekdayOf } from '@/domains/seasonSlot/seasonSlotDisplay';

import {
  attributeSeasonSlot,
  getClubTeamsForSlot,
  listFacilitySeasonSlots,
  modifySeasonSlot,
  previewFacilitySeasonSlot,
} from '@/services/seasonSlot/seasonSlotService';

import SeasonSlotForm from '../SeasonSlotForm';

// 📅 SAIS (08/10/2026, tournée T20 lot 1) — « Attribuer un créneau » au téléphone s'ouvrait SANS
// jour choisi (capture T07b) quand le site en présélectionne un : le jour d'aujourd'hui l'est
// désormais, sauf si l'écran en apporte un (une case du planning) ou si l'on modifie un créneau.
// Banc : les doublures de SeasonSlotForm.VILLE-T18A.test.js, reprises telles quelles.

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

// COLL-R-A7 (COL-005) : le formulaire importe le gabarit des tunnels (son plein écran) ; le fond
// d'écran de ce gabarit (dégradé natif) reste hors de ce banc, comme dans les témoins d'écran.
jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) { return children; },
);
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {any[]} */ ...args) => jest.requireActual('i18next').t(...args),
  }),
}));
jest.mock('@/services/seasonSlot/seasonSlotService', () => ({
  attributeSeasonSlot: jest.fn(),
  getClubTeamsForSlot: jest.fn(),
  listFacilitySeasonSlots: jest.fn(),
  modifySeasonSlot: jest.fn(),
  previewFacilitySeasonSlot: jest.fn(),
}));
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
// Les champs d heure, quel que soit leur composant : le point 3 exige le sélecteur d heure.
jest.mock('@/components/molecules/input/Input', () => function InputMock(/** @type {any} */ props) {
  mockHeureProps.push({ ...props, composant: 'Input' });
  return null;
});
jest.mock('@/components/molecules/timePickerInput/TimePickerInput', () => function TimePickerInputMock(/** @type {any} */ props) {
  mockHeureProps.push({ ...props, composant: 'TimePickerInput' });
  return null;
});
jest.mock('@/components/molecules/datePickerInput/DatePickerInput', () => function DatePickerInputMock() { return null; });
jest.mock('@/components/organisms/seasonSlot/RondsDePlaces', () => function RondsDePlacesMock() { return null; });

const SAISON = { validFrom: '2026-09-01', validUntil: '2027-06-30' };

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
          clubs={props.clubs || [{ documentId: 'basket', name: 'Montrivage Basket' }]}
          compact={props.compact}
          facilities={props.facilities}
          facilityId={props.facilities ? null : 'salle-t18'}
          fixedClubId={props.fixedClubId}
          guided
          initial={props.initial}
          onCancel={props.onCancel || jest.fn()}
          onDone={props.onDone || jest.fn()}
          slot={props.slot}
        />
      </QueryClientProvider>,
    );
  });
  await tours();
  arbresMontes.push(arbre);
  return arbre;
};
const jourChoisi = (/** @type {any} */ arbre) => arbre.root.findAll(
  (/** @type {any} */ n) => /^jour-\d$/.test(String(n.props?.testID || ''))
    && n.props?.accessibilityState?.checked === true,
  { deep: false },
).map((/** @type {any} */ n) => n.props.testID);

beforeEach(() => {
  jest.clearAllMocks();
  mockHeureProps.length = 0;
  /** @type {any} */ (getClubTeamsForSlot).mockResolvedValue([{ documentId: 'u13', name: 'U13' }]);
  /** @type {any} */ (listFacilitySeasonSlots).mockResolvedValue({
    data: [],
    meta: {
      facility: {
        documentId: 'salle-t18', maxSlots: 2, name: 'T18 Salle essai', plateaux: [],
      },
      season: SAISON,
    },
  });
  /** @type {any} */ (previewFacilitySeasonSlot).mockResolvedValue({ data: { capacity: 2, needsConfirmation: false, occupants: [] } });
  /** @type {any} */ (attributeSeasonSlot).mockResolvedValue({ data: { documentId: 'neuf' } });
  /** @type {any} */ (modifySeasonSlot).mockResolvedValue({ data: {} });
});
afterEach(() => {
  act(() => { arbresMontes.splice(0).forEach((arbre) => arbre.unmount()); });
});

const bouton = (arbre, title) => arbre.root.findAll((n) => n.props.title === title && typeof n.props.onPress === 'function')[0];
const presser = async (arbre, title) => {
  const cible = bouton(arbre, title);
  expect(cible).toBeDefined();
  expect(cible.props.disabled).not.toBe(true);
  await act(async () => { await cible.props.onPress(); });
  await tours();
};
const etape = (arbre) => arbre.root.findAllByType(View).find((n) => n.props.testID === 'season-slot-step')?.props.accessibilityLabel;
const champ = (arbre, label) => arbre.root.findAll((n) => n.props.label === label && typeof n.props.onChange === 'function')[0];
const choisirHeure = async (arbre, label, value) => {
  act(() => champ(arbre, label).props.onChange(value));
  await tours();
};
const puce = async (arbre, libelle) => {
  const cible = arbre.root.findAll((n) => n.props.libelle === libelle && typeof n.props.onPress === 'function')[0];
  await act(async () => cible.props.onPress());
  await tours();
};
const suivant = (arbre) => presser(arbre, 'Suivant');
const textesLus = (arbre) => arbre.root.findAllByType(Text).map((n) => [].concat(n.props.children).join(''));
// A7-UX-2 (22/10, Adel « P2 oui ») : le club et l'équipe sur UNE étape : deux « Suivant » jusqu'aux heures.
const versHeures = async (arbre) => { await suivant(arbre); await suivant(arbre); };
// 📐 COLL-R-A7 (13/10, COL-005, D4 A) : « Période » n'avait rien à choisir ⇒ sautée.
// 🗓️ R17-QUAND-1 (19/10, planche P10-quand-tel validée) : l'étape « Quand ? » vient après les
// heures, déjà répondue (« Toute la saison ») : des horaires au récapitulatif, DEUX « Suivant ».
const versRecap = async (arbre) => { await suivant(arbre); await suivant(arbre); };

describe('IPH09 FC-002 — tunnel local, mêmes contrats serveur', () => {
  // INVERSÉ PAR A7-UX-2 (22/10) — motif : club et équipe sur une étape (Adel « P2 oui ») : 6 → 5
  // étapes ; l'équipe se choisit sur l'étape 1 et se retrouve au retour depuis l'étape 2.
  test('cinq étapes (« Quand ? » après les heures), valeurs conservées au retour, équipe facultative et confirmation unique', async () => {
    const onDone = jest.fn();
    const arbre = await monter({ onDone });
    expect(etape(arbre)).toBe('Étape 1/5');
    expect(champ(arbre, 'Début')).toBeUndefined();
    await puce(arbre, 'U13');
    await suivant(arbre);
    await presser(arbre, 'Retour');
    expect(etape(arbre)).toBe('Étape 1/5');
    expect(arbre.root.findAll((n) => n.props.libelle === 'U13')[0].props.actif).toBe(true);
    await puce(arbre, 'Tout le club');
    await suivant(arbre);
    expect(jourChoisi(arbre)).toEqual([`jour-${isoWeekdayOf(new Date())}`]);
    await suivant(arbre);
    await choisirHeure(arbre, 'Début', '17:30');
    await choisirHeure(arbre, 'Fin', '19:00');
    await suivant(arbre);
    // R17-QUAND-1 : l'étape « Quand ? », toute la saison par défaut.
    expect(etape(arbre)).toBe('Étape 4/5');
    expect(attributeSeasonSlot).not.toHaveBeenCalled();
    await presser(arbre, 'Retour');
    expect(champ(arbre, 'Début').props.value).toBe('17:30');
    await versRecap(arbre);
    expect(etape(arbre)).toBe('Étape 5/5');
    // « Toute la saison · <1re séance à venir> – <dernière, en juin> » (elles suivent le jour du test).
    expect(textesLus(arbre).some((texte) => /^Toute la saison · .+ – \d+ juin$/.test(texte))).toBe(true);
    expect(champ(arbre, 'Début')).toBeUndefined();
    await presser(arbre, 'Attribuer le créneau');
    expect(attributeSeasonSlot).toHaveBeenCalledTimes(1);
    expect(attributeSeasonSlot).toHaveBeenCalledWith('salle-t18', {
      club: 'basket', endTime: '19:00', startTime: '17:30', weekday: isoWeekdayOf(new Date()),
    });
    expect(onDone).toHaveBeenCalledWith({ documentId: 'neuf' });
  });

  test('horaires invalides bloquent la progression et la confirmation', async () => {
    const arbre = await monter();
    await versHeures(arbre);
    expect(bouton(arbre, 'Suivant').props.disabled).toBe(true);
    await choisirHeure(arbre, 'Début', '19:00');
    await choisirHeure(arbre, 'Fin', '18:00');
    expect(bouton(arbre, 'Suivant').props.disabled).toBe(true);
    expect(attributeSeasonSlot).not.toHaveBeenCalled();
    await choisirHeure(arbre, 'Fin', '20:00');
    expect(bouton(arbre, 'Suivant').props.disabled).toBe(false);
  });

  test('premier retour ferme sans mutation ; le planning conserve ses heures préremplies', async () => {
    const onCancel = jest.fn();
    const arbre = await monter({ compact: true, initial: { endTime: '19:30', startTime: '18:00', weekday: 3 }, onCancel });
    // A7-UX-2 : club et équipe sur une étape : 3 → 2 étapes.
    expect(etape(arbre)).toBe('Étape 1/2');
    await presser(arbre, 'Retour');
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(attributeSeasonSlot).not.toHaveBeenCalled();
    // COLL-R-A7 : depuis une heure libre du planning, Jour et Horaires n'ont rien à choisir.
    await suivant(arbre);
    expect(etape(arbre)).toBe('Étape 2/2');
    expect(champ(arbre, 'Début')).toBeUndefined();
    await presser(arbre, 'Attribuer pour la saison');
    expect(attributeSeasonSlot).toHaveBeenCalledWith('salle-t18', {
      club: 'basket', endTime: '19:30', startTime: '18:00', weekday: 3,
    });
  });

  test('modifier conserve club/équipe et exclut le créneau de l’aperçu', async () => {
    const arbre = await monter({
      slot: {
        club: { documentId: 'basket', name: 'Montrivage Basket' },
        documentId: 'slot-1',
        endTime: '19:00',
        facility: { documentId: 'salle-t18' },
        startTime: '17:30',
        team: { documentId: 'u13', name: 'U13' },
        weekday: 2,
        ...SAISON,
      },
    });
    expect(etape(arbre)).toBe('Étape 1/4');
    expect(jourChoisi(arbre)).toEqual(['jour-2']);
    await suivant(arbre);
    await choisirHeure(arbre, 'Fin', '20:00');
    // « Modifier » garde ses 4 étapes : la période s'y CHOISIT (Du, Au, À partir du).
    await suivant(arbre);
    await suivant(arbre);
    expect(etape(arbre)).toBe('Étape 4/4');
    await presser(arbre, 'Enregistrer');
    expect(modifySeasonSlot).toHaveBeenCalledWith('slot-1', expect.objectContaining({ endTime: '20:00', startTime: '17:30', weekday: 2 }));
    expect(modifySeasonSlot.mock.calls[0][1]).not.toHaveProperty('club');
    expect(modifySeasonSlot.mock.calls[0][1]).not.toHaveProperty('team');
    expect(previewFacilitySeasonSlot).toHaveBeenLastCalledWith('salle-t18', expect.objectContaining({ excludeSlot: 'slot-1' }));
  });

  test('capacité pleine : confirmer seulement au récapitulatif ; changer l’heure revient aux horaires', async () => {
    previewFacilitySeasonSlot.mockResolvedValue({
      data: {
        capacity: 1, needsConfirmation: true, occupants: [], teamsAfter: 2,
      },
    });
    const arbre = await monter({ initial: { endTime: '19:00', startTime: '17:30', weekday: 2 } });
    await versHeures(arbre);
    expect(bouton(arbre, 'Attribuer quand même')).toBeUndefined();
    await versRecap(arbre);
    await presser(arbre, 'Changer l’heure');
    expect(champ(arbre, 'Début')).toBeDefined();
    await choisirHeure(arbre, 'Début', '18:00');
    await choisirHeure(arbre, 'Fin', '19:30');
    await versRecap(arbre);
    await presser(arbre, 'Attribuer quand même');
    expect(attributeSeasonSlot).toHaveBeenCalledWith('salle-t18', expect.objectContaining({ confirmOverCapacity: true }));
  });
});

test('IPH09 : changement de club efface l’équipe, choix de l’installation depuis la fiche club', async () => {
  const arbre = await monter({
    clubs: [{ documentId: 'basket', name: 'Montrivage Basket' }, { documentId: 'football', name: 'Montrivage FC' }],
    facilities: [{ documentId: 'salle-t18', name: 'Salle' }, { documentId: 'terrain', name: 'Terrain' }],
  });
  // A7-UX-2 (22/10, Adel « P2 oui ») : club et équipe sur la même étape : 7 → 6 étapes, et le
  // changement de club se voit sur place (l'équipe revient à « Tout le club »).
  expect(etape(arbre)).toBe('Étape 1/6');
  expect(bouton(arbre, 'Suivant').props.disabled).toBe(true);
  await puce(arbre, 'Salle');
  await suivant(arbre);
  await puce(arbre, 'Montrivage Basket');
  await puce(arbre, 'U13');
  expect(arbre.root.findAll((n) => n.props.libelle === 'U13')[0].props.actif).toBe(true);
  await puce(arbre, 'Montrivage FC');
  expect(arbre.root.findAll((n) => n.props.libelle === 'Tout le club')[0].props.actif).toBe(true);
  expect(attributeSeasonSlot).not.toHaveBeenCalled();
});

test('IPH09 : période et date d’effet invalides bloquent la modification', async () => {
  const arbre = await monter({
    slot: {
      club: { documentId: 'basket' },
      documentId: 'slot-1',
      endTime: '19:00',
      facility: { documentId: 'salle-t18' },
      startTime: '17:30',
      weekday: 2,
      ...SAISON,
    },
  });
  await suivant(arbre);
  await suivant(arbre);
  // R17-QUAND-1 : « Période » est devenue « Quand ? » ; « Du » / « Au » sont sous « Une période ».
  await puce(arbre, 'Une période');
  act(() => champ(arbre, 'Au').props.onChange('01/08/2026'));
  expect(bouton(arbre, 'Suivant').props.disabled).toBe(true);
  act(() => champ(arbre, 'Au').props.onChange('30/06/2027'));
  act(() => champ(arbre, 'À partir du').props.onChange('invalide'));
  expect(bouton(arbre, 'Suivant').props.disabled).toBe(true);
  expect(modifySeasonSlot).not.toHaveBeenCalled();
});

test.each([1, 2])('IPH09 : écran court 320x568 / fontScale %s — contenu souple, sans troncature du récapitulatif', async (fontScale) => {
  // Contrôle structurel uniquement : React Test Renderer ne calcule pas le rendu iPhone.
  const dimensions = jest.spyOn(Dimensions, 'get').mockReturnValue({
    fontScale, height: 568, scale: 2, width: 320,
  });
  try {
    const arbre = await monter({ initial: { endTime: '19:00', startTime: '17:30', weekday: 2 } });
    await versHeures(arbre);
    await versRecap(arbre);
    const recap = arbre.root.findAllByType(View).find((n) => n.props.testID === 'season-slot-recap');
    expect(StyleSheet.flatten(recap.props.style).height).toBeUndefined();
    expect(recap.findAllByType(Text).every((n) => n.props.numberOfLines === undefined)).toBe(true);
    expect(bouton(arbre, 'Retour')).toBeDefined();
    expect(bouton(arbre, 'Attribuer le créneau')).toBeDefined();
  } finally {
    dimensions.mockRestore();
  }
});

// 📍 COLL-R-A6 (13/10/2026, COL-018, décision prise par la fiche : affichage, réversible) — le
// panneau « Attribuer » du site, ouvert depuis une case vide de la semaine type, dit d'emblée
// « Mercredi · 17:00 – 18:30 » (planche validée P4v2-creneaux-ordi : « déjà rempli du jour et de
// l'heure »). ROUGE avant : on ne le lisait qu'aux étapes 3 et 4 (la ligne n'existait qu'au panneau
// compact du planning, SeasonSlotForm.js:857).
describe('COLL-R-A6 — COL-018 : ouvert depuis une case, le jour et les heures dès l’étape 1', () => {
  const lus = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text)
    .map((/** @type {any} */ n) => [].concat(n.props.children).join(''));
  const DE_LA_CASE = { endTime: '18:30', startTime: '17:00', weekday: 3 };

  // A7-UX-2 : l'étape 1 porte le club ET l'équipe ; l'étape 2 est le jour.
  test('étape 1 (club et équipe) puis étape 2 (le jour) : « Mercredi · 17:00 – 18:30 »', async () => {
    const arbre = await monter({ initial: DE_LA_CASE });
    expect(etape(arbre)).toBe('Étape 1/5');
    expect(lus(arbre)).toContain('Mercredi · 17:00 – 18:30');
    await suivant(arbre);
    expect(lus(arbre)).toContain('Mercredi · 17:00 – 18:30');
  });

  test('ouvert par le bouton (aucune case) : pas de jour ni d’heures à l’étape 1', async () => {
    const arbre = await monter({ initial: {} });
    expect(lus(arbre).some((texte) => /· \d\d:\d\d – \d\d:\d\d$/.test(texte))).toBe(false);
  });
});

// 📐 COLL-R-A7 (13/10/2026, COL-005, décision d'Adel D4 A, planche P4v4-attribuer validée) —
// une étape sans rien à choisir est sautée. ROUGES avant : la fiche d'un club passait par une
// étape « Club » à une seule puce (7 étapes) ; depuis le planning, « Changer l'heure » menait à
// une étape « Horaires » sans champ (le mode compact les cachait).
describe('COLL-R-A7 — COL-005 : les étapes sans choix sont sautées', () => {
  const INSTALLATIONS = [
    { documentId: 'salle-t18', name: 'Salle' },
    { documentId: 'terrain', name: 'Terrain' },
    { documentId: 'dojo', name: 'Dojo' },
  ];

  // R17-QUAND-1 (19/10) : + l'étape « Quand ? » (5 → 6, 4 → 5).
  test('fiche d’un club (3 installations) : 6 étapes, sans « Club » ; l’équipe suit l’installation', async () => {
    const arbre = await monter({ facilities: INSTALLATIONS, fixedClubId: 'basket' });
    expect(etape(arbre)).toBe('Étape 1/6');
    await puce(arbre, 'Salle');
    await suivant(arbre);
    expect(etape(arbre)).toBe('Étape 2/6');
    expect(arbre.root.findAll((n) => n.props.libelle === 'Tout le club')[0].props.actif).toBe(true);
    expect(arbre.root.findAll((n) => n.props.libelle === 'Montrivage Basket')).toHaveLength(0);
  });

  test('fiche d’un club, Ville à une installation : 5 étapes', async () => {
    const arbre = await monter({ facilities: [INSTALLATIONS[0]], fixedClubId: 'basket' });
    expect(etape(arbre)).toBe('Étape 1/5');
  });

  test('planning, complet : « Changer l’heure » rouvre Jour et Horaires, les heures de la case gardées', async () => {
    previewFacilitySeasonSlot.mockResolvedValue({
      data: {
        capacity: 1, needsConfirmation: true, occupants: [], teamsAfter: 2,
      },
    });
    const arbre = await monter({ compact: true, initial: { endTime: '19:30', startTime: '18:00', weekday: 3 } });
    await suivant(arbre); // A7-UX-2 : club et équipe sur une étape
    expect(etape(arbre)).toBe('Étape 2/2');
    await presser(arbre, 'Changer l’heure');
    expect(etape(arbre)).toBe('Étape 3/4');
    expect(champ(arbre, 'Début').props.value).toBe('18:00');
    await presser(arbre, 'Retour');
    expect(jourChoisi(arbre)).toEqual(['jour-3']);
  });
});

jest.mock(
  '@/components/atoms/skeletonLoader/SkeletonLoader',
  () => function SkeletonMock({ children }) { return children; },
);
jest.mock('@/context/AppFeedbackContext', () => ({
  useAppFeedback: () => ({ showBanner: jest.fn() }),
}));
