import { QueryClientProvider } from '@tanstack/react-query';
import renderer, { act } from 'react-test-renderer';

import TeamEdit from '../TeamEdit';

// PERF-2 (D70, 12/11/2026) — « MODIFIER L'EQUIPE » NE RELIT PLUS LES TABLES DE REFERENCE A CHAQUE
// OUVERTURE.
//
// Constat PERF-EQUIPE (10/11) : 7 appels a l'ouverture de l'ecran — la fiche d'equipe (1), le club
// (1 fonction, 2 appels HTTP : la fiche et « A propos »), et les quatre tables de reference
// (sports,
// categories, niveaux, sections) relues a chaque montage, faute de duree de fraicheur.
//
// Ce temoin monte le VRAI ecran sur le VRAI react-query (`createFoundClubQueryClient`, les reglages
// de
// l'app) et compte les appels des fonctions de service :
//   1. premiere ouverture : chaque liste une fois ;
//   2. RE-ouverture juste apres (retour puis « Modifier ») : les quatre tables ne repartent plus,
//      la fiche d'equipe et le club si (rouge avant : 4 tables relues) ;
//   3. apres « Enregistrer », la modification se voit TOUT DE SUITE : la fiche est relue avant le
//      retour
//      et le cache porte le nouveau nom ;
//   4. une table invalidee (le geste qu'une ecriture ferait) se relit malgre la duree de fraicheur.

const mockServices = {
  getActivities: jest.fn(),
  getCategories: jest.fn(),
  getClubByIdWithAssociation: jest.fn(),
  getLevels: jest.fn(),
  getSections: jest.fn(),
  getTeamById: jest.fn(),
  updateTeam: jest.fn(),
};

jest.mock('@/services/activity/activityService', () => ({
  getActivities: (...args) => mockServices.getActivities(...args),
}));
jest.mock('@/services/category/categoryService', () => ({
  getCategories: (...args) => mockServices.getCategories(...args),
}));
jest.mock('@/services/level/levelService', () => ({
  getLevels: (...args) => mockServices.getLevels(...args),
}));
jest.mock('@/services/section/sectionService', () => ({
  getSections: (...args) => mockServices.getSections(...args),
}));
jest.mock('@/services/club/clubService', () => ({
  getClubByIdWithAssociation: (...args) => mockServices.getClubByIdWithAssociation(...args),
  getClubs: jest.fn(),
  getMultisportClubs: jest.fn(),
  getPublicClubById: jest.fn(),
}));
jest.mock('@/services/team/teamService', () => ({
  approveTeamCreation: jest.fn(),
  createTeam: jest.fn(),
  deleteTeam: jest.fn(),
  getTeamById: (...args) => mockServices.getTeamById(...args),
  getTeamDefaultComposition: jest.fn(),
  getTeams: jest.fn(),
  getTeamsAwaitingClubApproval: jest.fn(),
  updateTeam: (...args) => mockServices.updateTeam(...args),
}));

jest.mock('@/domains/auth/authUseCases', () => ({
  ...jest.requireActual('@/domains/auth/authUseCases'),
  getAuthTokens: () => ({ token: 'jeton-de-test' }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => (
      typeof repli === 'string' ? repli : cle
    ),
  }),
}));
jest.mock('@/theme/strings', () => ({ Joi: jest.requireActual('joi') }));
jest.mock('@/theme/themeContext', () => {
  const feuille = {};
  const rampe = () => new Proxy({}, { get: () => feuille });
  return {
    __esModule: true,
    default: () => ({
      Alignments: rampe(),
      ApplicationStyle: new Proxy({}, { get: () => feuille }),
      Colors: new Proxy({}, { get: (_c, cle) => `couleur-${String(cle)}` }),
      Fonts: rampe(),
      Spaces: new Proxy({}, { get: () => rampe() }),
    }),
  };
});
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: { documentId: 'moi', role: { name: 'Dirigeant' } } }),
}));

jest.mock(
  '@/components/molecules/autocompleteSelect/AutocompleteSelect',
  () => function DoublureVide() {
    return null;
  },
);
jest.mock('@/components/atoms/button/Button', () => {
  const reactActuel = jest.requireActual('react');
  const { Text, TouchableOpacity } = jest.requireActual('react-native');
  return function ButtonMock(/** @type {any} */ props) {
    return reactActuel.createElement(
      TouchableOpacity,
      {
        disabled: props.disabled || props.isLoading,
        onPress: props.onPress,
        testID: `bouton-${props.title}`,
      },
      reactActuel.createElement(Text, null, props.title),
    );
  };
});
jest.mock('@/components/atoms/loader/Loader', () => function LoaderMock() {
  return null;
});
jest.mock('@/components/molecules/input/Input', () => function InputMock() {
  return null;
});
jest.mock(
  '@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet',
  () => function DoublureVide() {
    return null;
  },
);
jest.mock(
  '@/components/organisms/autocompleteAddressInput/autocompleteAddressInput',
  () => function DoublureVide() {
    return null;
  },
);
jest.mock(
  '@/components/organisms/createTrainerModal/CreateTrainerModal',
  () => function DoublureVide() {
    return null;
  },
);
jest.mock('@/components/templates/ScreenContainer', () => ({ children }) => children);
jest.mock('react-native-gesture-handler', () => ({
  ScrollView: jest.requireActual('react-native').View,
}));

const { createFoundClubQueryClient } = jest.requireActual('@/app/queryClient');

const SPORTS = [{ documentId: 'sport-1', name: 'Football' }];
const CATEGORIES = [{ documentId: 'categorie-1', name: 'U15' }];
const NIVEAUX = [{ documentId: 'niveau-1', name: 'Regional' }];
const SECTIONS = [{ documentId: 'section-1', name: 'Masculine' }];
const CLUB = { city: 'Lyon', documentId: 'club-1', geohash: 'u05' };
const equipe = (name) => ({
  activities: [SPORTS[0]],
  authorizedMembershipManagers: [],
  category: CATEGORIES[0],
  city: 'Lyon',
  club: { documentId: 'club-1' },
  description: '',
  documentId: 'equipe-1',
  geohash: '',
  level: NIVEAUX[0],
  name,
  section: SECTIONS[0],
  teamMembershipApprovalEnabledForCoaches: true,
  trainers: [],
});

let nomEnBase = 'Seniors A';
const navigation = { goBack: jest.fn(), navigate: jest.fn(), setOptions: jest.fn() };

beforeEach(() => {
  nomEnBase = 'Seniors A';
  Object.values(mockServices).forEach((fn) => fn.mockReset());
  navigation.goBack.mockReset();
  mockServices.getActivities.mockResolvedValue(SPORTS);
  mockServices.getCategories.mockResolvedValue(CATEGORIES);
  mockServices.getLevels.mockResolvedValue(NIVEAUX);
  mockServices.getSections.mockResolvedValue(SECTIONS);
  mockServices.getClubByIdWithAssociation.mockResolvedValue(CLUB);
  mockServices.getTeamById.mockImplementation(async () => equipe(nomEnBase));
  mockServices.updateTeam.mockImplementation(async () => {
    nomEnBase = 'Seniors B';
    return equipe(nomEnBase);
  });
});

const TABLES = ['getActivities', 'getCategories', 'getLevels', 'getSections'];
const compter = () => Object.fromEntries(
  Object.entries(mockServices).map(([nom, fn]) => [nom, fn.mock.calls.length]),
);
const tablesRelues = (avant, apres) => TABLES
  .reduce((total, nom) => total + apres[nom] - avant[nom], 0);

const attendre = async () => {
  await act(async () => {
    await new Promise((r) => {
      setTimeout(r, 20);
    });
  });
};

/**
 * Ouvre « Modifier l'equipe » sur le cache donne, et attend que les lectures se posent.
 * @param {import('@tanstack/react-query').QueryClient} queryClient Le cache de l'app
 *   (survit a la fermeture de l'ecran).
 * @returns {Promise<any>} L'arbre monte.
 */
const ouvrir = async (queryClient) => {
  let arbre;
  act(() => {
    arbre = renderer.create(
      <QueryClientProvider client={queryClient}>
        <TeamEdit
          navigation={/** @type {any} */ (navigation)}
          route={/** @type {any} */ ({ params: { teamId: 'equipe-1' } })}
        />
      </QueryClientProvider>,
    );
  });
  await attendre();
  return arbre;
};

const fermer = (arbre) => act(() => arbre.unmount());

describe('PERF-2 · TeamEdit — les appels a l ouverture', () => {
  /** @type {import('@tanstack/react-query').QueryClient} */
  let queryClient;
  beforeEach(() => {
    queryClient = createFoundClubQueryClient();
  });
  afterEach(() => queryClient.clear());

  it('1 — premiere ouverture : la fiche, le club, et chaque table une fois', async () => {
    const arbre = await ouvrir(queryClient);
    expect(compter()).toEqual({
      getActivities: 1,
      getCategories: 1,
      getClubByIdWithAssociation: 1,
      getLevels: 1,
      getSections: 1,
      getTeamById: 1,
      updateTeam: 0,
    });
    fermer(arbre);
  });

  it('2 — re-ouverture : les 4 tables viennent du cache, fiche et club relus', async () => {
    fermer(await ouvrir(queryClient));
    const avant = compter();
    const arbre = await ouvrir(queryClient);
    const apres = compter();
    // eslint-disable-next-line no-console
    console.log(`[PERF-2] re-ouverture : ${tablesRelues(avant, apres)} table(s) relue(s), `
      + `fiche ${apres.getTeamById - avant.getTeamById}, `
      + `club ${apres.getClubByIdWithAssociation - avant.getClubByIdWithAssociation}`);
    expect(tablesRelues(avant, apres)).toBe(0);
    expect(apres.getTeamById - avant.getTeamById).toBe(1);
    expect(apres.getClubByIdWithAssociation - avant.getClubByIdWithAssociation).toBe(1);
    fermer(arbre);
  });

  it('3 — apres « Enregistrer », la modification se voit tout de suite (fiche relue)', async () => {
    const arbre = await ouvrir(queryClient);
    const avant = compter();
    let ficheRelueAuRetour = null;
    navigation.goBack.mockImplementation(() => {
      ficheRelueAuRetour = queryClient.getQueryData(['team', 'equipe-1'])?.name;
    });
    const bouton = arbre.root.findAll((n) => n.props.testID === 'bouton-teamEdit.actions.save')[0];
    await act(async () => {
      await bouton.props.onPress();
    });
    await attendre();
    const apres = compter();
    expect(apres.updateTeam - avant.updateTeam).toBe(1);
    expect(apres.getTeamById - avant.getTeamById).toBe(1);
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
    expect(ficheRelueAuRetour).toBe('Seniors B');
    fermer(arbre);
  });

  it('4 — une table invalidee se relit malgre la duree de fraicheur', async () => {
    const arbre = await ouvrir(queryClient);
    const avant = compter();
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ['categories'] });
    });
    await attendre();
    expect(compter().getCategories - avant.getCategories).toBe(1);
    fermer(arbre);
  });
});
