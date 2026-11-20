/* eslint-disable max-len */
import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

import { EventWizardProvider } from '../EventWizardContext';
import EventWizardType from '../EventWizardType';

/** L'activité du compte (preferredSport). */
const mockActivite = { current: 'Football' };
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

// I18N-2 : les descriptions de type sont des getters qui lisent i18next.t au rendu —
// la doublure rend le français de l app, sans initialiser i18next.
jest.mock('i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').i18next
));

// INSCRIPTION-CODE-4 : la doublure lit fr.js, pour lire les mots de chaque famille.
jest.mock('react-i18next', () => ({
  initReactI18next: { init: () => {}, type: '3rdParty' },
  useTranslation: () => ({
    t: jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').i18next.t,
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
  default: () => ({ userData: { documentId: 'moi', preferredSport: mockActivite.current } }),
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

// INSCRIPTION-CODE-4 (20/11, v2_09 « surtout les types d'évènement », planche V2 4.2) — l'étape
// « Type » parle avec les mots de la famille. Le dessin ne change pas ; le type choisi reste
// celui du serveur. Choix de mots : DECISIONS-E4-LOT4.md (banc INSCRIPTION-CODE-1911).
describe('Type d événement : les mots de la famille', () => {
  afterEach(() => { mockActivite.current = 'Football'; });

  it('football (sports collectifs) : les noms du serveur, comme aujourd hui', () => {
    const { textes } = afficherLEcran();
    expect(textes).toEqual(expect.arrayContaining([
      "Détection / Séance d'essai", 'Entraînement', 'Stage', 'Tournoi', 'Match', 'Réservation',
      'Rencontre de championnat ou de coupe',
    ]));
  });

  it('spéléologie (nature) : Séance, Sortie, Rassemblement, Stage / Camp, Séance découverte', () => {
    mockActivite.current = 'Spéléologie';
    const { textes } = afficherLEcran();
    expect(textes).toEqual(expect.arrayContaining([
      'Séance découverte', 'Séance', 'Stage / Camp', 'Rassemblement', 'Sortie',
    ]));
    expect(textes).not.toContain('Match');
    expect(textes).not.toContain('Rencontre de championnat ou de coupe');
  });

  it('danse (culture) : Cours / Atelier, Spectacle / Représentation, Festival / Gala, Cours d essai', () => {
    mockActivite.current = 'Danse';
    const { textes } = afficherLEcran();
    expect(textes).toEqual(expect.arrayContaining([
      "Cours d'essai", 'Cours / Atelier', 'Stage / Masterclass', 'Festival / Gala',
      'Spectacle / Représentation',
    ]));
    expect(textes).not.toContain('Entraînement');
  });

  it('judo (combat) : Combat / Compétition, Séance d essai', () => {
    mockActivite.current = 'Judo';
    const { textes } = afficherLEcran();
    expect(textes).toEqual(expect.arrayContaining([
      "Séance d'essai", 'Cours / Entraînement', 'Tournoi / Gala', 'Combat / Compétition',
    ]));
  });

  it('natation (individuel) : seul « Match » devient « Compétition »', () => {
    mockActivite.current = 'Natation';
    const { textes } = afficherLEcran();
    expect(textes).toEqual(expect.arrayContaining([
      "Détection / Séance d'essai", 'Entraînement', 'Tournoi', 'Compétition',
    ]));
    expect(textes).not.toContain('Match');
  });

  it('le type choisi reste celui du serveur, et Réservation reste grisée', () => {
    mockActivite.current = 'Spéléologie';
    const { pressables, textes } = afficherLEcran();
    expect(textes).toContain('Réservation');
    const sortie = pressables.find((noeud) => textesSous(noeud).includes('Sortie'));
    act(() => { sortie.props.onPress(); });
    expect(destinations.length).toBe(1);
    expect(pressables.find((noeud) => textesSous(noeud).includes('Réservation'))).toBeUndefined();
  });
});

describe('fr.js et en.js : chaque famille aux mots propres a tous ses mots', () => {
  const fr = jest.requireActual('@/theme/strings/translations/fr').default;
  const en = jest.requireActual('@/theme/strings/translations/en').default;
  const { FAMILLES_AUX_MOTS_PROPRES } = jest.requireActual('@/domains/activity/familleDuSport');
  it.each(FAMILLES_AUX_MOTS_PROPRES)('%s', (famille) => {
    [fr, en].forEach((langue) => {
      ['detection', 'entrainement', 'match', 'stage', 'tournoi'].forEach((motif) => {
        expect(typeof langue.familles[famille].evenements[motif].titre).toBe('string');
        expect(typeof langue.familles[famille].evenements[motif].description).toBe('string');
      });
      ['evenementsSousTitre', 'mesEquipes', 'reservationsSousTitre'].forEach((cle) => {
        expect(typeof langue.familles[famille].accueil[cle]).toBe('string');
      });
    });
  });
});
