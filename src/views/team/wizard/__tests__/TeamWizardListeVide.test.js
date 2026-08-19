import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

import TeamWizardActivity from '../TeamWizardActivity';
import TeamWizardCategory from '../TeamWizardCategory';
import { TeamWizardProvider, useTeamWizard } from '../TeamWizardContext';
import TeamWizardLevel from '../TeamWizardLevel';
import TeamWizardRecap from '../TeamWizardRecap';
import TeamWizardSection from '../TeamWizardSection';
import TeamWizardTrainers from '../TeamWizardTrainers';

// Filet W06 (E6) — LES ETAPES DE REFERENTIEL DU TUNNEL EQUIPE QUAND LEUR LISTE
// EST VIDE. Constat du lot V02 : Section, Sport, Categorie et Niveau traitent
// toutes le cas « erreur » et AUCUNE le cas « liste vide » — l'ecran n'affiche
// rien, le bouton du bas reste gris, et la personne est enfermee au milieu d'un
// tunnel de creation.
//
// Points d'observation : les proprietes recues par le gabarit d'etape
// (`isNextDisabled`, `nextLabel`) et les textes rendus dans le corps. Le gabarit
// est remplace par un mouchard : c'est LUI qui porte le bouton du bas, donc
// c'est chez lui que « l'utilisateur a-t-il une action ? » se mesure.

/** Proprietes recues par le gabarit d'etape, dans l'ordre du rendu. */
const mockGabarits = [];

/**
 * Les quatre referentiels globaux, en boites FIGEES : on remplace leur contenu,
 * jamais la boite elle-meme (les `jest.mock` capturent la reference).
 */
const mockReferentiels = {
  activities: /** @type {any} */ ({ data: [], error: null, isLoading: false }),
  categories: /** @type {any} */ ({ data: [], error: null, isLoading: false }),
  levels: /** @type {any} */ ({ data: [], error: null, isLoading: false }),
  sections: /** @type {any} */ ({ data: [], error: null, isLoading: false }),
};

/** Le club lu par les etapes Sport, Encadrement et Recapitulatif. */
const mockClub = /** @type {any} */ ({
  data: { documentId: 'club-1', members: [], name: 'FC Test' },
  error: null,
  isLoading: false,
});

/** Le compte connecte. */
const mockCompte = {
  documentId: 'moi',
  firstname: 'Adel',
  freeUsageSummary: /** @type {any[]} */ ([]),
  lastname: 'F',
  role: { name: 'Dirigeant', type: 'president' },
  subscriptionAccessLevel: 'FREE',
};

jest.mock('react-i18next', () => ({
  initReactI18next: { init: () => {}, type: '3rdParty' },
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli, /** @type {any} */ valeurs) => {
      const base = typeof repli === 'string' ? repli : cle;
      if (!valeurs) return base;
      return Object.keys(valeurs).reduce(
        (texte, nom) => texte.replace(`{{${nom}}}`, String(valeurs[nom])),
        base,
      );
    },
  }),
}));

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
      Images: { arrowLeft: 1, close: 1 },
      Spaces: espaces,
    }),
  };
});

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({
    freeUsageSummary: mockCompte.freeUsageSummary,
    subscriptionAccessLevel: mockCompte.subscriptionAccessLevel,
    userData: mockCompte,
  }),
}));

jest.mock('@/context/AppModeContext', () => {
  const modeFige = { isGold: false };
  return { useAppMode: () => modeFige };
});

jest.mock('@/domains/guidance/guidanceRuntime', () => ({
  emitGuidanceAction: jest.fn(),
}));

jest.mock('@tanstack/react-query', () => ({
  useMutation: (/** @type {any} */ options) => ({
    isPending: false,
    mutate: (/** @type {any} */ variables) => Promise.resolve()
      .then(() => options.mutationFn(variables))
      .then((resultat) => options.onSuccess?.(resultat, variables))
      .catch((erreur) => options.onError?.(erreur, variables)),
  }),
  useQueryClient: () => ({ invalidateQueries: () => Promise.resolve() }),
}));

// ⛔ Jamais `requireActual` sur un service : le client HTTP exige `API_URL`.
jest.mock('@/services/team/teamService', () => ({ createTeam: () => Promise.resolve({}) }));

jest.mock('@/services/activity/activityQueries', () => ({
  useGetActivities: () => ({ ...mockReferentiels.activities, refetch: jest.fn() }),
}));
jest.mock('@/services/category/categoryQueries', () => ({
  useGetCategories: () => ({ ...mockReferentiels.categories, refetch: jest.fn() }),
}));
jest.mock('@/services/level/levelQueries', () => ({
  useGetLevels: () => ({ ...mockReferentiels.levels, refetch: jest.fn() }),
}));
jest.mock('@/services/section/sectionQueries', () => ({
  useGetSections: () => ({ ...mockReferentiels.sections, refetch: jest.fn() }),
}));
jest.mock('@/services/club/clubQueries', () => ({
  useGetClub: () => ({ ...mockClub, refetch: jest.fn() }),
}));

jest.mock('@/components/molecules/wizardStepLayout/WizardStepLayout', () => function GabaritMock(
  /** @type {any} */ props,
) {
  mockGabarits.push(props);
  return props.children;
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

jest.mock(
  '@/components/molecules/wizardOptionCard/WizardOptionCard',
  () => function CarteMock(/** @type {any} */ props) {
    const reactActuel = jest.requireActual('react');
    const { Text: TexteRN } = jest.requireActual('react-native');
    return reactActuel.createElement(TexteRN, null, props.title);
  },
);

jest.mock('@/components/molecules/input/Input', () => function ChampMock() { return null; });

jest.mock(
  '@/components/organisms/createTrainerModal/CreateTrainerModal',
  () => function ModaleMock() { return null; },
);

jest.mock(
  '@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet',
  () => function MurMock() { return null; },
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

/**
 * Le dispatch du tunnel, capte pour semer l'etat des etapes precedentes.
 * @type {(action: any) => void}
 */
let semer = () => {};

/**
 * Composant sans rendu : il capte le `dispatch` du tunnel.
 * @returns {null} Rien.
 */
function PriseDeCourant() {
  const { dispatch } = useTeamWizard();
  semer = dispatch;
  return null;
}

/** @type {any} */
let arbre;
/** @type {string[]} */
let destinations = [];

/**
 * Les quatre etapes de referentiel, dans l'ordre du tunnel. `cle` designe la
 * boite de `mockReferentiels`, `choix` l'action qui coche une valeur.
 */
const ETAPES = [
  {
    choix: { payload: 'sec-1', type: 'SET_SECTION' },
    cle: 'sections',
    Ecran: TeamWizardSection,
    exemple: { documentId: 'sec-1', name: 'Masculin' },
    numero: '3/8',
    passer: 'Continuer sans section',
    titre: 'Section',
  },
  {
    choix: { payload: 'act-1', type: 'SET_ACTIVITY' },
    cle: 'activities',
    Ecran: TeamWizardActivity,
    exemple: { documentId: 'act-1', name: 'Football' },
    numero: '4/8',
    passer: 'Continuer sans sport',
    titre: 'Sport',
  },
  {
    choix: { payload: 'cat-1', type: 'SET_CATEGORY' },
    cle: 'categories',
    Ecran: TeamWizardCategory,
    exemple: { documentId: 'cat-1', name: 'U15' },
    numero: '5/8',
    passer: 'Continuer sans catégorie',
    titre: 'Catégorie',
  },
  {
    choix: { payload: 'niv-1', type: 'SET_LEVEL' },
    cle: 'levels',
    Ecran: TeamWizardLevel,
    exemple: { documentId: 'niv-1', name: 'Loisir' },
    numero: '6/8',
    passer: 'Continuer sans niveau',
    titre: 'Niveau',
  },
];

/**
 * Remet les quatre referentiels pleins, le club present et le tunnel vierge.
 * @returns {void} Rien.
 */
const toutRemettreDAplomb = () => {
  /**
   * Un referentiel qui a repondu, avec ce qu'il contient.
   * @param {any[]} data Les entrees.
   * @returns {any} La forme d'un resultat de requete.
   */
  const plein = (data) => ({ data, error: null, isLoading: false });

  mockReferentiels.sections = plein([{ documentId: 'sec-1', name: 'Masculin' }]);
  mockReferentiels.activities = plein([
    { documentId: 'act-1', name: 'Football' },
    { documentId: 'act-2', name: 'Rugby' },
  ]);
  mockReferentiels.categories = plein([{ documentId: 'cat-1', name: 'U15' }]);
  mockReferentiels.levels = plein([{ documentId: 'niv-1', name: 'Loisir' }]);
  mockClub.data = { documentId: 'club-1', members: [], name: 'FC Test' };
  mockClub.error = null;
  mockClub.isLoading = false;
};

/**
 * Monte une etape du tunnel, club deja connu.
 * @param {any} Ecran Le composant d'etape.
 * @param {any[]} [actions] Ce qu'on seme dans le tunnel avant de lire le gabarit.
 * @returns {{ gabarit: any, textes: string[] }} Le dernier rendu de l'etape.
 */
const afficherLEtape = (Ecran, actions = []) => {
  mockGabarits.length = 0;
  destinations = [];
  const pilote = {
    getParent: () => null,
    navigate: (/** @type {string} */ nom) => { destinations.push(nom); },
    reset: jest.fn(),
  };
  const element = createElement(
    TeamWizardProvider,
    null,
    createElement(PriseDeCourant),
    createElement(Ecran, { navigation: /** @type {any} */ (pilote) }),
  );

  act(() => { arbre = renderer.create(element); });
  act(() => {
    semer({ payload: { clubId: 'club-1' }, type: 'INIT_FROM_PARAMS' });
    actions.forEach((action) => semer(action));
  });

  return {
    gabarit: mockGabarits[mockGabarits.length - 1],
    textes: textesSous(arbre.toJSON() || { children: [] }),
  };
};

beforeEach(() => {
  toutRemettreDAplomb();
});

afterEach(() => {
  if (arbre) act(() => arbre.unmount());
  arbre = null;
});

describe('W06 — liste vide : l ecran propose une issue', () => {
  ETAPES.forEach(({
    cle, Ecran, numero, passer, titre,
  }) => {
    test(`etape ${numero} « ${titre} » — vide : le bouton devient « ${passer} », ACTIF`, () => {
      mockReferentiels[cle] = { data: [], error: null, isLoading: false };

      const { gabarit, textes } = afficherLEtape(Ecran);

      expect(gabarit.nextLabel).toBe(passer);
      expect(gabarit.isNextDisabled).toBe(false);
      // Et une phrase dit POURQUOI, sans promettre un « Réessayer » qui ne
      // pourrait rien changer sur une table vide.
      expect(textes.join(' | ')).toContain('commune à toute l’application');
      expect(textes.join(' | ')).not.toContain('Réessayer');
    });

    test(`etape ${numero} « ${titre} » — l issue AVANCE vraiment vers l etape suivante`, () => {
      mockReferentiels[cle] = { data: [], error: null, isLoading: false };

      const { gabarit } = afficherLEtape(Ecran);
      act(() => gabarit.onNext());

      expect(destinations).toHaveLength(1);
      expect(destinations[0]).toBeTruthy();
    });
  });
});

describe('W06 — liste pleine : rien ne change (non-regression)', () => {
  ETAPES.forEach(({
    choix, Ecran, exemple, numero, titre,
  }) => {
    test(`etape ${numero} « ${titre} » — sans choix le bouton reste « Suivant » et GRIS`, () => {
      const { gabarit, textes } = afficherLEtape(Ecran);

      expect(gabarit.nextLabel).toBe('Suivant');
      expect(gabarit.isNextDisabled).toBe(true);
      expect(textes.join(' | ')).toContain(exemple.name);
    });

    test(`etape ${numero} « ${titre} » — une fois le choix fait, « Suivant » s allume`, () => {
      const { gabarit } = afficherLEtape(Ecran, [choix]);

      expect(gabarit.nextLabel).toBe('Suivant');
      expect(gabarit.isNextDisabled).toBe(false);
    });
  });
});

describe('W06 — erreur de chargement : le message d erreur reste, distinct du cas vide', () => {
  ETAPES.forEach(({
    cle, Ecran, numero, passer,
  }) => {
    test(`etape ${numero} — en erreur : « Réessayer », JAMAIS « ${passer} »`, () => {
      mockReferentiels[cle] = {
        data: undefined,
        error: new Error('Failed to fetch'),
        isLoading: false,
      };

      const { gabarit, textes } = afficherLEtape(Ecran);

      expect(textes.join(' | ')).toContain('Réessayer');
      expect(textes.join(' | ')).not.toContain('commune à toute l’application');
      expect(gabarit.nextLabel).toBe('Suivant');
    });

    test(`etape ${numero} — en chargement, ce n est PAS un referentiel vide`, () => {
      mockReferentiels[cle] = { data: undefined, error: null, isLoading: true };

      const { gabarit } = afficherLEtape(Ecran);

      expect(gabarit.nextLabel).toBe('Suivant');
      expect(gabarit.isNextDisabled).toBe(true);
    });
  });
});

describe('W06 — aucune etape du tunnel ne laisse l utilisateur sans action', () => {
  test('les QUATRE etapes, toutes listes vides a la fois, restent franchissables', () => {
    mockReferentiels.sections = { data: [], error: null, isLoading: false };
    mockReferentiels.activities = { data: [], error: null, isLoading: false };
    mockReferentiels.categories = { data: [], error: null, isLoading: false };
    mockReferentiels.levels = { data: [], error: null, isLoading: false };

    const bloquees = ETAPES.filter(({ Ecran }) => {
      const { gabarit } = afficherLEtape(Ecran);
      const bloquee = gabarit.isNextDisabled !== false;
      if (arbre) act(() => arbre.unmount());
      arbre = null;
      return bloquee;
    });

    expect(bloquees.map(({ titre }) => titre)).toEqual([]);
  });

  test('etape 7/8 — le 5e ecran du meme moule avait DEJA son issue', () => {
    mockClub.data = { documentId: 'club-1', members: [], name: 'FC Test' };
    mockCompte.role = { name: 'Sans role', type: 'player' };

    const { textes } = afficherLEtape(TeamWizardTrainers);

    expect(textes.join(' | ')).toContain('Créer un·e entraîneur·e');
    mockCompte.role = { name: 'Dirigeant', type: 'president' };
  });

  test('etape 8/8 — une etape PASSEE faute de referentiel ne rebloque pas', () => {
    mockReferentiels.sections = { data: [], error: null, isLoading: false };
    mockReferentiels.categories = { data: [], error: null, isLoading: false };
    mockReferentiels.levels = { data: [], error: null, isLoading: false };

    const { gabarit } = afficherLEtape(TeamWizardRecap, [
      { payload: 'U15 Filles', type: 'SET_NAME' },
      { payload: 'act-1', type: 'SET_ACTIVITY' },
      { payload: ['moi'], type: 'SET_TRAINERS' },
    ]);

    expect(gabarit.isNextDisabled).toBe(false);
  });

  test('etape 8/8 — un referentiel PLEIN reste exige (non-regression)', () => {
    const { gabarit } = afficherLEtape(TeamWizardRecap, [
      { payload: 'U15 Filles', type: 'SET_NAME' },
      { payload: 'act-1', type: 'SET_ACTIVITY' },
      { payload: ['moi'], type: 'SET_TRAINERS' },
    ]);

    expect(gabarit.isNextDisabled).toBe(true);
  });
});
