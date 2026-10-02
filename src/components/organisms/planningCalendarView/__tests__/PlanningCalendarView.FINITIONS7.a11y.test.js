import renderer, { act } from 'react-test-renderer';

import PlanningCalendarView from '../PlanningCalendarView';

// FINITIONS7 · POINT 4 (tournee 8, 01/10, « 🟡 lecteur d ecran ») — LE PLANNING EN VUE MOIS.
//
// La tournee a lu, dans l arbre d accessibilite, un bouton sans nom identifie
// « #undefined.header.leftArrow ». C est `react-native-calendars` (1.1313) qui fabrique
// l identifiant de ses fleches avec le `testID` qu on lui donne : aucun => « undefined ».
// ⚠️ La bibliotheque CACHE elle-meme ses fleches au lecteur d ecran
// (`importantForAccessibility='no-hide-descendants'`, calendar/header/index.js:105) et rend
// l en-tete « ajustable » : on change de mois en balayant vers le haut ou le bas. Ce temoin
// prouve donc ce que l ecran lui passe : un `testID` nomme, et rien qui cache l en-tete.

/** @type {any[]} */
const mockPropsDuCalendrier = [];

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
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    Calendar: function CalendarMock(/** @type {any} */ props) {
      mockPropsDuCalendrier.push(props);
      return jest.requireActual('react').createElement(VueRN, null);
    },
    LocaleConfig: { defaultLocale: 'fr', locales: {} },
  };
});

jest.mock('@shopify/flash-list', () => {
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    FlashList: function FlashListMock() {
      return jest.requireActual('react').createElement(VueRN, null);
    },
  };
});

describe('FINITIONS7 · point 4 — le calendrier du planning', () => {
  test('🚨 le calendrier a un testID nomme : plus de « undefined.header.leftArrow »', async () => {
    /** @type {any} */
    let arbre;
    await act(async () => {
      arbre = renderer.create(
        <PlanningCalendarView currentDate={new Date(2026, 9, 1, 12, 0, 0)} events={[]} />,
      );
    });
    const props = mockPropsDuCalendrier[mockPropsDuCalendrier.length - 1];

    expect(props.testID).toBe('planning-calendar');
    expect(`${props.testID}.header.leftArrow`).not.toMatch(/undefined/);
    // Rien ne retire l en-tete ajustable au lecteur d ecran.
    expect(props.accessibilityElementsHidden).not.toBe(true);
    expect(props.importantForAccessibility ?? 'auto').toBe('auto');
    await act(async () => { arbre.unmount(); });
  });
});
