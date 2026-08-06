import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

import { EventWizardProvider, useEventWizard } from '../EventWizardContext';
import EventWizardLogistics from '../EventWizardLogistics';

// Filet D09 (E6) — comment la RECURRENCE se saisit AUJOURD'HUI, avant d'etre
// repliee dans une feuille du bas. Etat du 2026-08-06.
//
// C'est le filet le plus important des quatre : le lot D09 replie ces champs
// derriere une rangee « Repeter ». Les temoins d'inversion ci-dessous decrivent
// donc l'etat de depart, pour que le deplacement se voie.
//
// ⚠️ Ce que ce fichier NE couvre PAS, et c'est mesure : les taches annexes ne
// vivent pas ici (`rg -ci "task|tache"` rend 0 sur `EventWizardLogistics.js`),
// elles vivent dans `EventTasksEditor.js`. Cet ecran porte la DATE et l'HORAIRE.

/** Proprietes recues par le gabarit d'etape, dans l'ordre du rendu. */
const mockGabarits = [];

jest.mock('react-i18next', () => ({
  initReactI18next: { init: () => {}, type: '3rdParty' },
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => {
      if (typeof repli === 'string') return repli;
      if (repli && typeof repli.defaultValue === 'string') return repli.defaultValue;
      return cle;
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
  return reactActuel.createElement(TexteRN, null, props.label);
});

jest.mock('@/components/molecules/timePickerInput/TimePickerInput', () => function HeureMock(
  /** @type {any} */ props,
) {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN } = jest.requireActual('react-native');
  return reactActuel.createElement(TexteRN, null, props.label);
});

jest.mock('@/components/molecules/dayPicker/DayPicker', () => function JoursMock() {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN } = jest.requireActual('react-native');
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
/** @type {any} */
let elementCourant;

/**
 * Monte l'ecran, apres avoir eventuellement seme un type d'evenement.
 * @param {{ nomDuType?: string }} [options] Type d'evenement a semer.
 * @returns {{ gabarit: any, textes: string[] }} L'ecran monte.
 */
const afficherLEcran = ({ nomDuType } = {}) => {
  mockGabarits.length = 0;
  const navigation = { goBack: () => {}, navigate: () => {}, setParams: () => {} };
  elementCourant = createElement(
    EventWizardProvider,
    null,
    createElement(PriseDeCourant),
    createElement(EventWizardLogistics, { navigation, route: { params: {} } }),
  );

  act(() => { arbre = renderer.create(elementCourant); });
  if (nomDuType) {
    // Le `dispatch` du tunnel suffit a reafficher : `arbre.update` avec le MEME
    // element est ignore par React, et le gabarit ne serait jamais re-releve.
    mockGabarits.length = 0;
    act(() => semer({ payload: { documentId: 't-1', name: nomDuType }, type: 'SET_TYPE' }));
  }

  return { gabarit: mockGabarits[mockGabarits.length - 1], textes: textesSous(arbre.root) };
};

/** Les textes visibles apres un nouveau rendu. */
const textesCourants = () => textesSous(arbre.root);

/**
 * Bascule le premier interrupteur de l'ecran.
 * @param {boolean} valeur Nouvelle position.
 */
const basculerLInterrupteur = (valeur) => {
  const interrupteurs = arbre.root.findAll(
    (/** @type {any} */ noeud) => typeof noeud.props?.onValueChange === 'function',
    { deep: true },
  );
  act(() => interrupteurs[0].props.onValueChange(valeur));
};

afterEach(() => {
  if (arbre) act(() => arbre.unmount());
  arbre = null;
});

describe('D09 — l ecran « Logistique », etat du 2026-08-06', () => {
  test('son entete vient des cles de traduction, et son « Suivant » est ACTIF d entree', () => {
    const { gabarit } = afficherLEcran();

    expect(gabarit.title).toBe('eventWizard.steps.logistics.title');
    expect(gabarit.subtitle).toBe('eventWizard.steps.logistics.subtitle');
    expect(typeof gabarit.onNext).toBe('function');
    // Rien n'est a choisir pour continuer : la date et l'horaire ont un defaut.
    expect(gabarit.isNextDisabled).toBeFalsy();
  });

  test('il affiche la date et les deux horaires', () => {
    const { textes } = afficherLEcran();

    expect(textes).toContain('eventEdit.fields.date.label');
    expect(textes).toContain('eventEdit.fields.startTime.label');
    expect(textes).toContain('eventEdit.fields.endTime.label');
  });

  test('TEMOIN D INVERSION — la recurrence est un INTERRUPTEUR, et elle est eteinte', () => {
    const { textes } = afficherLEcran();

    expect(textes).toContain('eventWizard.steps.logistics.isRecurrent');
    // Aucune rangee-valeur « Repeter » aujourd'hui : c'est ce que D09 apporte.
    expect(textes).not.toContain('Répéter');
    expect(textes).not.toContain('Une seule fois');
    // Et le panneau de recurrence n'est pas la tant que l'interrupteur est eteint.
    expect(textes).not.toContain('eventWizard.steps.logistics.recurrenceTitle');
  });

  test('TEMOIN D INVERSION — allumer l interrupteur deplie les champs DANS la page', () => {
    afficherLEcran();

    basculerLInterrupteur(true);
    const textes = textesCourants();

    expect(textes).toContain('eventWizard.steps.logistics.recurrenceTitle');
    expect(textes).toContain('eventEdit.fields.recurrenceFrequency.options.week');
    expect(textes).toContain('eventEdit.fields.recurrenceFrequency.options.month');
    expect(textes).toContain('eventWizard.steps.logistics.recurrenceInterval');
    expect(textes).toContain('Toutes les semaines');
    expect(textes).toContain('CHOIX-DES-JOURS');
    expect(textes).toContain('eventEdit.fields.recurrenceStartDate.label');
    expect(textes).toContain('eventEdit.fields.recurrenceEndDate.label');
    // Le panneau vit dans la page : il n'y a ni « Appliquer » ni « Ne pas repeter ».
    expect(textes).not.toContain('Appliquer');
    expect(textes).not.toContain('Ne pas répéter');
  });

  test('pour un tournoi, c est le multi-jours qui remplace la recurrence', () => {
    const { textes } = afficherLEcran({ nomDuType: 'Tournoi' });

    expect(textes).toContain('Tournoi sur plusieurs jours');
    expect(textes).not.toContain('eventWizard.steps.logistics.isRecurrent');
  });

  test('pour une reservation, le prix et le mode de reservation s ajoutent', () => {
    const { textes } = afficherLEcran({ nomDuType: 'Réservation' });

    expect(textes).toContain('eventWizard.steps.logistics.reservationTitle');
    expect(textes).toContain('eventEdit.fields.pricePerPerson.label');
    expect(textes).toContain('eventWizard.steps.logistics.reservationMode');
  });
});
