import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

import { RouteNames } from '@/navigation/routeNames';

import { EventWizardProvider } from '../EventWizardContext';
import EventWizardType from '../EventWizardType';

// Filet D09 (E6) — ce que l'ecran « Type d'evenement » AFFICHE, avant sa
// refonte de presentation.
//
// L'ecran n'avait aucun test de rendu : le filet D08 le traverse, mais il ne
// decrit que la MACHINE (quel ecran mene ou), jamais le contenu. Ce fichier
// decrit le CONTENU, tel qu'il est le 2026-08-06.
//
// Pilote par le TEXTE VISIBLE, jamais par la forme de l'arbre : la cible
// survit ainsi au changement de pressable que ce lot apporte.
//
// ⚠️ Trois attentes de ce fichier sont ecrites pour ROUGIR au lot D09, et
// c'est leur but — elles sont marquees « TEMOIN D'INVERSION » :
//   1. une rangee de type ne porte AUCUNE description ;
//   2. « Reservation » est pressable et navigue ;
//   3. aucune rangee « Match amical ».

/** Proprietes recues par le gabarit d'etape, dans l'ordre du rendu. */
const mockGabarits = [];
/** Les types d'evenement servis a la place de l'appel reseau. */
const mockReseau = {
  error: null,
  isLoading: false,
  types: [
    { documentId: 't-detection', name: "Détection / Séance d'essai" },
    { documentId: 't-entrainement', name: 'Entraînement' },
    { documentId: 't-stage', name: 'Stage' },
    { documentId: 't-tournoi', name: 'Tournoi' },
    { documentId: 't-match', name: 'Match' },
    { documentId: 't-autre', name: 'Autre' },
    { documentId: 't-reservation', name: 'Réservation' },
  ],
};

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

// Le VRAI theme, sans le contexte React qui le porte. ⛔ Jamais un Proxy : les
// echecs Jest deviennent illisibles (« Cannot convert object to primitive
// value » au lieu de l'arbre rendu).
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

// Le gabarit d'etape est mocke pour DEUX raisons : relever ses proprietes
// (titre, sous-titre, « Suivant ») et eviter de monter le conteneur d'ecran,
// qui tire zone sure, image de fond et evitement de clavier.
jest.mock('@/components/molecules/wizardStepLayout/WizardStepLayout', () => function GabaritMock(
  /** @type {any} */ props,
) {
  mockGabarits.push(props);
  return props.children;
});

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: { documentId: 'moi' } }),
}));

// ⛔ Jamais `requireActual` sur un service : le client HTTP exige `API_URL` et
// la suite entiere meurt au chargement.
jest.mock('@/services/event/eventQueries', () => ({
  useGetEventTypes: () => ({
    data: mockReseau.types,
    error: mockReseau.error,
    isLoading: mockReseau.isLoading,
    refetch: () => {},
  }),
}));

jest.mock('@/components/molecules/tutorial/TutorialFlowBoundary', () => function BorneMock(
  /** @type {any} */ props,
) {
  return props.children;
});

jest.mock(
  '@/components/molecules/onboardingWrapper/OnboardingWrapper',
  () => function EnveloppeMock(/** @type {any} */ props) {
    return props.children;
  },
);

jest.mock(
  '@/components/molecules/subscriptionQuotaBanner/SubscriptionQuotaBanner',
  () => function BandeauMock() {
    return null;
  },
);

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

/** @type {any} */
let arbre;
/** @type {string[]} */
let destinations = [];

/**
 * Monte l'ecran et rend de quoi l'inspecter.
 * @returns {{ gabarit: any, pressables: any[], textes: string[] }} L'ecran monte.
 */
const afficherLEcran = () => {
  mockGabarits.length = 0;
  destinations = [];
  const navigation = {
    goBack: () => {},
    navigate: (/** @type {string} */ nom) => destinations.push(nom),
    setParams: () => {},
  };

  act(() => {
    arbre = renderer.create(createElement(
      EventWizardProvider,
      null,
      createElement(EventWizardType, { navigation, route: { params: {} } }),
    ));
  });

  return {
    gabarit: mockGabarits[mockGabarits.length - 1],
    pressables: arbre.root.findAll(
      (/** @type {any} */ noeud) => typeof noeud.props?.onPress === 'function',
      { deep: true },
    ),
    textes: textesSous(arbre.root),
  };
};

/**
 * La rangee pressable qui porte exactement ce texte.
 * @param {any[]} pressables Les pressables releves.
 * @param {string} libelle Texte visible attendu.
 * @returns {any} Le pressable, ou `undefined`.
 */
const rangeePortant = (pressables, libelle) => pressables.find(
  (noeud) => textesSous(noeud).includes(libelle),
);

afterEach(() => {
  if (arbre) act(() => arbre.unmount());
  arbre = null;
  mockReseau.error = null;
  mockReseau.isLoading = false;
});

describe('D09 — l ecran « Type d evenement », etat du 2026-08-06', () => {
  test('il affiche une rangee par type servi par le serveur', () => {
    const { textes } = afficherLEcran();

    mockReseau.types.forEach((type) => {
      expect(textes).toContain(type.name);
    });
  });

  test('son entete vient des cles de traduction, et il n a PAS de bouton « Suivant »', () => {
    const { gabarit } = afficherLEcran();

    expect(gabarit.title).toBe('eventWizard.steps.type.title');
    expect(gabarit.subtitle).toBe('eventWizard.steps.type.subtitle');
    expect(gabarit.stepIndex).toBe(1);
    // Le choix du type navigue AU TOUCHER : l'ecran ne passe aucun `onNext`.
    // C'est la mesure qui interdit a D09 d'ajouter un « Suivant » — ce serait un
    // changement d'enchainement, donc du ressort de D08.
    expect(gabarit.onNext).toBeUndefined();
  });

  test('toucher un type navigue vers l ecran suivant', () => {
    const { pressables } = afficherLEcran();

    act(() => rangeePortant(pressables, 'Match').props.onPress());

    expect(destinations).toEqual([RouteNames.EventWizardTeam]);
  });

  test('TEMOIN D INVERSION — une rangee de type ne porte QUE son nom, sans description', () => {
    const { pressables } = afficherLEcran();

    expect(textesSous(rangeePortant(pressables, 'Tournoi'))).toEqual(['Tournoi']);
  });

  test('TEMOIN D INVERSION — « Réservation » est pressable et navigue comme les autres', () => {
    const { pressables } = afficherLEcran();
    const reservation = rangeePortant(pressables, 'Réservation');

    expect(reservation).toBeDefined();
    expect(reservation.props.disabled).toBeFalsy();

    act(() => reservation.props.onPress());
    expect(destinations).toEqual([RouteNames.EventWizardTeam]);
  });

  test('TEMOIN D INVERSION — aucune rangee « Match amical » vers le tunnel League', () => {
    const { pressables, textes } = afficherLEcran();

    expect(textes).not.toContain('Match amical');
    expect(rangeePortant(pressables, 'Match amical')).toBeUndefined();
  });

  test('pendant le chargement, aucune rangee de type n est affichee', () => {
    mockReseau.isLoading = true;
    const { textes } = afficherLEcran();

    expect(textes).not.toContain('Match');
  });

  test('en cas de panne, il affiche le message et un bouton « Recharger »', () => {
    mockReseau.error = { message: 'Panne serveur' };
    const { pressables, textes } = afficherLEcran();

    expect(textes).toContain('Panne serveur');
    expect(rangeePortant(pressables, 'Recharger')).toBeDefined();
  });
});
