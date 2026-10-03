/* eslint-disable max-len -- des libelles entiers, compares tels quels */
import { StyleSheet, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import PlanningCalendarView from '../PlanningCalendarView';

// 🖥️ COLL-C4B-BIS (03/10/2026), point 4 — planche 25 du plan : LA VUE MOIS MARQUE LES JOURS FERMES.
// Design HY521H1 page 4 (P4v3-fermer : la plage hachuree) et page 5 (P5v2-vues, « Mois » : une
// pastille par club et par jour ; toucher un jour montre sa liste dessous). Un jour ferme toute la
// journee se HACHURE comme dans la grille ; un jour bloque (une plage) se cerne d orange ; la liste
// du jour commence par la fermeture.
// ROUGES avant le lot : le calendrier ignorait les fermetures (`meta.closures`).

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
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {any[]} */ ...args) => jest.requireActual('i18next').t(...args),
  }),
}));

const i18nextTemoin = require('i18next');

const frTemoin = require('@/theme/strings/translations/fr');

(i18nextTemoin.default || i18nextTemoin).init({
  compatibilityJSON: 'v4',
  fallbackLng: 'fr',
  lng: 'fr',
  resources: { fr: { translation: frTemoin.default } },
});

// Le calendrier natif rend ici TROIS jours, par son `dayComponent` (son vrai contrat).
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
        ['2026-10-07', '2026-10-09', '2026-10-10'].map((dateString) => reactActuel.createElement(
          VueRN,
          { key: dateString },
          dayComponent({ date: jour(dateString), state: '' }),
        )),
      );
    },
    LocaleConfig: { defaultLocale: 'fr', locales: {} },
  };
});
jest.mock('@shopify/flash-list', () => {
  const reactActuel = jest.requireActual('react');
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    FlashList: function FlashListMock(/** @type {any} */ { data, ListEmptyComponent, renderItem }) {
      if (!data?.length && ListEmptyComponent) {
        return reactActuel.createElement(VueRN, null, reactActuel.createElement(ListEmptyComponent));
      }
      return reactActuel.createElement(VueRN, null, (data || []).map((/** @type {any} */ item, /** @type {number} */ i) => (
        reactActuel.createElement(VueRN, { key: String(i) }, renderItem({ item }))
      )));
    },
  };
});

const COULEURS = jest.requireActual('@/theme/colors').colors;
const FERMETURE_DU_VENDREDI = {
  documentId: 'f1', endDate: '2026-10-09', endTime: null, kind: 'closure', label: null, reason: 'travaux', startDate: '2026-10-09', startTime: null,
};
const BLOCAGE_DU_SAMEDI = {
  documentId: 'b1', endDate: '2026-10-10', endTime: '13:00', kind: 'block', label: 'Forum des associations', reason: null, startDate: '2026-10-10', startTime: '09:00',
};

/** @type {any[]} */
const arbresMontes = [];
afterEach(async () => {
  await act(async () => {
    arbresMontes.splice(0).forEach((arbre) => arbre.unmount());
  });
});
const monter = async (/** @type {Date} */ jour) => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <PlanningCalendarView
        closures={[FERMETURE_DU_VENDREDI, BLOCAGE_DU_SAMEDI]}
        currentDate={jour}
        events={[]}
      />,
    );
  });
  arbresMontes.push(arbre);
  return arbre;
};
const parTestID = (/** @type {any} */ arbre, /** @type {string} */ id) => arbre.root
  .findAll((/** @type {any} */ n) => typeof n.type === 'string' && n.props.testID === id);
const textes = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text)
  .map((/** @type {any} */ n) => String(n.props.children));

describe('COLL-C4B-BIS point 4 — la vue Mois marque les jours fermes', () => {
  it('1. le vendredi ferme toute la journee est hachure, et le dit au lecteur d ecran', async () => {
    const arbre = await monter(new Date(2026, 9, 7, 12, 0));
    const vendredi = parTestID(arbre, 'jour-ferme-2026-10-09')[0];
    expect(vendredi).toBeDefined();
    expect(vendredi.findAll((/** @type {any} */ n) => n.props.testID === 'hachures' && typeof n.type === 'string')).toHaveLength(1);
    const touche = arbre.root.findAll((/** @type {any} */ n) => (
      typeof n.type === 'string' && String(n.props.accessibilityLabel || '').includes('Fermé · travaux')
    ));
    expect(touche).toHaveLength(1);
    expect(parTestID(arbre, 'jour-ferme-2026-10-07')).toHaveLength(0);
  });

  it('2. le samedi bloque (une plage) se cerne d orange, sans hachures', async () => {
    const arbre = await monter(new Date(2026, 9, 7, 12, 0));
    const samedi = parTestID(arbre, 'jour-bloque-2026-10-10')[0];
    expect(samedi).toBeDefined();
    expect(StyleSheet.flatten(samedi.props.style).borderColor).toBe(COULEURS.warning500);
    expect(samedi.findAll((/** @type {any} */ n) => n.props.testID === 'hachures')).toHaveLength(0);
  });

  it('3. la liste du jour choisi commence par la fermeture', async () => {
    const arbre = await monter(new Date(2026, 9, 9, 12, 0));
    const lus = textes(arbre);
    expect(lus).toContain('Fermé · travaux');
    expect(lus).toContain('Toute la journée');
    const arbreSamedi = await monter(new Date(2026, 9, 10, 12, 0));
    expect(textes(arbreSamedi)).toContain('Bloqué par la Ville · Forum des associations');
    expect(textes(arbreSamedi)).toContain('09:00 – 13:00');
  });
});
