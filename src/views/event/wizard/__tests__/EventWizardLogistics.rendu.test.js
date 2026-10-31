import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

import { EventWizardProvider, useEventWizard } from '../EventWizardContext';
import EventWizardLogistics, { debutDeRepetitionSuivant } from '../EventWizardLogistics';

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
/** Proprietes recues par les champs de date, dans l'ordre du rendu (FINITIONS15). */
const mockDates = [];
/** Proprietes recues par le choix des jours, dans l'ordre du rendu (FINITIONS15). */
const mockJours = [];

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

// DATESDABORD (25/10, « 6- B ») : l'étape juge l'installation choisie (JugementDuCreneau) ; ici,
// aucune installation n'est choisie, la lecture de place n'est jamais montée.
jest.mock('@/services/facility/facilityQueries', () => ({ useGetFacilityOccupancy: () => ({}) }));
jest.mock('../useMairieDecideALaCreation', () => ({ __esModule: true, default: () => ({}) }));

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

// Ouvre la feuille en touchant la rangee « Plus d'options » (DATESDABORD 26/10 : « Répéter » est
// sur l'ecran ; la feuille garde le reste — toutes les N semaines, chaque mois).
const ouvrirLaFeuille = () => act(() => presserLeTexte('Plus d’options'));

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
  // INVERSE PAR DATESDABORD (26/10/2026, Adel sur la planche : « il faut mieux le mettre en
  // avant ») — motif : « RÉPÉTER » est sur l'ecran (« Une seule fois » / « Chaque semaine », les
  // jours, du … au …) ; la rangee a chevron devient « Plus d'options ». Le defaut reste unique.
  test('la recurrence est sur l ecran, « Une seule fois » par defaut ; « Plus d options »', () => {
    const { textes } = afficherLEcran();

    expect(textes).toContain('RÉPÉTER');
    expect(textes).toContain('Une seule fois');
    expect(textes).toContain('Chaque semaine');
    expect(textes).toContain('Plus d’options');
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

  // 🧨 D19 — LE FILET QUI MANQUAIT. A la recette du 07/08, cette feuille « ne
  // defile pas jusqu'en bas » et « ses boutons sont inatteignables ». Les tests
  // ci-dessus la trouvaient pourtant complete : ils lisent le CONTENU, jamais
  // la place que ce contenu recevra a l'ecran.
  //
  // La cause est une soustraction. `BottomModal` a deux mises en page, et c'est
  // `snapPoints` qui choisit. Sans lui, la seule zone defilante est plafonnee a
  // 70 % de la hauteur d'ECRAN dans un conteneur SANS flex : entete et pied
  // s'empilent PAR-DESSUS. Sur un iPhone 14 : 64 + 0,7 x 844 + 162 = 816,8 pt
  // pour une feuille qui ne peut pas depasser 844 - (47 + 20) = 777 pt. Le pied
  // — hors zone defilante — sort donc par le bas, et rien ne l'y ramene.
  //
  // ⚠️ Jest ne mesure aucun pixel. Ce test epingle la CONTRAINTE qui decide de
  // la mise en page, pas le rendu. C'est exactement ce qui manquait : la
  // contrainte etait absente, et aucun test ne le disait.
  test('la feuille « Répéter » declare une hauteur BORNEE, et son contenu defile', () => {
    afficherLEcran();

    ouvrirLaFeuille();
    const feuille = mockFeuilles[mockFeuilles.length - 1];

    expect(Array.isArray(feuille.snapPoints)).toBe(true);
    expect(feuille.snapPoints.length).toBeGreaterThan(0);
    // `scrollable` vaut `true` par defaut : ce qu'on interdit, c'est de le
    // couper — une feuille bornee dont le contenu ne defile pas serait pire.
    expect(feuille.scrollable).not.toBe(false);
  });

  // Le second morceau de l'invariant : une hauteur bornee ne sert a rien si les
  // boutons partent dans le contenu defilant. Ils doivent vivre dans le PIED,
  // le seul endroit que `BottomModal` garde a l'ecran.
  test('ses deux actions vivent dans le pied FIXE, jamais dans le contenu defilant', () => {
    afficherLEcran();

    ouvrirLaFeuille();
    const feuille = mockFeuilles[mockFeuilles.length - 1];

    expect(textesDuMorceau(feuille.footerComponent)).toEqual(['Appliquer', 'Ne pas répéter']);
    expect(textesDuMorceau(feuille.children)).not.toContain('Appliquer');
    expect(textesDuMorceau(feuille.children)).not.toContain('Ne pas répéter');
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
    // DATESDABORD (26/10) : « Une seule fois » reste un choix à l'écran ; il n'est plus coché.
    expect(arbre.root.findByProps({ testID: 'date-et-horaire-une-fois' }).props.accessibilityState)
      .toEqual({ checked: false });
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

// 🎨 FINITIONS13-COLL (04/10) — point 8 : le début de la répétition SUIT le jour de la séance tant
// qu'on ne l'a pas choisi (tournée T13, C2_2a : « samedi 3 octobre », le jour de la saisie, pour
// une séance le jeudi 8 ; déplacée au 22, la série aurait gardé les 8 et 15). ROUGE avant le lot.
describe('FINITIONS13-COLL point 8 — le début de la répétition suit la séance', () => {
  const SAMEDI_3 = new Date(2026, 9, 3, 10, 0);
  const JEUDI_8 = new Date(2026, 9, 8, 0, 0);
  const JEUDI_22 = new Date(2026, 9, 22, 0, 0);

  test('resté au jour d avant, ou plus tôt que la séance : il suit', () => {
    expect(debutDeRepetitionSuivant(SAMEDI_3, SAMEDI_3, JEUDI_8)).toEqual(JEUDI_8);
    expect(debutDeRepetitionSuivant(JEUDI_8, SAMEDI_3, JEUDI_22)).toEqual(JEUDI_22);
    expect(debutDeRepetitionSuivant(null, SAMEDI_3, JEUDI_8)).toEqual(JEUDI_8);
  });

  test('choisi plus tard que la séance : il reste', () => {
    const NOVEMBRE = new Date(2026, 10, 5);
    expect(debutDeRepetitionSuivant(NOVEMBRE, SAMEDI_3, JEUDI_8)).toBe(NOVEMBRE);
  });
});

// 🐞 FINITIONS15 point 1 (tournée T14, C08 et C08b, planche 43) — L'ANCIEN JOUR NE RESTE PAS
// COCHÉ. Karim pose une séance le lundi 5 oct., ouvre « Répéter » (lundi présélectionné), puis
// déplace la séance au jeudi 8 : le jeudi s'ajoutait À CÔTÉ du lundi, et la série aurait aussi
// pris tous les lundis — des séances en trop qu'on ne voit qu'en relisant la feuille.
//
// LA RÈGLE RETENUE : quand la répétition ne porte QUE le jour de l'ancienne date (le jour
// présélectionné, que l'utilisateur n'a pas complété), le jour de la nouvelle date le REMPLACE.
// Quand l'utilisateur a choisi lui-même plusieurs jours, son choix reste, et le jour de la
// nouvelle date s'y ajoute (la séance elle-même fait partie de la série) — comme avant.
// ROUGE avant le lot.
describe('FINITIONS15 point 1 — la date de la séance déplace le jour de la répétition', () => {
  /**
   * Le dernier rendu du champ « Date » de la séance (pas ceux de la feuille).
   * @returns {any} Ses propriétés.
   */
  const champDeLaDate = () => [...mockDates]
    .reverse()
    .find((props) => props.label === 'eventEdit.fields.date.label');

  /**
   * Les jours cochés au dernier rendu de la feuille.
   * @returns {number[]} Les jours (0 = dimanche).
   */
  const joursCoches = () => mockJours[mockJours.length - 1].selectedDays.map(Number);

  /**
   * Déplace la séance de `decalage` jours, par le champ « Date » comme le fait le doigt.
   * @param {number} decalage Le nombre de jours.
   * @returns {Date} La nouvelle date.
   */
  const deplacerLaSeance = (decalage) => {
    const [jour, mois, annee] = champDeLaDate().value.split('/').map(Number);
    const nouvelle = new Date(annee, mois - 1, jour + decalage);
    const texte = [
      String(nouvelle.getDate()).padStart(2, '0'),
      String(nouvelle.getMonth() + 1).padStart(2, '0'),
      nouvelle.getFullYear(),
    ].join('/');
    act(() => champDeLaDate().onChange(texte));
    return nouvelle;
  };

  /**
   * Le jour de la semaine de la séance, d'après son champ « Date ».
   * @returns {number} Le jour (0 = dimanche).
   */
  const jourDeLaSeance = () => {
    const [jour, mois, annee] = champDeLaDate().value.split('/').map(Number);
    return new Date(annee, mois - 1, jour).getDay();
  };

  test('répétition allumée sur le seul jour présélectionné : le nouveau jour le remplace', () => {
    afficherLEcran();
    ouvrirLaFeuille();
    expect(joursCoches()).toEqual([jourDeLaSeance()]);
    act(() => presserLeTexte('Appliquer'));

    const nouvelle = deplacerLaSeance(3);

    ouvrirLaFeuille();
    expect(joursCoches()).toEqual([nouvelle.getDay()]);
  });

  test('répétition éteinte puis rallumée : le jour suit aussi la date', () => {
    afficherLEcran();
    ouvrirLaFeuille();
    act(() => presserLeTexte('Appliquer'));
    ouvrirLaFeuille();
    act(() => presserLeTexte('Ne pas répéter'));

    const nouvelle = deplacerLaSeance(3);

    ouvrirLaFeuille();
    expect(joursCoches()).toEqual([nouvelle.getDay()]);
  });

  test('plusieurs jours choisis : son choix reste, le nouveau jour s ajoute', () => {
    afficherLEcran();
    ouvrirLaFeuille();
    const base = jourDeLaSeance();
    const autre = (base + 2) % 7;
    act(() => mockJours[mockJours.length - 1].onChange([base, autre]));
    act(() => presserLeTexte('Appliquer'));

    const nouvelle = deplacerLaSeance(1);

    ouvrirLaFeuille();
    expect([...joursCoches()].sort()).toEqual([base, autre, nouvelle.getDay()].sort());
  });
});

// CORR-EVENEMENTS point 127 (recette du site, 30/10) — une date passée : « Suivant » ne faisait
// rien, sans dire pourquoi (l'alerte du navigateur ne se voyait pas). Décision A : un message
// sous le champ, « Cette date est passée ».
describe('CORR-EVENEMENTS 127 — une date passée se dit sous le champ', () => {
  // eslint-disable-next-line global-require
  const { toDateInputText } = require('@/components/organisms/dateEtHoraire/DateEtHoraire');

  test('🐞 choisir hier affiche le message sous la date', () => {
    afficherLEcran();
    expect(textesCourants()).not.toContain('Cette date est passée : choisis un jour à venir.');
    const hier = new Date(Date.now() - (24 * 60 * 60 * 1000));

    act(() => { mockDates[mockDates.length - 1].onChange(toDateInputText(hier)); });

    expect(textesCourants()).toContain('Cette date est passée : choisis un jour à venir.');
  });
});
