/* eslint-disable max-len -- des phrases entieres, comparees telles quelles */
import { StyleSheet, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { FACILITY_PLANNING_PALETTE } from '@/utils/facilityPlanningColor';
import { normalizePlanningItems } from '@/utils/planning/planningSlots';

import PlanningCalendarView from '../PlanningCalendarView';

// 🖥️ R17-PLANNING-2 (20/10/2026), écran 5 — planche P10-planning-ordi 3 (HY521H1 page 10, validée
// le 19/10) : « Chaque jour : une pastille par installation avec son nombre de séances ». Le
// calendrier du mois (partagé par 5 plannings) ne savait dessiner qu'un POINT par couleur. Une
// option, éteinte par défaut, lui fait écrire le nombre dans la pastille et le dire au lecteur
// d'écran. Les 4 autres plannings ne la passent pas : leurs points ne changent pas (test 2).
// ROUGE avant le lot : aucune pastille, aucun nombre.

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
jest.mock('@shopify/flash-list', () => ({ FlashList: () => null }));

const [BLEU, , VERT, ORANGE, ROUGE, VIOLET] = FACILITY_PLANNING_PALETTE;

const seance = (/** @type {string} */ id, /** @type {string} */ jour, /** @type {string} */ couleur) => ({
  displayColor: couleur,
  documentId: id,
  endAt: `${jour}T17:00:00.000Z`,
  hasExplicitTime: true,
  kind: 'slot',
  startAt: `${jour}T16:00:00.000Z`,
  title: `Séance ${id}`,
});
// Le 7 : 2 séances au gymnase (vert), 1 au stade (orange). Le 9 : 1 au dojo (violet). Le 10 : rien.
const MOIS = [
  seance('a', '2026-10-07', VERT),
  seance('b', '2026-10-07', ORANGE),
  seance('c', '2026-10-07', VERT),
  seance('d', '2026-10-09', VIOLET),
];
const compter = (/** @type {number} */ n) => (n > 1 ? `${n} séances` : `${n} séance`);

/** @type {any[]} */
const montes = [];
afterEach(async () => {
  await act(async () => {
    while (montes.length) montes.pop().unmount();
  });
});
const monter = async (/** @type {any[]} */ seances, /** @type {any} */ compterLesSeances = null) => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <PlanningCalendarView
        compterLesSeances={compterLesSeances}
        currentDate={new Date(2026, 9, 10, 12, 0)}
        // Comme la section (`blocsDuMois`) : la couleur se pose APRÈS la normalisation.
        events={normalizePlanningItems(seances).map((/** @type {any} */ e) => ({
          ...e, displayColor: seances.find((s) => s.documentId === e.documentId)?.displayColor,
        }))}
      />,
    );
  });
  montes.push(arbre);
  return arbre;
};
const pastillesDu = (/** @type {any} */ arbre, /** @type {string} */ jour) => arbre.root
  .findAll((/** @type {any} */ n) => typeof n.type === 'string'
    && String(n.props.testID || '').startsWith(`pastille-${jour}-`));
const texteDe = (/** @type {any} */ noeud) => noeud.findAllByType(Text)
  .map((/** @type {any} */ t) => String(t.props.children)).join('');
const fondDe = (/** @type {any} */ noeud) => StyleSheet.flatten(noeud.props.style).backgroundColor;
const libelles = (/** @type {any} */ arbre) => arbre.root
  .findAll((/** @type {any} */ n) => typeof n.type === 'string' && n.props.accessibilityLabel)
  .map((/** @type {any} */ n) => n.props.accessibilityLabel);

describe('R17-PLANNING-2 écran 5 — une pastille par installation, avec son nombre (P10-planning-ordi 3)', () => {
  test('1 ROUGE-AVANT — le 7 : « 2 » en vert, « 1 » en orange ; le 9 : « 1 » en violet ; le lecteur d écran entend le total', async () => {
    const arbre = await monter(MOIS, compter);
    const du7 = pastillesDu(arbre, '2026-10-07');
    expect(du7.map(fondDe)).toEqual([VERT, ORANGE]);
    expect(du7.map(texteDe)).toEqual(['2', '1']);
    expect(pastillesDu(arbre, '2026-10-09').map(texteDe)).toEqual(['1']);
    expect(pastillesDu(arbre, '2026-10-10')).toHaveLength(0);
    expect(libelles(arbre)).toEqual(expect.arrayContaining(['7, 3 séances', '9, 1 séance']));
  });

  test('2 PROTEGE — sans l option (les 4 autres plannings) : des points, aucun nombre', async () => {
    const arbre = await monter(MOIS);
    expect(pastillesDu(arbre, '2026-10-07')).toHaveLength(0);
    const lus = arbre.root.findAllByType(Text).map((/** @type {any} */ t) => String(t.props.children));
    expect(lus).not.toContain('2');
    expect(libelles(arbre)).not.toContain('7, 3 séances');
  });

  test('3 ROUGE-AVANT — plus de 3 installations un même jour : 3 pastilles, puis « +n » séances', async () => {
    const arbre = await monter([
      ...MOIS,
      seance('e', '2026-10-07', VIOLET),
      seance('f', '2026-10-07', BLEU),
      seance('g', '2026-10-07', BLEU),
      seance('h', '2026-10-07', ROUGE),
    ], compter);
    expect(pastillesDu(arbre, '2026-10-07').map(texteDe)).toEqual(['2', '1', '1']);
    const lus = arbre.root.findAllByType(Text).map((/** @type {any} */ t) => (
      [].concat(t.props.children).join('')));
    expect(lus).toContain('+3');
    expect(libelles(arbre)).toContain('7, 7 séances');
  });
});
