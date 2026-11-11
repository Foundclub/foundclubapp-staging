/* eslint-disable max-len -- intitulés de témoins et données d'exemple, lus en entier. */
import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

import FriendlyMatchWizardFormat from '../FriendlyMatchWizardFormat';

// AMICAUX-FORMAT (10/11/2026, maquette validée par Adel) — l'écran de l'étape 2/8.
// Témoins : un sport à formats connus (football, basket), le personnalisé, un
// sport hors catalogue qui n'offre que « Personnalisé ».

/** @type {any[]} */
const mockPropsDuGabarit = [];
const mockEnvoyer = jest.fn();

jest.mock('i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').i18next
));
jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));

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
      Images: { check: 'icone-coche' },
      Spaces: espaces,
    }),
  };
});

jest.mock('@/components/molecules/wizardStepLayout/WizardStepLayout', () => function GabaritMock(
  /** @type {any} */ props,
) {
  mockPropsDuGabarit.push(props);
  return props.children;
});

// Le segment tire react-native-gesture-handler (ESM) : on garde ses libellés lisibles.
jest.mock('@/components/molecules/segmentedControl/SegmentedControl', () => function SegmentMock(
  /** @type {any} */ props,
) {
  const reactActuel = jest.requireActual('react');
  const { Text } = jest.requireActual('react-native');
  return reactActuel.createElement(Text, null, props.options.map((/** @type {any} */ o) => o.label).join(' | '));
});
jest.mock('@/components/molecules/inputStepper/InputStepper', () => function CompteurMock(
  /** @type {any} */ props,
) {
  const reactActuel = jest.requireActual('react');
  const { Text } = jest.requireActual('react-native');
  return reactActuel.createElement(Text, null, props.label);
});

/** @type {any} */
const mockEtat = {};
jest.mock('../FriendlyMatchWizardContext', () => ({
  __esModule: true,
  useFriendlyMatchWizard: () => ({
    dispatch: (/** @type {any} */ action) => mockEnvoyer(action),
    state: mockEtat,
  }),
}));

/**
 * Monte l'écran sur un brouillon donné.
 * @param {any} brouillon
 * @returns {{ arbre: any, navigation: any }}
 */
const rendre = (brouillon) => {
  Object.keys(mockEtat).forEach((cle) => delete mockEtat[cle]);
  Object.assign(mockEtat, { team: { name: 'Seniors A' }, ...brouillon });
  mockEnvoyer.mockClear();
  const navigation = { goBack: jest.fn(), navigate: jest.fn() };
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(createElement(FriendlyMatchWizardFormat, { navigation }));
  });
  return { arbre, navigation };
};

/**
 * Les textes affichés, espaces insécables ramenés à des espaces.
 * @param {any} arbre
 * @returns {string[]}
 */
const textes = (arbre) => {
  /** @type {string[]} */
  const sortie = [];
  const parcourir = (/** @type {any} */ noeud) => {
    if (noeud === null || noeud === undefined || typeof noeud === 'boolean') return;
    if (typeof noeud === 'string' || typeof noeud === 'number') {
      sortie.push(String(noeud));
      return;
    }
    if (Array.isArray(noeud)) {
      noeud.forEach(parcourir);
      return;
    }
    parcourir(noeud.children);
  };
  parcourir(arbre.toJSON());
  // Les pastilles écrivent leurs libellés avec des espaces insécables (AMIC72) : on lit le texte.
  return sortie.map((texte) => texte.replace(/[\u00a0\u202f]/g, ' '));
};

const dernierGabarit = () => mockPropsDuGabarit[mockPropsDuGabarit.length - 1];

describe('AMICAUX-FORMAT — l’écran « Quel format ? »', () => {
  it('est la 2e étape sur 8, bloquée tant qu’aucun format n’est choisi, puis mène à « Tu peux recevoir ? »', () => {
    const { navigation } = rendre({ activity: { name: 'Football' }, format: '' });
    expect(dernierGabarit().stepIndex).toBe(2);
    expect(dernierGabarit().stepCount).toBe(8);
    expect(dernierGabarit().title).toBe('Quel format ?');
    expect(dernierGabarit().isNextDisabled).toBe(true);
    dernierGabarit().onNext();
    expect(navigation.navigate).toHaveBeenCalledWith('FriendlyMatchWizardHosting');
  });

  it('football : les 5 formats, leur durée habituelle, puis « Personnalisé » en dernier', () => {
    const { arbre } = rendre({ activity: { name: 'Football' }, format: '' });
    const affiches = textes(arbre);
    expect(affiches).toEqual(expect.arrayContaining([
      '11 contre 11', '2 × 45 min', '8 contre 8', '7 contre 7', '5 contre 5', 'Futsal', 'Personnalisé',
    ]));
    expect(affiches.indexOf('Personnalisé')).toBeGreaterThan(affiches.indexOf('Futsal'));
  });

  it('toucher « 11 contre 11 » pose le format ET sa durée habituelle', () => {
    const { arbre } = rendre({ activity: { name: 'Football' }, format: '' });
    act(() => { arbre.root.findByProps({ testID: 'friendlyFormat.option.11v11' }).props.onPress(); });
    expect(mockEnvoyer).toHaveBeenCalledWith({
      payload: { code: '11v11', duration: { minutes: 45, periods: 2 } },
      type: 'SET_FORMAT',
    });
  });

  it('format choisi : les durées courantes en pastilles, la 1re marquée « habituel », et la ligne « Sur l’annonce »', () => {
    const { arbre } = rendre({
      activity: { name: 'Football' }, format: '11v11', formatDuration: { minutes: 45, periods: 2 },
    });
    const affiches = textes(arbre);
    expect(affiches).toEqual(expect.arrayContaining([
      '2 × 45 min (habituel)', '2 × 40 min', 'Autre durée', 'Sur l’annonce : 11 contre 11 · 2 × 45 min',
    ]));
    expect(dernierGabarit().isNextDisabled).toBe(false);
  });

  it('le basket propose 5 contre 5 et 3x3, pas les formats du football', () => {
    const affiches = textes(rendre({ activity: { name: 'Basketball' }, format: '' }).arbre);
    expect(affiches).toEqual(expect.arrayContaining(['5 contre 5', '4 × 10 min', '3x3']));
    expect(affiches).not.toContain('11 contre 11');
  });

  it('personnalisé : les compteurs Nous / Eux, la durée et la précision', () => {
    const { arbre } = rendre({
      activity: { name: 'Football' },
      format: 'custom',
      formatCustom: { them: 11, themTouched: true, us: 10 },
      formatDuration: { minutes: 35, periods: 2 },
    });
    const affiches = textes(arbre);
    expect(affiches).toEqual(expect.arrayContaining([
      'Joueurs sur le terrain', 'Nous', 'Eux', 'Durée', 'Une précision ? (facultatif)',
      'Sur l’annonce : 10 contre 11 · 2 × 35 min',
    ]));
  });

  it('un sport hors catalogue n’offre que « Personnalisé », et ne bloque rien', () => {
    const affiches = textes(rendre({ activity: { name: 'Tennis de table' }, format: '' }).arbre);
    expect(affiches).toContain('Personnalisé');
    expect(affiches).not.toContain('11 contre 11');
    expect(dernierGabarit().subtitle)
      .toBe('Décris ton format : combien vous serez sur le terrain, et combien de temps.');
  });
});
