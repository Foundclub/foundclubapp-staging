import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

import { EventWizardProvider } from '../EventWizardContext';
import EventWizardLocation from '../EventWizardLocation';

// Filet D09 (E6) — ce que l'ecran « Lieu » AFFICHE, avant sa refonte de
// presentation. Etat du 2026-08-06.
//
// C'est le SEUL des quatre ecrans dont le « Suivant » est deja desactive tant
// que rien n'est choisi. Le prompt demandait de le figer « s'il l'est deja » :
// il l'est, donc on le fige.
//
// `FacilitySelector` est un organisme PARTAGE (5 appelants, dont l'edition
// d'evenement et le tunnel recrutement) : il est double ici, et ce lot ne le
// touche pas.

/** Proprietes recues par le gabarit d'etape, dans l'ordre du rendu. */
const mockGabarits = [];
/** Proprietes recues par le selecteur d'installation. */
const mockSelecteurs = [];

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

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({
    userData: { documentId: 'moi', role: { name: 'Dirigeant', type: 'president' } },
  }),
}));

jest.mock(
  '@/components/organisms/facilitySelector/FacilitySelector',
  () => function SelecteurMock(/** @type {any} */ props) {
    mockSelecteurs.push(props);
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
 * Monte l'ecran.
 * @returns {{ gabarit: any, textes: string[] }} L'ecran monte.
 */
const afficherLEcran = () => {
  mockGabarits.length = 0;
  mockSelecteurs.length = 0;
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
      createElement(EventWizardLocation, { navigation, route: { params: {} } }),
    ));
  });

  return { gabarit: mockGabarits[mockGabarits.length - 1], textes: textesSous(arbre.root) };
};

/** Le dernier jeu de proprietes rendu par le gabarit. */
const dernierGabarit = () => mockGabarits[mockGabarits.length - 1];

afterEach(() => {
  if (arbre) act(() => arbre.unmount());
  arbre = null;
});

describe('D09 — l ecran « Lieu », etat du 2026-08-06', () => {
  test('son entete est en grammaire « focus »', () => {
    const { gabarit } = afficherLEcran();

    expect(gabarit.title).toBe('eventWizard.steps.location.title');
    // INVERSE PAR D09 — motif : le pack pose une question, la ou l'ancien
    // sous-titre enoncait une contrainte (« Le lieu est obligatoire pour
    // continuer »). La contrainte n'est pas perdue : elle est dite en dessous,
    // exactement quand « Suivant » est desactive. Cle NEUVE avec repli.
    expect(gabarit.subtitle).toBe("Où se déroule l'événement ?");
    expect(gabarit.headerVariant).toBe('focus');
  });

  test('« Suivant » est DESACTIVE tant qu aucun lieu n est choisi, et il l explique', () => {
    const { gabarit, textes } = afficherLEcran();

    expect(gabarit.isNextDisabled).toBe(true);
    expect(textes).toContain(
      'Sélectionne une installation du club ou saisis une adresse extérieure pour continuer.',
    );
  });

  test('choisir une installation active « Suivant » et retire l explication', () => {
    afficherLEcran();

    act(() => mockSelecteurs[0].onChange({ facilityId: 'inst-1', location: null }));

    expect(dernierGabarit().isNextDisabled).toBe(false);
    expect(textesSous(arbre.root)).not.toContain(
      'Sélectionne une installation du club ou saisis une adresse extérieure pour continuer.',
    );
  });

  test('un creneau sature qui exige une validation est annonce', () => {
    afficherLEcran();

    act(() => mockSelecteurs[0].onChange({ facilityId: 'inst-1', location: null }));
    act(() => dernierGabarit() && mockSelecteurs[mockSelecteurs.length - 1].onOccupancyResolved({
      requiresApproval: true,
      saturated: true,
    }));

    expect(textesSous(arbre.root)).toContain(
      "Cette installation dépasse sa capacité sur ce créneau. L'événement sera créé en demande en attente jusqu'a validation d'un dirigeant.",
    );
  });
});
