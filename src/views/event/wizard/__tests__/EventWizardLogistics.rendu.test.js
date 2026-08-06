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
/** Proprietes recues par la feuille du bas, dans l'ordre du rendu. */
const mockFeuilles = [];

// Le traducteur double INTERPOLE `{{count}}` : sans cela « Toutes les {{count}}
// semaines » ne deviendrait jamais « Toutes les 2 semaines », et le test de la
// cadence serait un faux vert.
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
  mockFeuilles.length = 0;
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
 * Presse le premier pressable dont le texte visible vaut `libelle`.
 * On cherche « ce qui porte un onPress » plutot qu'un type de composant.
 * @param {string} libelle Texte visible du pressable a actionner.
 */
const presserLeTexte = (libelle) => {
  const pressables = arbre.root.findAll(
    (/** @type {any} */ noeud) => typeof noeud.props?.onPress === 'function',
    { deep: true },
  );
  const cible = pressables.find((noeud) => textesSous(noeud).includes(libelle));
  if (!cible) {
    const vus = pressables.map((noeud) => textesSous(noeud).join('|')).filter(Boolean);
    throw new Error(
      `aucun pressable ne porte le texte « ${libelle} ». Pressables vus : ${JSON.stringify(vus)}`,
    );
  }
  cible.props.onPress();
};

// La feuille est-elle ouverte, d'apres son dernier rendu ?
const feuilleOuverte = () => Boolean(mockFeuilles[mockFeuilles.length - 1]?.isVisible);

// Ouvre la feuille en touchant la rangee « Repeter ».
const ouvrirLaFeuille = () => act(() => presserLeTexte('Répéter'));

// Ferme la feuille par le fond, sans rien enregistrer.
const fermerLaFeuille = () => mockFeuilles[mockFeuilles.length - 1].close();

afterEach(() => {
  if (arbre) act(() => arbre.unmount());
  arbre = null;
});

describe('D09 — l ecran « Logistique », etat du 2026-08-06', () => {
  test('son entete est en grammaire « focus », et son « Suivant » est ACTIF d entree', () => {
    const { gabarit } = afficherLEcran();

    // INVERSE PAR D09 — motif : depuis D08 cette etape ne porte plus que la date
    // et l'horaire. « Logistique » nommait un fourre-tout qui n'existe plus.
    // Cles NEUVES avec repli : `fr.js` n'est pas touche.
    expect(gabarit.title).toBe('Date & horaire');
    expect(gabarit.subtitle).toBe("Quand a lieu l'événement ?");
    expect(gabarit.headerVariant).toBe('focus');
    expect(typeof gabarit.onNext).toBe('function');
    // Rien n'est a choisir pour continuer : la date et l'horaire ont un defaut.
    expect(gabarit.isNextDisabled).toBeFalsy();
  });

  test('il affiche la date et les deux horaires, sous leur intertitre', () => {
    const { textes } = afficherLEcran();

    expect(textes).toContain('DATE ET HORAIRE');
    expect(textes).toContain('eventEdit.fields.date.label');
    expect(textes).toContain('eventEdit.fields.startTime.label');
    expect(textes).toContain('eventEdit.fields.endTime.label');
  });

  // INVERSE PAR D09 — motif : le pack replie la recurrence dans une feuille du
  // bas et laisse une RANGEE-VALEUR a chevron. Un interrupteur qui ouvre une
  // fenetre serait incoherent ; la valeur reste lisible sans rien ouvrir.
  test('la recurrence est une rangee « Répéter », dont la valeur par defaut est unique', () => {
    const { textes } = afficherLEcran();

    expect(textes).toContain('Répéter');
    expect(textes).toContain('Une seule fois');
    // L'interrupteur a disparu, et avec lui le panneau qui allongeait la page.
    expect(textes).not.toContain('eventWizard.steps.logistics.isRecurrent');
    expect(textes).not.toContain('eventWizard.steps.logistics.recurrenceInterval');
  });

  // INVERSE PAR D09 — motif : les champs sont les MEMES, ils ont seulement
  // change de contenant. La feuille est doublee (elle tire un module natif).
  test('toucher « Répéter » ouvre la feuille avec les MEMES champs qu avant', () => {
    afficherLEcran();

    ouvrirLaFeuille();
    const textes = textesCourants();

    expect(feuilleOuverte()).toBe(true);
    expect(textes).toContain("Répéter l'événement");
    expect(textes).toContain('eventEdit.fields.recurrenceFrequency.options.week');
    expect(textes).toContain('eventEdit.fields.recurrenceFrequency.options.month');
    expect(textes).toContain('eventWizard.steps.logistics.recurrenceInterval');
    expect(textes).toContain('Toutes les semaines');
    expect(textes).toContain('CHOIX-DES-JOURS');
    expect(textes).toContain('eventEdit.fields.recurrenceStartDate.label');
    expect(textes).toContain('eventEdit.fields.recurrenceEndDate.label');
    expect(textes).toContain('Appliquer');
    expect(textes).toContain('Ne pas répéter');
  });

  // Le cas limite qui vaut le brouillon : sortir sans « Appliquer » ne doit
  // RIEN enregistrer. Sans lui, ouvrir la feuille par curiosite rendrait
  // l evenement recurrent.
  test('fermer la feuille sans « Appliquer » n enregistre RIEN', () => {
    afficherLEcran();

    ouvrirLaFeuille();
    act(() => presserLeTexte('+'));
    act(() => fermerLaFeuille());

    expect(textesCourants()).toContain('Une seule fois');
  });

  test('« Appliquer » enregistre la cadence, et la rangee l affiche', () => {
    afficherLEcran();

    ouvrirLaFeuille();
    act(() => presserLeTexte('+'));
    act(() => presserLeTexte('Appliquer'));

    const textes = textesCourants();
    expect(textes).toContain('Toutes les 2 semaines');
    expect(textes).not.toContain('Une seule fois');
    expect(feuilleOuverte()).toBe(false);
  });

  test('« Ne pas répéter » ramene la rangee a « Une seule fois »', () => {
    afficherLEcran();

    ouvrirLaFeuille();
    act(() => presserLeTexte('Appliquer'));
    expect(textesCourants()).toContain('Toutes les semaines');

    ouvrirLaFeuille();
    act(() => presserLeTexte('Ne pas répéter'));

    expect(textesCourants()).toContain('Une seule fois');
    expect(feuilleOuverte()).toBe(false);
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
