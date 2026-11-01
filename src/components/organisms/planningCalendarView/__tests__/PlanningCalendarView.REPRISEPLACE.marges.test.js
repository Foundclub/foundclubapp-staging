import { StyleSheet, View } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import PlanningCalendarView from '../PlanningCalendarView';

// REPRISE-PLACE (01/11, point 6, revue Parent « passer le Planning à 24 px des deux côtés ») —
// vue Mois : « Aujourd'hui » et la liste du jour ajoutaient 24 px aux 24 du conteneur d'écran ;
// les cartes d'événement commençaient à 48 px du bord à 390 px. Aucune marge latérale en plus.

jest.mock('@/theme/themeContext', () => {
  const couleurs = jest.requireActual('@/theme/colors').default();
  return {
    __esModule: true,
    default: () => ({
      Alignments: jest.requireActual('@/theme/alignements').default,
      ApplicationStyle: jest.requireActual('@/theme/applicationStyle').default(couleurs),
      Colors: couleurs,
      Fonts: jest.requireActual('@/theme/fonts').default(couleurs),
      Images: new Proxy({}, { get: () => 1 }),
      Spaces: jest.requireActual('@/theme/spaces').default,
    }),
  };
});

jest.mock('react-native-calendars', () => {
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    Calendar: function CalendarMock() {
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

test('REPRISE-PLACE vue Mois : aucune marge latérale ajoutée à celle de l’écran', async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <PlanningCalendarView currentDate={new Date(2026, 10, 4, 12)} events={[]} />,
    );
  });
  const marges = arbre.root.findAllByType(View)
    .map((/** @type {any} */ v) => StyleSheet.flatten(v.props.style) || {})
    .filter((/** @type {any} */ s) => s.paddingHorizontal || s.paddingLeft || s.marginHorizontal);
  expect(marges.filter((/** @type {any} */ s) => s.paddingHorizontal === 24)).toHaveLength(0);
  act(() => arbre.unmount());
});
