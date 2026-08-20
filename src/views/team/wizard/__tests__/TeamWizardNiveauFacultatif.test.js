import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

import { createTeam } from '@/services/team/teamService';

import TeamWizardActivity from '../TeamWizardActivity';
import TeamWizardCategory from '../TeamWizardCategory';
import { TeamWizardProvider, useTeamWizard } from '../TeamWizardContext';
import TeamWizardLevel from '../TeamWizardLevel';
import TeamWizardRecap from '../TeamWizardRecap';
import TeamWizardSection from '../TeamWizardSection';

// Filet AA03 (E6) — CREER UNE EQUIPE SANS CHOISIR DE NIVEAU.
//
// Constat d'Adel, recette du 2026-08-20 : « on ne peut pas creer d'equipe sans
// niveau, car si on n'en selectionne pas a la creation, le bouton de l'etape
// reste grise ».
//
// NATURE : porte fermee. L'etape 6/8 se PRESENTE comme facultative — le
// content-type `team` du serveur declare `level` en relation optionnelle, seul
// `name` porte `required: true` — et se COMPORTE comme obligatoire.
//
// LA CAUSE, et pourquoi elle se corrige a UN seul endroit : le pied des quatre
// etapes de referentiel est calcule par la meme fonction partagee,
// `getStepFooterProps`. Elle ne connaissait qu'une raison de ne rien choisir —
// `isEmpty`, « il n'y a rien a choisir ». Elle ne connaissait pas « je ne veux
// rien choisir ». Le nom de la clef de traduction le disait deja : `skipEmpty`.
//
// ET LE VRAI PIEGE DU LOT, celui que surveille le temoin 1 bis : ouvrir l'etape
// 6/8 SANS toucher au recapitulatif n'aurait rien repare, ca aurait DEPLACE le
// mur de la 6e a la 8e marche — bouton « Creer l'equipe » gris apres huit
// ecrans remplis pour rien.
//
// CE QUE CE FICHIER NE PROUVE PAS, et c'est mesure, pas suppose : que le
// SERVEUR accepte la creation. `admin/src/api/team/controllers/validation/team.ts`
// pose une SECONDE porte, en yup, qui EXIGE `level` pour toute equipe
// non-LEAGUE (« Level is required ») — en contradiction avec son propre schema.
// Tant que cette ligne n'a pas bouge, l'appel repond 400. C'est remonte au chef
// d'orchestre : la moitie `app` de AA03 ne voyage pas seule.

/** Proprietes recues par le gabarit d'etape, dans l'ordre du rendu. */
const mockGabarits = [];

/** Les quatre referentiels globaux, en boites FIGEES (les `jest.mock` capturent la reference). */
const mockReferentiels = {
  activities: /** @type {any} */ ({ data: [], error: null, isLoading: false }),
  categories: /** @type {any} */ ({ data: [], error: null, isLoading: false }),
  levels: /** @type {any} */ ({ data: [], error: null, isLoading: false }),
  sections: /** @type {any} */ ({ data: [], error: null, isLoading: false }),
};

/** Le club lu par les etapes Sport et Recapitulatif. */
const mockClub = /** @type {any} */ ({
  data: { documentId: 'club-1', members: [], name: 'FC Test' },
  error: null,
  isLoading: false,
});

jest.mock('react-i18next', () => ({
  initReactI18next: { init: () => {}, type: '3rdParty' },
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => (
      typeof repli === 'string' ? repli : cle
    ),
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
    freeUsageSummary: [],
    subscriptionAccessLevel: 'FREE',
    userData: {
      documentId: 'moi',
      firstname: 'Adel',
      lastname: 'F',
      role: { name: 'Dirigeant' },
    },
  }),
}));

jest.mock('@/context/AppModeContext', () => {
  const modeFige = { isGold: false };
  return { useAppMode: () => modeFige };
});

jest.mock('@/domains/guidance/guidanceRuntime', () => ({ emitGuidanceAction: jest.fn() }));

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

// Jamais `requireActual` sur un service : le client HTTP exige `API_URL`.
jest.mock('@/services/team/teamService', () => ({
  createTeam: jest.fn(() => Promise.resolve({})),
}));

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

jest.mock('@/components/atoms/button/Button', () => function BoutonMock() { return null; });
jest.mock('@/components/molecules/input/Input', () => function ChampMock() { return null; });
jest.mock(
  '@/components/molecules/wizardOptionCard/WizardOptionCard',
  () => function CarteMock(/** @type {any} */ props) {
    const reactActuel = jest.requireActual('react');
    const { Text: TexteRN } = jest.requireActual('react-native');
    return reactActuel.createElement(TexteRN, null, props.title);
  },
);
jest.mock(
  '@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet',
  () => function MurMock() { return null; },
);

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

/**
 * Remet les quatre referentiels PLEINS — c'est tout l'enjeu du lot : le defaut
 * d'Adel se produit liste NON vide, la ou W06 n'avait rien change.
 * @returns {void} Rien.
 */
const referentielsPleins = () => {
  /**
   * Un referentiel qui a repondu, avec ce qu'il contient.
   * @param {any[]} data Les entrees.
   * @returns {any} La forme d'un resultat de requete.
   */
  const plein = (data) => ({ data, error: null, isLoading: false });

  mockReferentiels.sections = plein([{ documentId: 'sec-1', name: 'Masculin' }]);
  // DEUX sports, jamais un seul : `TeamWizardActivity` COCHE D'OFFICE l'unique
  // sport d'une liste a un element. Avec un seul, le temoin 3 mesurerait ce
  // raccourci, pas la porte fermee qu'il surveille.
  mockReferentiels.activities = plein([
    { documentId: 'act-1', name: 'Football' },
    { documentId: 'act-2', name: 'Rugby' },
  ]);
  mockReferentiels.categories = plein([{ documentId: 'cat-1', name: 'U15' }]);
  mockReferentiels.levels = plein([
    { documentId: 'niv-1', name: 'Loisir' },
    { documentId: 'niv-2', name: 'Departemental' },
  ]);
};

/**
 * Monte une etape du tunnel, club deja connu.
 * @param {any} Ecran Le composant d'etape.
 * @param {any[]} [actions] Ce qu'on seme dans le tunnel avant de lire le gabarit.
 * @returns {any} Le dernier jeu de proprietes recu par le gabarit d'etape.
 */
const afficherLEtape = (Ecran, actions = []) => {
  mockGabarits.length = 0;
  const pilote = { getParent: () => null, navigate: jest.fn(), reset: jest.fn() };
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

  return mockGabarits[mockGabarits.length - 1];
};

/** Tout ce qu'il faut semer pour arriver au recap SANS avoir choisi de niveau. */
const TUNNEL_SANS_NIVEAU = [
  { payload: 'U15 Filles', type: 'SET_NAME' },
  { payload: 'sec-1', type: 'SET_SECTION' },
  { payload: 'act-1', type: 'SET_ACTIVITY' },
  { payload: 'cat-1', type: 'SET_CATEGORY' },
  { payload: ['moi'], type: 'SET_TRAINERS' },
];

beforeEach(() => {
  referentielsPleins();
  mockClub.data = { documentId: 'club-1', members: [], name: 'FC Test' };
  mockClub.error = null;
  mockClub.isLoading = false;
  /** @type {any} */ (createTeam).mockClear();
});

afterEach(() => {
  if (arbre) act(() => arbre.unmount());
  arbre = null;
});

describe('AA03 - temoin 1 : on cree une equipe en PASSANT l etape du niveau', () => {
  test('etape 6/8, liste NON vide, aucun choix : le bouton est ACTIF', () => {
    const gabarit = afficherLEtape(TeamWizardLevel);

    expect(gabarit.isNextDisabled).toBe(false);
  });

  test('temoin 1 bis - et le recapitulatif ne rebloque pas derriere', () => {
    const gabarit = afficherLEtape(TeamWizardRecap, TUNNEL_SANS_NIVEAU);

    expect(gabarit.isNextDisabled).toBe(false);
  });

  test('temoin 1 ter - « Creer l equipe » part vraiment, SANS niveau', async () => {
    const gabarit = afficherLEtape(TeamWizardRecap, TUNNEL_SANS_NIVEAU);

    await act(async () => { await gabarit.onNext(); });

    expect(createTeam).toHaveBeenCalledTimes(1);
    const envoi = /** @type {any} */ (createTeam).mock.calls[0][0];
    // Pas de chaine vide, pas de `null` : la clef part `undefined`, donc
    // `JSON.stringify` la retire — c'est ce que le serveur attend d'une relation
    // absente, et c'est deja ce que faisait `handleSubmit`.
    expect(envoi.level).toBeUndefined();
    expect(envoi).toMatchObject({
      category: 'cat-1',
      club: 'club-1',
      name: 'U15 Filles',
      section: 'sec-1',
    });
  });
});

describe('AA03 - temoin 2 : l etape le DIT, elle ne se contente pas de s allumer', () => {
  test('sans choix, le bouton s appelle « Continuer sans niveau »', () => {
    const gabarit = afficherLEtape(TeamWizardLevel);

    expect(gabarit.nextLabel).toBe('Continuer sans niveau');
  });

  test('des qu un niveau est choisi, il redevient « Suivant »', () => {
    const gabarit = afficherLEtape(TeamWizardLevel, [{ payload: 'niv-1', type: 'SET_LEVEL' }]);

    expect(gabarit.nextLabel).toBe('Suivant');
    expect(gabarit.isNextDisabled).toBe(false);
  });

  test('en CHARGEMENT, on ne propose pas de passer : on ne sait pas encore', () => {
    mockReferentiels.levels = { data: undefined, error: null, isLoading: true };

    const gabarit = afficherLEtape(TeamWizardLevel);

    expect(gabarit.nextLabel).toBe('Suivant');
    expect(gabarit.isNextDisabled).toBe(true);
  });

  test('en ERREUR, on ne propose pas de passer : une panne n est pas un choix', () => {
    mockReferentiels.levels = {
      data: undefined,
      error: new Error('Failed to fetch'),
      isLoading: false,
    };

    const gabarit = afficherLEtape(TeamWizardLevel);

    expect(gabarit.nextLabel).toBe('Suivant');
    expect(gabarit.isNextDisabled).toBe(true);
  });
});

describe('AA03 - temoin 3 : une etape VRAIMENT obligatoire reste bloquee', () => {
  // La non-regression du lot. Ces trois etapes sont elles aussi optionnelles au
  // content-type, mais elles IDENTIFIENT l'equipe : les ouvrir serait un choix
  // de produit que personne n'a demande. Elles ne recoivent pas `isOptional`.
  test.each([
    ['3/8 Section', TeamWizardSection],
    ['4/8 Sport', TeamWizardActivity],
    ['5/8 Categorie', TeamWizardCategory],
  ])('etape %s - liste pleine, sans choix : « Suivant » et GRIS', (_nom, Ecran) => {
    const gabarit = afficherLEtape(Ecran);

    expect(gabarit.nextLabel).toBe('Suivant');
    expect(gabarit.isNextDisabled).toBe(true);
  });

  test('et le recapitulatif les exige toujours : sans section, il reste gris', () => {
    const gabarit = afficherLEtape(TeamWizardRecap, [
      { payload: 'U15 Filles', type: 'SET_NAME' },
      { payload: 'act-1', type: 'SET_ACTIVITY' },
      { payload: 'cat-1', type: 'SET_CATEGORY' },
      { payload: ['moi'], type: 'SET_TRAINERS' },
    ]);

    expect(gabarit.isNextDisabled).toBe(true);
  });
});
