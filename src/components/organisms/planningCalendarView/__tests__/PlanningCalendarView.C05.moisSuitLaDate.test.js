import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import PlanningCalendarView from '../PlanningCalendarView';

// C05 (BUGHUNT P2, Q2-18, 25/10/2026) — VUE MOIS : LA GRILLE SUIT LA DATE CHOISIE. Deux fleches
// jusqu a decembre, puis « Aujourd hui » ⇒ la liste revenait au 25/10, la grille restait en
// decembre.
// `react-native-calendars` (1.1313) n est pas transforme par la config jest du projet : la doublure
// recopie son calendar/index.js l. 24-49 (`current` lu au montage seulement, `initialDate` suivi,
// `onMonthChange` a chaque mois). Preuve avec la vraie bibliotheque : journal du lot C05.
// MOISGRILLE (26/10/2026) — le SITE remplace la bibliotheque par
// web/src/shims/react-native-calendars.tsx, qui ne suit QUE `current` (l. 110-115) : avec
// `initialDate` seul, le planning omnisport ou club ouvert sur novembre (R17-VUE) gardait la
// grille d octobre. La doublure « site » le recopie.
/** @type {'telephone' | 'site'} */
let mockDoublure = 'telephone';

jest.mock('@/utils/planning/planningSlots', () => ({
  ...jest.requireActual('@/utils/planning/planningSlots'),
  getPlanningDefaultDate: () => new Date(2026, 9, 25, 12, 0, 0),
}));
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
  const vraiReact = jest.requireActual('react');
  const {
    Text: TexteRN, TouchableOpacity: AppuiRN, View: VueRN,
  } = jest.requireActual('react-native');
  const { addMonths, format, parseISO } = jest.requireActual('date-fns');
  const { fr: francais } = jest.requireActual('date-fns/locale');
  return {
    Calendar: function CalendrierDouble(/** @type {any} */ props) {
      const {
        current, initialDate, onMonthChange, testID,
      } = props;
      const site = mockDoublure === 'site';
      const [mois, setMois] = vraiReact.useState(() => (site && !current
        ? new Date(2026, 9, 25)
        : parseISO(current || initialDate)));
      vraiReact.useEffect(() => {
        if (!site && initialDate) setMois(parseISO(initialDate));
      }, [initialDate, site]);
      vraiReact.useEffect(() => {
        if (site && current) setMois(parseISO(current));
      }, [current, site]);
      vraiReact.useEffect(() => {
        if (!site) onMonthChange?.({ dateString: format(mois, 'yyyy-MM-dd') });
      }, [mois]);
      return vraiReact.createElement(
        VueRN,
        null,
        vraiReact.createElement(
          TexteRN,
          { testID: `${testID}.header.title` },
          format(mois, 'MMMM yyyy', { locale: francais }),
        ),
        vraiReact.createElement(AppuiRN, {
          onPress: () => setMois((/** @type {Date} */ m) => addMonths(m, 1)),
          testID: `${testID}.header.rightArrow`,
        }),
      );
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

describe('Q2-18 — la grille du mois suit « Aujourd hui »', () => {
  test('decembre a la fleche, puis « Aujourd hui » : la grille revient en octobre', async () => {
    /** @type {any} */
    let arbre;
    await act(async () => {
      arbre = renderer.create(<PlanningCalendarView events={[]} />);
    });
    const titre = () => arbre.root
      .findAll((/** @type {any} */ n) => (
        n.props.testID === 'planning-calendar.header.title' && typeof n.type === 'string'
      ))[0]
      .props.children;
    const flecheDroite = () => arbre.root
      .findAll((/** @type {any} */ n) => (
        n.props.testID === 'planning-calendar.header.rightArrow' && n.props.onPress
      ))[0];
    expect(String(titre())).toMatch(/octobre 2026/i);
    await act(async () => { flecheDroite().props.onPress(); });
    await act(async () => { flecheDroite().props.onPress(); });
    expect(String(titre())).toMatch(/décembre 2026/i);
    const aujourdHui = arbre.root.findAllByType(TouchableOpacity)
      .find((/** @type {any} */ n) => n.findAllByType(Text)
        .some((/** @type {any} */ e) => e.props.children === "Aujourd'hui"));
    await act(async () => { aujourdHui.props.onPress(); });
    expect(String(titre())).toMatch(/octobre 2026/i);
    await act(async () => { arbre.unmount(); });
  }, 60000);

  test('site : le planning s ouvre sur novembre (R17-VUE), la grille aussi', async () => {
    mockDoublure = 'site';
    /** @type {any} */
    let arbre;
    await act(async () => {
      arbre = renderer.create(
        <PlanningCalendarView
          currentDate={new Date(2026, 9, 21)}
          events={[]}
          onDateSelect={() => {}}
        />,
      );
    });
    await act(async () => {
      arbre.update(
        <PlanningCalendarView
          currentDate={new Date(2026, 10, 12)}
          events={[]}
          onDateSelect={() => {}}
        />,
      );
    });
    const titre = arbre.root
      .findAll((/** @type {any} */ n) => (
        n.props.testID === 'planning-calendar.header.title' && typeof n.type === 'string'
      ))[0]
      .props.children;
    expect(String(titre)).toMatch(/novembre 2026/i);
    await act(async () => { arbre.unmount(); });
    mockDoublure = 'telephone';
  }, 60000);
});
