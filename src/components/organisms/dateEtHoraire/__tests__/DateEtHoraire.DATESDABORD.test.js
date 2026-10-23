import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

import DateEtHoraire from '../DateEtHoraire';

// 🗓️ DATESDABORD (23/10/2026, point 9 d'Adel) — LE BLOC « DATE ET HORAIRE » PARTAGÉ : ce qu'il
// rend et ce qu'il renvoie. Sorti tel quel de l'étape « Date & horaire » de la création
// d'événement (ses témoins : EventWizardLogistics.rendu, AA10, eventWizardEtapes5a8) pour
// qu'« Attribuer un créneau » de la Ville ait le même modèle.

/** @type {any[]} */
const mockDates = [];
/** @type {any[]} */
const mockHeures = [];
/** @type {any[]} */
const mockFeuilles = [];

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => (typeof repli === 'string' ? repli : cle),
  }),
}));
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
      Images: { chevronDown: 1 },
      Spaces: espaces,
    }),
  };
});
jest.mock('@/components/molecules/datePickerInput/DatePickerInput', () => function DateMock(
  /** @type {any} */ props,
) {
  mockDates.push(props);
  return null;
});
jest.mock('@/components/molecules/timePickerInput/TimePickerInput', () => function HeureMock(
  /** @type {any} */ props,
) {
  mockHeures.push(props);
  return null;
});
jest.mock('@/components/molecules/dayPicker/DayPicker', () => function JoursMock() {
  return null;
});
jest.mock('@/components/molecules/bottomModal/BottomModal', () => function FeuilleMock(
  /** @type {any} */ props,
) {
  mockFeuilles.push(props);
  const { createElement: creer, Fragment } = jest.requireActual('react');
  return props.isVisible ? creer(Fragment, null, props.children, props.footerComponent) : null;
});
jest.mock('@/components/atoms/button/Button', () => {
  const { createElement: creer } = jest.requireActual('react');
  const { TouchableOpacity } = jest.requireActual('react-native');
  return function BoutonMock(/** @type {any} */ props) {
    return creer(TouchableOpacity, { onPress: props.onPress, testID: `bouton-${props.title}` });
  };
});

// Un mardi, 17:30 – 19:00.
const MARDI = new Date(2026, 10, 3, 0, 0, 0, 0);
const DEBUT = new Date(2026, 10, 3, 17, 30, 0, 0);
const FIN = new Date(2026, 10, 3, 19, 0, 0, 0);

/**
 * Tous les textes rendus.
 * @returns {string} Les textes, joints.
 */
const textesRendus = () => arbre.root.findAll((/** @type {any} */ n) => typeof n.type === 'string'
  || n.type?.displayName === 'Text').flatMap((/** @type {any} */ n) => n.children)
  .filter((/** @type {any} */ c) => typeof c === 'string').join(' | ');

/** @type {any} */
let arbre;
const monter = (/** @type {any} */ props = {}) => {
  mockDates.length = 0;
  mockHeures.length = 0;
  mockFeuilles.length = 0;
  const appels = { date: [], debut: [], fin: [], repetition: [] };
  act(() => {
    arbre = renderer.create(createElement(DateEtHoraire, {
      date: MARDI,
      debut: DEBUT,
      fin: FIN,
      onDate: (/** @type {any} */ v) => appels.date.push(v),
      onDebut: (/** @type {any} */ v) => appels.debut.push(v),
      onFin: (/** @type {any} */ v) => appels.fin.push(v),
      onRepetition: (/** @type {any} */ v) => appels.repetition.push(v),
      repetition: {
        actif: false, au: null, du: null, frequence: 'week', intervalleTexte: '1', jours: [],
      },
      ...props,
    }));
  });
  return appels;
};

afterEach(() => {
  if (arbre) act(() => arbre.unmount());
  arbre = null;
});

describe('DATESDABORD — le bloc « Date et horaire » partagé', () => {
  test('il montre la date et les deux heures, et « Une seule fois » par défaut', () => {
    monter();
    expect(mockDates[0].value).toBe('03/11/2026');
    expect(mockHeures.map((p) => p.value)).toEqual(['17:30', '19:00']);
    const textes = textesRendus();
    expect(textes).toContain('Répéter');
    expect(textes).toContain('Une seule fois');
  });

  test('il renvoie des dates : la date choisie, les heures posées sur leur jour', () => {
    const appels = monter();
    act(() => mockDates[mockDates.length - 1].onChange('10/11/2026'));
    act(() => mockHeures[mockHeures.length - 2].onChange('18:00'));
    expect(appels.date[0].toDateString()).toBe(new Date(2026, 10, 10).toDateString());
    expect([appels.debut[0].getHours(), appels.debut[0].getMinutes()]).toEqual([18, 0]);
  });

  test('« Répéter » ouvre la feuille sur un brouillon (le jour de la date), « Appliquer » le renvoie', () => {
    const appels = monter();
    act(() => arbre.root.findByProps({ testID: 'date-et-horaire-repeter' }).props.onPress());
    expect(mockFeuilles[mockFeuilles.length - 1].isVisible).toBe(true);
    act(() => arbre.root.findByProps({ testID: 'bouton-Appliquer' }).props.onPress());
    expect(appels.repetition).toHaveLength(1);
    expect(appels.repetition[0]).toMatchObject({
      frequence: 'week', intervalleTexte: '1', jours: [MARDI.getDay()],
    });
    expect(appels.repetition[0].du.toDateString()).toBe(MARDI.toDateString());
    // Par défaut, une période d'une cadence après le début.
    expect(appels.repetition[0].au.toDateString()).toBe(new Date(2026, 10, 10).toDateString());
  });

  test('« Ne pas répéter » renvoie null', () => {
    const appels = monter({
      repetition: {
        actif: true, au: null, du: null, frequence: 'month', intervalleTexte: '2', jours: [],
      },
    });
    expect(textesRendus()).toContain('Tous les {{count}} mois');
    act(() => arbre.root.findByProps({ testID: 'date-et-horaire-repeter' }).props.onPress());
    const neRienRepeter = arbre.root.findAll((/** @type {any} */ n) => (
      n.props?.accessibilityRole === 'button' && typeof n.props.onPress === 'function'
      && n.findAll((/** @type {any} */ e) => e.children?.includes?.('Ne pas répéter')).length > 0
    )).pop();
    act(() => neRienRepeter.props.onPress());
    expect(appels.repetition).toEqual([null]);
  });

  test('sans répétition (un tournoi) : pas de rangée « Répéter » ; les réglages d heure passent', () => {
    monter({ finApres: '17:30', pleines: [{ end: 1200, start: 1080 }], sansRepetition: true });
    expect(arbre.root.findAllByProps({ testID: 'date-et-horaire-repeter' })).toHaveLength(0);
    expect(mockHeures[mockHeures.length - 2].pleines).toEqual([{ end: 1200, start: 1080 }]);
    expect(mockHeures[mockHeures.length - 1].apres).toBe('17:30');
  });
});
