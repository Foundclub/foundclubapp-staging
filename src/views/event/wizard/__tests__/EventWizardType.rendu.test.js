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
// ⚠️ Trois attentes de ce fichier ont ete ECRITES POUR ROUGIR, puis INVERSEES
// par la refonte D09. Le motif de chaque inversion est ecrit sur place :
//   1. une rangee de type porte desormais sa description sur une ligne ;
//   2. « Reservation » est grisee et n'est plus pressable ;
//   3. une rangee « Match amical » ouvre le tunnel League.

/** Proprietes recues par le gabarit d'etape, dans l'ordre du rendu. */
const mockGabarits = [];
/** Les SEPT types reels du serveur (admin/src/data/event-types.json). */
const TYPES_DU_SERVEUR = [
  { documentId: 't-detection', name: "Détection / Séance d'essai" },
  { documentId: 't-entrainement', name: 'Entraînement' },
  { documentId: 't-stage', name: 'Stage' },
  { documentId: 't-tournoi', name: 'Tournoi' },
  { documentId: 't-match', name: 'Match' },
  { documentId: 't-autre', name: 'Autre' },
  { documentId: 't-reservation', name: 'Réservation' },
];

/** Les types d'evenement servis a la place de l'appel reseau. */
const mockReseau = {
  error: null,
  isLoading: false,
  types: TYPES_DU_SERVEUR,
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
/** Les gestes de navigation releves, avec leur methode et leurs parametres. */
let gestes = [];

/**
 * Monte l'ecran et rend de quoi l'inspecter.
 * @returns {{ gabarit: any, pressables: any[], textes: string[] }} L'ecran monte.
 */
const afficherLEcran = () => {
  mockGabarits.length = 0;
  destinations = [];
  gestes = [];
  const navigation = {
    goBack: () => {},
    navigate: (/** @type {string} */ nom, /** @type {any} */ params) => {
      destinations.push(nom);
      gestes.push({ geste: 'navigate', nom, params });
    },
    replace: (/** @type {string} */ nom, /** @type {any} */ params) => {
      destinations.push(nom);
      gestes.push({ geste: 'replace', nom, params });
    },
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
  mockReseau.types = TYPES_DU_SERVEUR;
});

describe('D09 — l ecran « Type d evenement », etat du 2026-08-06', () => {
  test('il affiche une rangee par type servi par le serveur', () => {
    const { textes } = afficherLEcran();

    mockReseau.types.forEach((type) => {
      expect(textes).toContain(type.name);
    });
  });

  test('son entete est en grammaire « focus », et il n a PAS de bouton « Suivant »', () => {
    const { gabarit } = afficherLEcran();

    expect(gabarit.title).toBe('eventWizard.steps.type.title');
    // D09 — le sous-titre passe a la question du pack de design. Il est servi
    // par une cle NEUVE avec repli : `fr.js` n'est pas touche (0 ligne supprimee).
    expect(gabarit.subtitle).toBe('Un seul choix — il adapte les étapes suivantes.');
    // D09 — la grammaire d'en-tete de D05 est ACTIVEE, elle n'est pas reecrite.
    expect(gabarit.headerVariant).toBe('focus');
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

  // INVERSE PAR D09 — motif : le pack decrit « sept types decrits en une
  // ligne ». La description vient d'une table indexee sur le nom NORMALISE que
  // rend le serveur ; un type absent de la table s'affiche sans description
  // plutot que de disparaitre.
  test('chaque rangee de type porte sa description sur une ligne', () => {
    const { pressables } = afficherLEcran();

    expect(textesSous(rangeePortant(pressables, 'Tournoi'))).toEqual([
      'Tournoi',
      'Plusieurs équipes sur une ou plusieurs journées',
    ]);
    expect(textesSous(rangeePortant(pressables, 'Entraînement'))).toEqual([
      'Entraînement',
      'Séance classique pour ton équipe',
    ]);
  });

  test('un type inconnu de la table s affiche quand meme, sans description', () => {
    mockReseau.types = [{ documentId: 't-inconnu', name: 'Assemblée générale' }];
    const { pressables } = afficherLEcran();

    expect(textesSous(rangeePortant(pressables, 'Assemblée générale'))).toEqual([
      'Assemblée générale',
    ]);
  });

  // INVERSE PAR D09 — motif : le pack grise « Reservation » et la marque
  // « Bientot disponible », non cliquable. ⚠️ La capacite n'est pas supprimee :
  // le bloc reservation de l'etape 3 (prix, mode) reste en place, et l'edition
  // d'un evenement existant y donne toujours acces. C'est une porte fermee, pas
  // une piece demolie.
  test('« Réservation » est grisee, marquee, et n est plus pressable', () => {
    const { pressables, textes } = afficherLEcran();

    expect(textes).toContain('Réservation');
    expect(textes).toContain('Bientôt disponible');
    expect(rangeePortant(pressables, 'Réservation')).toBeUndefined();
  });

  // INVERSE PAR D09 — motif : decision d'Adel du 2026-08-06, « Match amical »
  // n'est pas un type d'evenement mais une SORTIE vers le tunnel amical
  // existant. AUCUNE valeur de type n'est creee ni renommee en base.
  test('une rangee « Match amical » ouvre le tunnel League, juste apres « Match »', () => {
    const { pressables, textes } = afficherLEcran();

    expect(textes).toContain('Match amical');
    expect(textes.indexOf('Match amical')).toBe(textes.indexOf('Match') + 2);

    act(() => rangeePortant(pressables, 'Match amical').props.onPress());

    expect(gestes).toEqual([{
      geste: 'navigate',
      nom: RouteNames.FriendlyMatchWizardStack,
      params: { screen: RouteNames.FriendlyMatchWizardTeam },
    }]);
  });

  // Le cas limite le plus serieux du lot : un aller sans retour serait un piege.
  // `navigate` empile le tunnel amical AU-DESSUS de `EventStack`, qui reste
  // monte — le brouillon d'evenement survit, et le « Retour » de la 1re etape
  // amicale (un simple `goBack`) ramene ici. `replace` detruirait les deux.
  test('la porte amicale EMPILE : elle ne remplace jamais l ecran courant', () => {
    const { pressables } = afficherLEcran();

    act(() => rangeePortant(pressables, 'Match amical').props.onPress());

    expect(gestes.map((geste) => geste.geste)).toEqual(['navigate']);
    expect(gestes.some((geste) => geste.geste === 'replace')).toBe(false);
  });

  test('le type deja choisi est marque comme selectionne', () => {
    const { pressables } = afficherLEcran();

    expect(rangeePortant(pressables, 'Match').props.accessibilityState.selected).toBe(false);

    act(() => rangeePortant(pressables, 'Match').props.onPress());

    expect(
      rangeePortant(
        arbre.root.findAll(
          (/** @type {any} */ noeud) => typeof noeud.props?.onPress === 'function',
          { deep: true },
        ),
        'Match',
      ).props.accessibilityState.selected,
    ).toBe(true);
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
