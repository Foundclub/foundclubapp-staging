import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

import { EventWizardProvider, useEventWizard } from '../EventWizardContext';
import EventWizardTeam from '../EventWizardTeam';

// Filet D09 (E6) — ce que l'ecran « Equipe organisatrice » AFFICHE, avant sa
// refonte de presentation. Etat du 2026-08-06.
//
// Pilote par le TEXTE VISIBLE. La carte d'equipe elle-meme
// (`EventWizardTeamCard`) est PARTAGEE par 5 autres ecrans, dont ceux des lots
// D07 et D10 : elle est doublee ici, et ce lot ne la touche pas.

/** Proprietes recues par le gabarit d'etape, dans l'ordre du rendu. */
const mockGabarits = [];
/** Les equipes servies a la place de l'appel reseau. */
const mockReseau = {
  equipes: [
    { club: { documentId: 'club-1', name: 'FC Test' }, documentId: 'eq-1', name: 'U15 A' },
    { club: { documentId: 'club-1', name: 'FC Test' }, documentId: 'eq-2', name: 'Seniors B' },
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

jest.mock('@/domains/auth/useAuth', () => {
  const { USER_ROLES } = jest.requireActual('@/domains/auth/authUseCases');
  return {
    __esModule: true,
    default: () => ({
      USER_ROLES,
      userData: {
        club: { documentId: 'club-1', name: 'FC Test' },
        documentId: 'moi',
        role: { name: USER_ROLES.president, type: 'president' },
        trainedTeams: [{ club: { documentId: 'club-1' }, documentId: 'eq-1', name: 'U15 A' }],
      },
    }),
  };
});

// ⛔ Jamais `requireActual` sur un service. `useGetTeams` est PAGINEE : rendre
// le tableau directement donne une liste VIDE sans la moindre erreur.
jest.mock('@/services/team/teamQueries', () => ({
  useGetTeams: () => ({
    data: { pages: [{ data: mockReseau.equipes }] },
    error: null,
    isLoading: false,
    refetch: () => {},
  }),
}));

jest.mock('@/services/activity/activityQueries', () => ({
  useGetActivities: () => ({ data: [], error: null, isLoading: false }),
}));
jest.mock('@/services/category/categoryQueries', () => ({
  useGetCategories: () => ({ data: [], error: null, isLoading: false }),
}));
jest.mock('@/services/section/sectionQueries', () => ({
  useGetSections: () => ({ data: [], error: null, isLoading: false }),
}));

jest.mock('@/components/molecules/autocompleteSelect/AutocompleteSelect', () => () => null);
jest.mock('@/components/molecules/input/Input', () => () => null);

jest.mock('@/components/atoms/button/Button', () => function BoutonMock(/** @type {any} */ props) {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
  return reactActuel.createElement(
    PressableRN,
    { accessibilityRole: 'button', disabled: Boolean(props.disabled), onPress: props.onPress },
    reactActuel.createElement(TexteRN, null, props.title),
  );
});

// La carte d'equipe rendue comme un pressable portant le nom de l'equipe :
// on appuie « sur le texte », pas sur une forme d'arbre.
jest.mock('@/views/event/wizard/components/EventWizardTeamCard', () => function CarteEquipeMock(
  /** @type {any} */ props,
) {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
  return reactActuel.createElement(
    PressableRN,
    { accessibilityRole: 'button', onPress: props.onPress },
    reactActuel.createElement(TexteRN, null, props.team?.name),
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

/**
 * Monte l'ecran, apres avoir eventuellement seme un type d'evenement.
 * @param {{ nomDuType?: string }} [options] Type d'evenement a semer.
 * @returns {{ gabarit: any, textes: string[] }} L'ecran monte.
 */
const afficherLEcran = ({ nomDuType } = {}) => {
  mockGabarits.length = 0;
  const navigation = { goBack: () => {}, navigate: () => {}, setParams: () => {} };
  const element = createElement(
    EventWizardProvider,
    null,
    createElement(PriseDeCourant),
    createElement(EventWizardTeam, { navigation, route: { params: {} } }),
  );

  act(() => { arbre = renderer.create(element); });
  if (nomDuType) {
    // Le `dispatch` du tunnel suffit a reafficher : `arbre.update` avec le MEME
    // element est ignore par React, et le gabarit ne serait jamais re-releve.
    mockGabarits.length = 0;
    act(() => semer({ payload: { documentId: 't-1', name: nomDuType }, type: 'SET_TYPE' }));
  }

  return { gabarit: mockGabarits[mockGabarits.length - 1], textes: textesSous(arbre.root) };
};

afterEach(() => {
  if (arbre) act(() => arbre.unmount());
  arbre = null;
});

describe('D09 — l ecran « Equipe organisatrice », etat du 2026-08-06', () => {
  test('son entete vient des cles de traduction, et il n a PAS de bouton « Suivant »', () => {
    const { gabarit } = afficherLEcran();

    expect(gabarit.title).toBe('eventWizard.steps.team.title');
    expect(gabarit.subtitle).toBe('eventWizard.steps.team.subtitle');
    // Choisir une equipe navigue AU TOUCHER : aucun `onNext` n'est passe.
    expect(gabarit.onNext).toBeUndefined();
  });

  test('un dirigeant voit ses equipes, rangees sous deux intertitres', () => {
    const { textes } = afficherLEcran();

    expect(textes).toContain('U15 A');
    expect(textes).toContain('Seniors B');
    expect(textes).toContain('MES ÉQUIPES');
    expect(textes).toContain('AUTRES ÉQUIPES DU CLUB');
  });

  test('pour un tournoi, l ecran change de titre et propose les deux cadres', () => {
    const { gabarit, textes } = afficherLEcran({ nomDuType: 'Tournoi' });

    expect(gabarit.title).toBe('Cadre du tournoi');
    expect(textes).toContain("Tournoi d'une équipe");
    expect(textes).toContain('Tournoi autonome');
  });
});
