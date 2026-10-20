import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { blocsDesEvenements } from '@/domains/collectivite/evenementDeLaVille';

import { FACILITY_PLANNING_PALETTE } from '@/utils/facilityPlanningColor';
import { normalizePlanningItems } from '@/utils/planning/planningSlots';

import PlanningCalendarView from '../PlanningCalendarView';

// 🏛️ R17-EVT-1-BIS (b) (20/10/2026, tri du chef) — LA VUE MOIS montre l'événement de la Ville
// (planning d'UNE installation et « Mon planning ») : un repère CLAIR sur son jour (ce n'est pas
// une séance : les pastilles des séances ne le comptent pas) et, le jour choisi, sa carte claire
// (« Ville · toute l'installation », son nom, ses heures) qui s'ouvre comme dans la grille.
// ROUGE avant : aucun repère, et sa carte se disait comme une séance sans titre.

// Le poste peut être chargé (portes d autres sessions) : un délai large.
jest.setTimeout(30000);

jest.mock('@/theme/themeContext', () => {
  const { colors: vraiesCouleurs } = jest.requireActual('@/theme/colors');
  const feuille = {};
  const rampe = () => new Proxy({}, { get: () => feuille });
  return {
    __esModule: true,
    default: () => ({
      Alignments: rampe(),
      ApplicationStyle: new Proxy({}, { get: () => rampe() }),
      Colors: vraiesCouleurs,
      Fonts: rampe(),
      Images: new Proxy({}, {
        get: (/** @type {any} */ _c, /** @type {any} */ k) => `image-${String(k)}`,
      }),
      Spaces: new Proxy({}, { get: () => rampe() }),
    }),
  };
});
jest.mock('react-native-calendars', () => {
  const reactActuel = jest.requireActual('react');
  const { View: VueRN } = jest.requireActual('react-native');
  const jour = (/** @type {string} */ dateString) => ({
    dateString, day: Number(dateString.slice(8)), month: 10, timestamp: 0, year: 2026,
  });
  return {
    Calendar: function CalendarMock(/** @type {any} */ { dayComponent }) {
      return reactActuel.createElement(
        VueRN,
        null,
        ['2026-10-23', '2026-10-24'].map((dateString) => reactActuel.createElement(
          VueRN,
          { key: dateString },
          dayComponent({ date: jour(dateString), state: '' }),
        )),
      );
    },
    LocaleConfig: { defaultLocale: 'fr', locales: {} },
  };
});
// La liste du jour choisi rend ses cartes (c'est elle qu'on lit).
jest.mock('@shopify/flash-list', () => {
  const reactActuel = jest.requireActual('react');
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    FlashList: (/** @type {any} */ { data, renderItem }) => reactActuel.createElement(
      VueRN,
      null,
      (data || []).map((/** @type {any} */ item, index) => reactActuel.createElement(
        VueRN,
        { key: String(index) },
        renderItem({ index, item }),
      )),
    ),
  };
});

const COULEURS = jest.requireActual('@/theme/colors').colors;
const [, , VERT] = FACILITY_PLANNING_PALETTE;
const FETE = {
  collectivite: { documentId: 'ville', name: 'Ville de Montrivage' },
  documentId: 'evt-1',
  endDate: '2026-10-24',
  endTime: '15:30',
  facility: { documentId: 'stade', name: 'Stade municipal' },
  name: 'Fête du sport',
  startDate: '2026-10-24',
  startTime: '14:00',
  takesPlace: true,
};
const SEANCE = {
  displayColor: VERT,
  documentId: 'seance-1',
  endAt: '2026-10-24T17:00:00.000Z',
  hasExplicitTime: true,
  kind: 'slot',
  startAt: '2026-10-24T16:00:00.000Z',
  title: 'AS Montrivage · U13',
};
const evenements = () => [
  ...normalizePlanningItems(blocsDesEvenements([FETE], { from: '2026-10-19', to: '2026-10-25' })),
  ...normalizePlanningItems([SEANCE]).map((/** @type {any} */ e) => ({ ...e, displayColor: VERT })),
];

/** @type {any[]} */
const montes = [];
afterEach(async () => {
  await act(async () => {
    while (montes.length) montes.pop().unmount();
  });
});
const monter = async (/** @type {any} */ onEventPress = jest.fn()) => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <PlanningCalendarView
        compterLesSeances={(/** @type {number} */ n) => (n > 1 ? `${n} séances` : `${n} séance`)}
        currentDate={new Date(2026, 9, 24, 12, 0)}
        events={evenements()}
        onEventPress={onEventPress}
      />,
    );
  });
  montes.push(arbre);
  return arbre;
};
const parID = (/** @type {any} */ arbre, /** @type {string} */ id) => arbre.root
  .findAll((/** @type {any} */ n) => typeof n.type === 'string' && n.props.testID === id);

describe('R17-EVT-1-BIS — la vue Mois et l’événement de la Ville', () => {
  test('🔴 son jour porte un repère CLAIR ; les pastilles ne comptent que les séances', async () => {
    const arbre = await monter();
    const repere = parID(arbre, 'jour-evenement-ville-2026-10-24');
    expect(repere).toHaveLength(1);
    expect(StyleSheet.flatten(repere[0].props.style).backgroundColor).toBe(COULEURS.primary100);
    expect(parID(arbre, 'jour-evenement-ville-2026-10-23')).toHaveLength(0);
    const pastilles = arbre.root.findAll((/** @type {any} */ n) => typeof n.type === 'string'
      && String(n.props.testID || '').startsWith('pastille-2026-10-24-'));
    expect(pastilles.map((/** @type {any} */ p) => p.findAllByType(Text)
      .map((/** @type {any} */ t) => String(t.props.children)).join(''))).toEqual(['1']);
  });

  test('🔴 le jour choisi : sa carte claire, qui s’ouvre', async () => {
    const onEventPress = jest.fn();
    const arbre = await monter(onEventPress);
    const carte = parID(arbre, 'liste-evenement-ville-evt-1');
    expect(carte).toHaveLength(1);
    expect(carte[0].findAllByType(Text).map((/** @type {any} */ t) => String(t.props.children)))
      .toEqual(['Ville · toute l’installation', 'Fête du sport', '14:00 – 15:30']);
    await act(async () => {
      arbre.root.findAllByType(TouchableOpacity)
        .find((/** @type {any} */ n) => n.props.testID === 'liste-evenement-ville-evt-1')
        .props.onPress();
    });
    expect(onEventPress).toHaveBeenCalledWith(expect.objectContaining({
      raw: expect.objectContaining({ evenementDeLaVille: FETE }),
    }));
  });
});
