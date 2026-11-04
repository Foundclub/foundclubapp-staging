import { readFileSync } from 'fs';
import { join } from 'path';

import { createElement } from 'react';
import { Text, View } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import BottomModal from '../BottomModal';

// T3-FEUILLES-PIED (M0096, décision d'Adel « Q5 A ») : en hauteur automatique, la bibliothèque ne
// mesure que la zone de contenu. Un pied posé dessous sort de l'écran : Adel ne voyait pas les
// boutons en portrait. Comme l'en-tête (RECETTEWEB retour 5), il entre donc dans la zone mesurée.
// Jest ne mesure aucun pixel : ce témoin lit où le pied est rangé ; le rendu se constate à l'écran.

const INSET_BAS = 34;

jest.mock('react-i18next', () => ({
  initReactI18next: { init: () => {}, type: '3rdParty' },
  useTranslation: () => ({ t: (/** @type {string} */ cle) => cle }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 34, left: 0, right: 0, top: 47,
  }),
}));

jest.mock('@sbaiahmed1/react-native-blur', () => ({ BlurView: () => null }));

jest.mock('@/context/StartupPhaseContext', () => ({
  STARTUP_PHASES: { SCREEN_LOCAL_PROMPTS: 'SCREEN_LOCAL_PROMPTS', STEADY_STATE: 'STEADY_STATE' },
  useStartupPhase: () => ({ phase: 'STEADY_STATE' }),
}));

jest.mock('@gorhom/bottom-sheet', () => {
  const reactActuel = jest.requireActual('react');
  const { View: VueRN } = jest.requireActual('react-native');

  return {
    BottomSheetBackdrop: () => null,
    BottomSheetModal: reactActuel.forwardRef(
      (/** @type {any} */ props, /** @type {any} */ ref) => {
        reactActuel.useImperativeHandle(ref, () => ({ dismiss: () => {}, present: () => {} }));
        return reactActuel.createElement(VueRN, { ...props, testID: 'feuille' }, props.children);
      },
    ),
    BottomSheetScrollView: (/** @type {any} */ props) => reactActuel.createElement(
      VueRN,
      { ...props, testID: 'zone-mesuree' },
      props.children,
    ),
    BottomSheetView: (/** @type {any} */ props) => reactActuel.createElement(
      VueRN,
      { ...props, testID: 'zone-mesuree' },
      props.children,
    ),
    useBottomSheetInternal: () => null,
  };
});

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
      Images: { close: 1 },
      Spaces: espaces,
    }),
  };
});

/** @type {any} */
let arbre;

/**
 * Monte une feuille à pied et rend sa zone mesurée.
 * @param {any} [props] Propriétés de la feuille.
 * @returns {any} La zone que la bibliothèque mesure.
 */
const zoneMesuree = (props = {}) => {
  act(() => {
    arbre = renderer.create(createElement(
      BottomModal,
      {
        close: () => {},
        footerComponent: createElement(Text, null, 'DERNIER-BOUTON'),
        isVisible: true,
        ...props,
      },
      createElement(View),
    ));
  });
  return arbre.root.findAll((/** @type {any} */ n) => n.props?.testID === 'zone-mesuree'
    && typeof n.type === 'string')[0];
};

/**
 * Compte les pieds rendus.
 * @param {any} noeud Là où chercher.
 * @returns {number} Le nombre de fois où le pied y est rendu.
 */
const piedsDans = (noeud) => noeud.findAll((/** @type {any} */ n) => n.type === Text
  && n.props.children === 'DERNIER-BOUTON').length;

afterEach(() => {
  if (arbre) act(() => arbre.unmount());
  arbre = null;
});

describe('le pied d\'une feuille en hauteur automatique', () => {
  test.each([
    ['qui défile', {}],
    ['fixe', { scrollable: false }],
  ])('feuille %s : le pied est dans la zone mesurée, une seule fois', (_nom, props) => {
    expect(piedsDans(zoneMesuree(props))).toBe(1);
    expect(piedsDans(arbre.root)).toBe(1);
  });

  test.each([
    ['qui défile', 'contentContainerStyle', {}],
    ['fixe', 'style', { scrollable: false }],
  ])('feuille %s : il garde sa marge au-dessus de la barre du téléphone', (_nom, prop, props) => {
    const zone = zoneMesuree(props);
    expect(zone.props[prop].paddingBottom).toBe(12 + INSET_BAS);
  });

  test('avec un cran fixe, rien ne change : le pied reste hors de la zone qui défile', () => {
    const zone = zoneMesuree({ snapPoints: ['90%'] });
    expect(piedsDans(zone)).toBe(0);
    expect(piedsDans(arbre.root)).toBe(1);
  });

  test('avec piedHorsMesure, le pied reste dessous, comme avant', () => {
    const zone = zoneMesuree({ piedHorsMesure: true });
    expect(piedsDans(zone)).toBe(0);
    expect(piedsDans(arbre.root)).toBe(1);
    expect(zone.props.contentContainerStyle.paddingBottom).toBe(16);
  });
});

// Décision du chef (« D », 04/11) : à l'émulateur, Android 15+ à 3 boutons, une feuille à champ non
// déclaré passait derrière le clavier avec le pied mesuré. Ces 2 feuilles restent à l'ancienne
// jusqu'au lot clavier ; les 9 autres prennent le correctif. La feuille de match, vue sans souci,
// en fait partie malgré son champ.
describe('qui prend le correctif', () => {
  /**
   * Lit le source d'une feuille.
   * @param {string} chemin Depuis src.
   * @returns {string} Le source.
   */
  const source = (chemin) => readFileSync(join(__dirname, '../../../..', chemin), 'utf8');

  test.each([
    'views/event/components/EventChildRegistration.js',
    'components/organisms/facilityReport/FacilityReportPanel.js',
  ])('%s : à l\'ancienne', (chemin) => {
    expect(source(chemin)).toMatch(/^\s*piedHorsMesure$/m);
  });

  test.each([
    'components/organisms/seasonSlot/SeasonSlotForm.js',
    'views/event/components/CancelSeriesSheet.js',
    'views/event/components/ChildRegistrationCancel.js',
    'views/event/components/TournamentTeamSheet.js',
    'views/home/FeuillePratiqueAussi.js',
    'views/matchStats/MatchStatsEditor.js',
    'views/profile/parent/CommentCaMarche.js',
    'views/profile/parent/FeuilleDAnnulation.js',
    'views/profile/parent/MenuDeLEnfant.js',
  ])('%s : au correctif', (chemin) => {
    expect(source(chemin)).not.toContain('piedHorsMesure');
  });
});
