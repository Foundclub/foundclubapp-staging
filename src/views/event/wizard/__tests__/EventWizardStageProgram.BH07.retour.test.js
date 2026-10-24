/* eslint-disable no-unused-vars, max-len -- montage repris tel quel d un temoin voisin (BH07) */
import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

import { EventWizardProvider, useEventWizard } from '../EventWizardContext';
import EventWizardStageProgram from '../EventWizardStageProgram';

// BH07 / P8-06 (24/10) — au retour sur le programme de stage, un jour aux horaires par defaut ne
// doit pas revenir marque « horaires personnalises ». Montage repris de EventWizardLogistics.rendu.test.js.

/** Proprietes recues par le gabarit d'etape, dans l'ordre du rendu. */
const mockGabarits = [];
/** Proprietes recues par la feuille du bas, dans l'ordre du rendu. */
const mockFeuilles = [];
/** Proprietes recues par les champs de date, dans l'ordre du rendu (FINITIONS15). */
const mockDates = [];
/** Proprietes recues par le choix des jours, dans l'ordre du rendu (FINITIONS15). */
const mockJours = [];

// Le traducteur double INTERPOLE `{{count}}` : sans cela « Toutes les {{count}}
// semaines » ne deviendrait jamais « Toutes les 2 semaines », et le test de la
// cadence serait un faux vert.
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: { documentId: 'moi', role: { name: 'Entraineur', type: 'coach' } } }),
}));
jest.mock('@/components/molecules/dateTimeSelector/DateTimeSelector', () => () => null);
jest.mock('@/components/organisms/facilitySelector/FacilitySelector', () => () => null);

jest.mock('react-i18next', () => ({
  initReactI18next: { init: () => {}, type: '3rdParty' },
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli, /** @type {any} */ options) => {
      let modele = cle;
      if (typeof repli === 'string') modele = repli;
      else if (repli && typeof repli.defaultValue === 'string') modele = repli.defaultValue;

      const valeurs = repli && typeof repli === 'object' ? repli : options;
      return String(modele).replace(
        /\{\{(\w+)\}\}/g,
        (/** @type {string} */ tout, /** @type {string} */ nom) => (
          valeurs && valeurs[nom] !== undefined ? String(valeurs[nom]) : tout
        ),
      );
    },
  }),
}));

// Le VRAI theme, sans le contexte React qui le porte. ⛔ Jamais un Proxy.
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

jest.mock('@/components/molecules/wizardStepLayout/WizardStepLayout', () => function GabaritMock(
  /** @type {any} */ props,
) {
  mockGabarits.push(props);
  return props.children;
});

// Les pieces de saisie sont doublees par un texte portant leur libelle : c'est
// ce qui permet d'affirmer « ce champ est affiche » par le TEXTE VISIBLE.
jest.mock('@/components/molecules/datePickerInput/DatePickerInput', () => function DateMock(
  /** @type {any} */ props,
) {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN } = jest.requireActual('react-native');
  mockDates.push(props);
  return reactActuel.createElement(TexteRN, null, props.label);
});

jest.mock('@/components/molecules/timePickerInput/TimePickerInput', () => function HeureMock(
  /** @type {any} */ props,
) {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN } = jest.requireActual('react-native');
  return reactActuel.createElement(TexteRN, null, props.label);
});

jest.mock('@/components/molecules/dayPicker/DayPicker', () => function JoursMock(
  /** @type {any} */ props,
) {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN } = jest.requireActual('react-native');
  mockJours.push(props);
  return reactActuel.createElement(TexteRN, null, 'CHOIX-DES-JOURS');
});

jest.mock('@/components/atoms/button/Button', () => function BoutonMock(/** @type {any} */ props) {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
  return reactActuel.createElement(
    PressableRN,
    { accessibilityRole: 'button', disabled: Boolean(props.disabled), onPress: props.onPress },
    reactActuel.createElement(TexteRN, null, props.title),
  );
});

// La feuille du bas tire `@gorhom/bottom-sheet`, un module natif qu'un test ne
// charge pas. La doublure rend entete, contenu et pied UNIQUEMENT quand la
// feuille est ouverte : c'est exactement ce que le vrai composant fait voir.
jest.mock('@/components/molecules/bottomModal/BottomModal', () => function FeuilleMock(
  /** @type {any} */ props,
) {
  const reactActuel = jest.requireActual('react');
  const { View: VueRN } = jest.requireActual('react-native');
  mockFeuilles.push(props);
  if (!props.isVisible) return null;
  return reactActuel.createElement(
    VueRN,
    null,
    props.headerComponent,
    props.children,
    props.footerComponent,
  );
});

/**
 * Tous les textes rendus sous un noeud de l'arbre de test.
 * @param {any} noeud Noeud de depart.
 * @returns {string[]} Les textes, dans l'ordre du rendu.
 */
const textesSous = (noeud) => {
  /** @type {string[]} */
  const sortie = [];
  const parcourir = (/** @type {any} */ enfant) => {
    if (typeof enfant === 'string' || typeof enfant === 'number') {
      sortie.push(String(enfant));
      return;
    }
    if (Array.isArray(enfant)) {
      enfant.forEach(parcourir);
      return;
    }
    if (enfant?.children) enfant.children.forEach(parcourir);
  };
  parcourir(noeud.children);
  return sortie;
};

/**
 * Les textes d'un MORCEAU de la feuille (entete, contenu, pied), rendu SEUL.
 * C'est ce qui permet d'affirmer « ce bouton est dans le pied FIXE », et pas
 * seulement « ce bouton est quelque part dans la feuille » — la distinction
 * fait tout : seul le pied fixe reste a l'ecran quand le contenu deborde.
 * @param {any} element Un morceau de la feuille.
 * @returns {string[]} Les textes portes par ce morceau.
 */
const textesDuMorceau = (element) => {
  /** @type {any} */
  let sousArbre;
  act(() => { sousArbre = renderer.create(element); });
  const lus = textesSous(sousArbre.root);
  act(() => sousArbre.unmount());
  return lus;
};

/** Le dispatch du tunnel, capte pour semer le type d'evenement. */
let semer = () => {};

/**
 * Composant sans rendu : il capte le `dispatch` du tunnel.
 * @returns {null} Rien.
 */
function PriseDeCourant() {
  const { dispatch } = useEventWizard();
  semer = dispatch;
  return null;
}

/** @type {any} */
let arbre;
test('P8-06 — un jour aux horaires par defaut le reste au retour sur l etape', () => {
  const jour = '2030-05-15T08:00:00.000Z';
  act(() => {
    arbre = renderer.create(createElement(EventWizardProvider, null, createElement(PriseDeCourant)));
  });
  act(() => semer({ payload: { documentId: 't-stage', name: 'Stage' }, type: 'SET_TYPE' }));
  act(() => semer({
    payload: {
      stageEndDate: jour,
      stageSchedule: [{
        date: jour,
        endTime: '2030-05-15T16:00:00.000Z',
        hasCustomTime: false,
        hasLocationOverride: false,
        isActive: true,
        startTime: '2030-05-15T08:00:00.000Z',
      }],
      stageStartDate: jour,
    },
    type: 'SET_META',
  }));
  act(() => {
    arbre.update(createElement(
      EventWizardProvider,
      null,
      createElement(PriseDeCourant),
      createElement(EventWizardStageProgram, {
        navigation: { goBack: () => {}, navigate: () => {}, setParams: () => {} }, route: { params: {} },
      }),
    ));
  });
  expect(textesSous(arbre.root)).not.toContain('Revenir aux horaires par défaut');
  act(() => arbre.unmount());
});
