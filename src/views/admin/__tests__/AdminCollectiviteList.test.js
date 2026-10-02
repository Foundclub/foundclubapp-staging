import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Alert, Text, TextInput } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { RouteNames } from '@/navigation/routeNames';
import { getWebRoutePattern } from '@/navigation/webRoutes';

import { ADMIN_COLLECTIVITES_LIST_PAYLOAD } from '@/services/collectivite/collectiviteService';

import { getErrorMessage } from '@/utils/errors/displayError';

import AdminCollectiviteList from '../AdminCollectiviteList';

// 🏛️ D61 (29/09) — ÉCRAN 1 : la liste des collectivités de la console super-admin, RESTYLÉE
// par COLL-CONSOLE (02/10) selon la planche P2-liste (design HY521H1, page 2, écran 2).
//
// Ce que ce témoin fige :
//   - chaque collectivité est une LIGNE qui ouvre sa fiche : nom, « type · n clubs rattachés »,
//     état en pastille (« Active » / « Inactive », NULL = inactive comme le serveur) ;
//   - « Activer / Couper » et « Gérer » ont QUITTÉ la liste (planche P2-liste, « retiré, et
//     pourquoi ») : un geste qui touche l abonnement de plusieurs clubs se fait depuis la
//     fiche, après avoir vu ce qu il change. Ses témoins vivent dans CollectiviteActivation.
//     apercu.test.js et AdminCollectiviteDetail.test.js ;
//   - une recherche par nom (sans casse ni accent) et trois filtres comptés ; un filtre vide
//     le dit, avec le moyen d en sortir ; une liste tronquée par le serveur invite à chercher ;
//   - l état vide porte la création ; sur le site (large), un vrai tableau ;
//   - un compte non super-admin : le serveur répond 403 PAR CET ÉCRAN, qui le dit et
//     n offre aucun bouton ; la rubrique n existe que dans la pile du super-admin.
// Le client HTTP est doublé ; le VRAI i18next (fr.js, pluriels compris) écrit les phrases.

const mockGet = jest.fn();
const mockPost = jest.fn();
const mockPut = jest.fn();
const mockDelete = jest.fn();

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: {
    delete: (...args) => mockDelete(...args),
    get: (...args) => mockGet(...args),
    post: (...args) => mockPost(...args),
    put: (...args) => mockPut(...args),
  },
}));

const mockNavigate = jest.fn();
let mockLargeur = 390;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({
    fontScale: 1, height: 800, scale: 1, width: mockLargeur,
  }),
}));
jest.mock('@/components/molecules/segmentedControl/SegmentedControl', () => {
  const reactActuel = jest.requireActual('react');
  // eslint-disable-next-line max-len
  const { Text: TexteRN, TouchableOpacity: PressableRN, View: Vue } = jest.requireActual('react-native');
  return function SegmentedControlMock(/** @type {any} */ { onChange, options, value }) {
    return reactActuel.createElement(Vue, null, options.map((option) => reactActuel.createElement(
      PressableRN,
      {
        accessibilityState: { selected: option.value === value },
        key: option.value,
        onPress: () => onChange(option.value),
        testID: `filtre-${option.value}`,
      },
      reactActuel.createElement(TexteRN, null, option.label),
    )));
  };
});

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {any[]} */ ...args) => jest.requireActual('i18next').t(...args),
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
      Images: {},
      Spaces: espaces,
    }),
  };
});

jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) { return children; },
);
jest.mock('@/components/atoms/loader/Loader', () => function LoaderMock() { return null; });
jest.mock('@/components/atoms/button/Button', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
  return function ButtonMock(/** @type {any} */ props) {
    return reactActuel.createElement(
      PressableRN,
      { disabled: props.disabled, onPress: props.onPress, testID: `bouton-${props.title}` },
      reactActuel.createElement(TexteRN, null, props.title),
    );
  };
});

const ROUTE_LISTE = '/superadmin/content/api%3A%3Acollectivite.collectivite/list';
const MONTRIVAGE = {
  // eslint-disable-next-line max-len
  clubs: [{ documentId: 'as-montrivage' }, { documentId: 'montrivage-fc' }, { documentId: 'basket' }],
  documentId: 'ville-montrivage',
  isActive: null,
  name: 'Ville de Montrivage',
  type: 'commune',
};
const VAL = {
  clubs: [{ documentId: 'club-du-val' }],
  documentId: 'cc-du-val',
  isActive: true,
  name: 'Communauté de communes du Val',
  type: 'intercommunalite',
};
const DEPARTEMENT = {
  clubs: [],
  documentId: 'dep-var',
  isActive: false,
  name: 'Département du Var',
  type: 'departement',
};

/** @type {any[]} */
let collectivitesServeur;

const reponseListe = () => ({
  data: {
    data: collectivitesServeur.map((ligne) => ({ ...ligne })),
    meta: {
      pagination: {
        page: 1, pageCount: 1, pageSize: 100, total: collectivitesServeur.length,
      },
    },
  },
});

/**
 * Aplati les enfants React en une chaine.
 * @param {any} enfants
 * @returns {string}
 */
const aplatirTexte = (enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatirTexte).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatirTexte(enfants?.props?.children);
  return String(enfants);
};

const textes = (/** @type {any} */ noeud) => noeud.findAllByType(Text)
  .map((/** @type {any} */ n) => aplatirTexte(n.props.children).trim());

/**
 * Laisse tourner react-query jusqu a ce que la condition tienne (borne : un PC charge
 * met plus d un tour, memoire chantier-COLL1C-ma-collectivite).
 * @param {() => boolean} condition - Ce qu on attend.
 * @returns {Promise<void>}
 */
const attendre = async (condition) => {
  for (let i = 0; i < 80 && !condition(); i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => { await new Promise((fin) => { setImmediate(fin); }); });
  }
};

const monter = async () => {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { gcTime: 0, retry: false } },
  });
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <QueryClientProvider client={client}>
        <AdminCollectiviteList />
      </QueryClientProvider>,
    );
  });
  await attendre(() => !textes(arbre.root).includes('Lecture des collectivités…'));
  return arbre;
};

const carte = (/** @type {any} */ arbre, /** @type {string} */ documentId) => arbre.root.findAll(
  (/** @type {any} */ n) => n.props?.testID === `admin-collectivite-${documentId}`,
)[0];
// eslint-disable-next-line max-len
const parTestIDListe = (/** @type {any} */ arbre, /** @type {string} */ testID) => arbre.root.findAll(
  (/** @type {any} */ n) => n.props?.testID === testID,
)[0];
const bouton = (/** @type {any} */ noeud, /** @type {string} */ titre) => noeud.find(
  // eslint-disable-next-line max-len
  (/** @type {any} */ n) => n.props?.testID === `bouton-${titre}` && typeof n.props?.onPress === 'function',
);

beforeEach(() => {
  mockLargeur = 390;
  collectivitesServeur = [MONTRIVAGE, VAL, DEPARTEMENT];
  // eslint-disable-next-line max-len
  [mockGet, mockPost, mockPut, mockDelete, mockNavigate].forEach((doublure) => doublure.mockReset());
  mockPost.mockImplementation(async () => reponseListe());
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('D61 — écran 1 : la liste des collectivités (planche P2-liste)', () => {
  // eslint-disable-next-line max-len
  it('lit la liste par l explorateur super-admin ; chaque ligne : nom, « type · clubs », état', async () => {
    const arbre = await monter();
    expect(mockPost).toHaveBeenCalledWith(ROUTE_LISTE, ADMIN_COLLECTIVITES_LIST_PAYLOAD);
    expect(textes(carte(arbre, 'ville-montrivage'))).toEqual([
      'M', 'Ville de Montrivage', 'Commune · 3 clubs rattachés', 'Inactive',
    ]);
    expect(textes(carte(arbre, 'cc-du-val'))).toEqual([
      'V', 'Communauté de communes du Val', 'Intercommunalité · 1 club rattaché', 'Active',
    ]);
    expect(textes(carte(arbre, 'dep-var'))).toEqual([
      'V', 'Département du Var', 'Département · 0 club rattaché', 'Inactive',
    ]);
    expect(carte(arbre, 'ville-montrivage').props.accessibilityLabel)
      .toBe('Ville de Montrivage, Commune, Inactive, 3 clubs rattachés');
    // L en-tête : un titre, et la phrase qui dit ce qu est une collectivité active.
    expect(textes(arbre.root)).toEqual(expect.arrayContaining([
      'CONSOLE',
      'Collectivités',
      // eslint-disable-next-line max-len
      'Une collectivité active offre l’offre Club à ses clubs rattachés, sauf à ceux qui paient déjà. Ouvre sa fiche pour l’activer ou la couper.',
    ]));
    expect(textes(arbre.root)).not.toContain('Collectivités : 3');
  });

  // eslint-disable-next-line max-len
  it('toute la ligne ouvre la fiche ; « Activer / Couper » et « Gérer » ont quitté la liste', async () => {
    const arbre = await monter();
    const lus = textes(arbre.root);
    ['Activer', 'Couper', 'Gérer'].forEach((geste) => expect(lus).not.toContain(geste));
    await act(async () => { carte(arbre, 'cc-du-val').props.onPress(); });
    expect(mockNavigate).toHaveBeenCalledWith(RouteNames.AdminCollectiviteDetail, {
      collectiviteId: 'cc-du-val',
    });
    expect(mockPut).not.toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('trois filtres comptés, et une recherche par nom sans casse ni accent', async () => {
    const arbre = await monter();
    expect(textes(arbre.root)).toEqual(expect.arrayContaining([
      'Toutes (3)', 'Actives (1)', 'Inactives (2)',
    ]));
    const visibles = () => ['ville-montrivage', 'cc-du-val', 'dep-var']
      // eslint-disable-next-line max-len
      .filter((id) => arbre.root.findAll((n) => n.props?.testID === `admin-collectivite-${id}`).length > 0);

    await act(async () => { parTestIDListe(arbre, 'filtre-inactive').props.onPress(); });
    expect(visibles()).toEqual(['ville-montrivage', 'dep-var']);
    await act(async () => { parTestIDListe(arbre, 'filtre-active').props.onPress(); });
    expect(visibles()).toEqual(['cc-du-val']);
    await act(async () => { parTestIDListe(arbre, 'filtre-all').props.onPress(); });

    // eslint-disable-next-line max-len
    const champ = arbre.root.findAllByType(TextInput).find((n) => n.props.testID === 'collectivites-recherche');
    expect(champ.props.placeholder).toBe('Chercher une collectivité');
    await act(async () => { champ.props.onChangeText('DEPARTEMENT'); });
    expect(visibles()).toEqual(['dep-var']);
  });

  it('un filtre sans résultat le dit, avec le moyen d en sortir', async () => {
    collectivitesServeur = [VAL];
    const arbre = await monter();
    await act(async () => { parTestIDListe(arbre, 'filtre-inactive').props.onPress(); });
    expect(textes(parTestIDListe(arbre, 'collectivites-filtre-vide'))).toEqual([
      'Aucune collectivité inactive.', 'Voir toutes les collectivités',
    ]);
    await act(async () => { bouton(arbre.root, 'Voir toutes les collectivités').props.onPress(); });
    // eslint-disable-next-line max-len
    expect(arbre.root.findAll((n) => n.props?.testID === 'admin-collectivite-cc-du-val').length).toBeGreaterThan(0);
  });

  it('l état vide porte la création ; « Créer une collectivité » ouvre le formulaire', async () => {
    collectivitesServeur = [];
    const arbre = await monter();
    expect(textes(parTestIDListe(arbre, 'collectivites-vide'))).toEqual([
      'Aucune collectivité pour l’instant.',
      'Crée la première mairie cliente : elle naîtra inactive.',
      'Créer une collectivité',
    ]);
    // eslint-disable-next-line max-len
    await act(async () => { bouton(parTestIDListe(arbre, 'collectivites-vide'), 'Créer une collectivité').props.onPress(); });
    expect(mockNavigate).toHaveBeenCalledWith(RouteNames.AdminCollectiviteForm);
  });

  it('« Créer une collectivité » en tête de la liste ouvre le formulaire', async () => {
    const arbre = await monter();
    await act(async () => { bouton(arbre.root, 'Créer une collectivité').props.onPress(); });
    expect(mockNavigate).toHaveBeenCalledWith(RouteNames.AdminCollectiviteForm);
  });

  it('une liste tronquée par le serveur le dit, et invite à chercher', async () => {
    mockPost.mockImplementation(async () => ({
      data: { ...reponseListe().data, meta: { pagination: { total: 140 } } },
    }));
    const arbre = await monter();
    // eslint-disable-next-line max-len
    expect(textes(arbre.root)).toContain('3 affichées sur 140. Cherche par le nom pour trouver les autres.');
  });

  it('sur le site (large) : un vrai tableau — Collectivité, État, Clubs rattachés', async () => {
    mockLargeur = 1280;
    const arbre = await monter();
    // eslint-disable-next-line max-len
    expect(textes(arbre.root)).toEqual(expect.arrayContaining(['Collectivité', 'État', 'Clubs rattachés']));
    expect(textes(carte(arbre, 'ville-montrivage'))).toEqual([
      'M', 'Ville de Montrivage', 'Commune', 'Inactive', '3',
    ]);
  });

  // eslint-disable-next-line max-len
  it('un compte non super-admin : le serveur répond 403, l écran le dit et n offre aucun geste', async () => {
    const refus = {
      response: {
        data: {
          data: null,
          error: {
            details: {}, message: 'Forbidden', name: 'PolicyError', status: 403,
          },
        },
        status: 403,
      },
    };
    mockPost.mockRejectedValue(refus);
    const arbre = await monter();
    const lus = textes(arbre.root);
    expect(lus).toContain('Collectivités indisponibles');
    expect(lus).toContain(getErrorMessage(refus));
    expect(getErrorMessage(refus)).not.toBe('');
    expect(lus).not.toContain('Activer');
    expect(lus).not.toContain('Couper');
    expect(mockPut).not.toHaveBeenCalled();
  });
});

describe('D61 — la porte : seul un SuperAdmin voit la rubrique', () => {
  const SRC = join(__dirname, '..', '..', '..');
  const lire = (/** @type {string} */ chemin) => readFileSync(join(SRC, chemin), 'utf8');

  it('la pile AdminStack n est montée que pour un SuperAdmin', () => {
    const navigateur = lire('navigation/private/PrivateNavigator.js');
    expect(navigateur).toMatch(
      /\{isSuperAdmin \? \(\s*<Stack\.Screen\s+getComponent=\{\(\) => require\('\.\/stacks\/AdminStack'\)\.default\}\s+name=\{RouteNames\.AdminStack\}/,
    );
    expect(navigateur).toMatch(/const isSuperAdmin = getUserRoleKey\([^)]*\) === 'superAdmin';/);
  });

  it('les écrans de la rubrique ne sont enregistrés QUE dans AdminStack ; la tuile y mène', () => {
    /** @type {string[]} */
    const hotes = [];
    const parcourir = (/** @type {string} */ dossier) => readdirSync(dossier).forEach((nom) => {
      const chemin = join(dossier, nom);
      if (statSync(chemin).isDirectory()) {
        if (nom !== '__tests__') parcourir(chemin);
      } else if (/\.js$/.test(nom) && /name=\{RouteNames\.AdminCollectivite(List|Detail|Form)\}/.test(readFileSync(chemin, 'utf8'))) {
        hotes.push(chemin.slice(SRC.length + 1).replace(/\\/g, '/'));
      }
    });
    parcourir(SRC);
    expect(hotes).toEqual(['navigation/private/stacks/AdminStack.js']);
    const pile = lire('navigation/private/stacks/AdminStack.js');
    expect(pile).toContain('name={RouteNames.AdminCollectiviteList}');
    expect(pile).toContain('name={RouteNames.AdminCollectiviteDetail}');
    expect(pile).toContain('name={RouteNames.AdminCollectiviteForm}');
    expect(lire('views/admin/AdminDashboard.js'))
      .toContain('navigation.navigate(RouteNames.AdminCollectiviteList)');
    expect(getWebRoutePattern(RouteNames.AdminCollectiviteList)).toBe('/admin/collectivites');
    expect(getWebRoutePattern(RouteNames.AdminCollectiviteDetail))
      .toBe('/admin/collectivites/:collectiviteId');
    expect(getWebRoutePattern(RouteNames.AdminCollectiviteForm)).toBe('/admin/collectivites/new');
  });
});
