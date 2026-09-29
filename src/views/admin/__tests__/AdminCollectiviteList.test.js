import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Alert, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { RouteNames } from '@/navigation/routeNames';
import { getWebRoutePattern } from '@/navigation/webRoutes';

import { ADMIN_COLLECTIVITES_LIST_PAYLOAD } from '@/services/collectivite/collectiviteService';

import { getErrorMessage } from '@/utils/errors/displayError';

import AdminCollectiviteList from '../AdminCollectiviteList';

// 🏛️ D61 (29/09) — ÉCRAN 1 : la liste des collectivités de la console super-admin.
//
// Ce que ce témoin fige (ROUGE avant l écran 1 : le module n existait pas) :
//   - chaque collectivité : nom, type, « Active » / « Inactive » (NULL = inactive, comme le
//     serveur), nombre de clubs rattachés ;
//   - « Activer » ouvre une confirmation qui dit CE QUI VA SE PASSER, nombre de clubs compris,
//     puis appelle `PUT /superadmin/collectivites/:id/active` avec `{ data: { isActive } }` ;
//   - après le geste, la liste est RELUE : l état affiché est celui du serveur ;
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

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
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
/** @type {any} */
let alerte;

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

const carte = (/** @type {any} */ arbre, /** @type {string} */ documentId) => arbre.root.find(
  (/** @type {any} */ n) => n.props?.testID === `admin-collectivite-${documentId}`,
);
const bouton = (/** @type {any} */ noeud, /** @type {string} */ titre) => noeud.find(
  // eslint-disable-next-line max-len
  (/** @type {any} */ n) => n.props?.testID === `bouton-${titre}` && typeof n.props?.onPress === 'function',
);

beforeEach(() => {
  collectivitesServeur = [MONTRIVAGE, VAL, DEPARTEMENT];
  alerte = null;
  [mockGet, mockPost, mockPut, mockDelete].forEach((doublure) => doublure.mockReset());
  mockPost.mockImplementation(async () => reponseListe());
  jest.spyOn(Alert, 'alert').mockImplementation((titre, message, boutons) => {
    alerte = { boutons, message, titre };
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('D61 — écran 1 : la liste des collectivités', () => {
  it('lit la liste par l explorateur super-admin : nom, type, état, clubs rattachés', async () => {
    const arbre = await monter();
    expect(mockPost).toHaveBeenCalledWith(ROUTE_LISTE, ADMIN_COLLECTIVITES_LIST_PAYLOAD);
    expect(textes(carte(arbre, 'ville-montrivage'))).toEqual([
      'Ville de Montrivage', 'Commune', 'Inactive', 'Clubs rattachés : 3', 'Activer',
    ]);
    expect(textes(carte(arbre, 'cc-du-val'))).toEqual([
      // eslint-disable-next-line max-len
      'Communauté de communes du Val', 'Intercommunalité', 'Active', 'Clubs rattachés : 1', 'Couper',
    ]);
    expect(textes(carte(arbre, 'dep-var'))).toEqual([
      'Département du Var', 'Département', 'Inactive', 'Clubs rattachés : 0', 'Activer',
    ]);
    expect(textes(arbre.root)).toContain('Collectivités : 3');
  });

  // eslint-disable-next-line max-len
  it('Activer : la confirmation dit le nombre de clubs, puis PUT …/active { isActive: true }', async () => {
    const arbre = await monter();
    await act(async () => { bouton(carte(arbre, 'ville-montrivage'), 'Activer').props.onPress(); });

    expect(alerte.titre).toBe('Activer la Ville de Montrivage ?');
    expect(alerte.message).toBe(
      // eslint-disable-next-line max-len
      'Les 3 clubs rattachés recevront l’offre Club offerte. Un club qui paie déjà son abonnement n’est pas touché.',
    );
    expect(mockPut).not.toHaveBeenCalled();

    mockPut.mockImplementation(async () => {
      collectivitesServeur = [{ ...MONTRIVAGE, isActive: true }, VAL, DEPARTEMENT];
      return {
        data: {
          data: {
            changed: true,
            clubs: [
              { clubDocumentId: 'as-montrivage', offer: 'granted' },
              { clubDocumentId: 'basket', offer: 'granted' },
              { clubDocumentId: 'montrivage-fc', offer: 'already-paid' },
            ],
            documentId: 'ville-montrivage',
            isActive: true,
          },
        },
      };
    });
    const confirmer = alerte.boutons.find((/** @type {any} */ b) => b.style !== 'cancel');
    expect(confirmer.text).toBe('Activer');
    await act(async () => { confirmer.onPress(); });
    await attendre(() => textes(carte(arbre, 'ville-montrivage')).length === 6);

    expect(mockPut).toHaveBeenCalledTimes(1);
    expect(mockPut).toHaveBeenCalledWith('/superadmin/collectivites/ville-montrivage/active', {
      data: { isActive: true },
    });
    // La liste est RELUE depuis le serveur, et c est elle qui dit « Active ».
    expect(mockPost).toHaveBeenCalledTimes(2);
    expect(textes(carte(arbre, 'ville-montrivage'))).toEqual([
      'Ville de Montrivage', 'Commune', 'Active', 'Clubs rattachés : 3', 'Couper',
      'Activée. Offre posée : 2 · Club qui paie déjà : 1',
    ]);
  });

  it('l état affiché est celui que le serveur RELIT, pas celui qu on a demandé', async () => {
    const arbre = await monter();
    await act(async () => { bouton(carte(arbre, 'ville-montrivage'), 'Activer').props.onPress(); });
    // Le serveur accepte le geste mais sa relecture dit toujours « inactive ».
    mockPut.mockResolvedValue({ data: { data: { changed: false, clubs: [], isActive: true } } });
    await act(async () => { alerte.boutons[1].onPress(); });
    // eslint-disable-next-line max-len
    await attendre(() => mockPost.mock.calls.length === 2 && textes(carte(arbre, 'ville-montrivage')).length === 6);
    expect(mockPost).toHaveBeenCalledTimes(2);
    expect(textes(carte(arbre, 'ville-montrivage')).slice(0, 5)).toEqual([
      'Ville de Montrivage', 'Commune', 'Inactive', 'Clubs rattachés : 3', 'Activer',
    ]);
  });

  // eslint-disable-next-line max-len
  it('Couper : la confirmation dit ce que perd le club, puis PUT …/active { isActive: false }', async () => {
    const arbre = await monter();
    await act(async () => { bouton(carte(arbre, 'cc-du-val'), 'Couper').props.onPress(); });
    expect(alerte.titre).toBe('Couper la Communauté de communes du Val ?');
    expect(alerte.message).toBe(
      // eslint-disable-next-line max-len
      'Le club rattaché perdra l’offre Club offerte par la collectivité. Un club qui paie lui-même garde son abonnement.',
    );
    mockPut.mockImplementation(async () => {
      collectivitesServeur = [MONTRIVAGE, { ...VAL, isActive: false }, DEPARTEMENT];
      return {
        // eslint-disable-next-line max-len
        data: { data: { changed: true, clubs: [{ clubDocumentId: 'club-du-val', offer: 'revoked' }], isActive: false } },
      };
    });
    await act(async () => { alerte.boutons[1].onPress(); });
    await attendre(() => textes(carte(arbre, 'cc-du-val')).length === 6);
    expect(mockPut).toHaveBeenCalledWith('/superadmin/collectivites/cc-du-val/active', {
      data: { isActive: false },
    });
    expect(textes(carte(arbre, 'cc-du-val'))).toEqual([
      // eslint-disable-next-line max-len
      'Communauté de communes du Val', 'Intercommunalité', 'Inactive', 'Clubs rattachés : 1', 'Activer',
      'Coupée. Offre retirée : 1',
    ]);
  });

  it('sans club rattaché, la confirmation le dit ; « Annuler » ne touche à rien', async () => {
    const arbre = await monter();
    await act(async () => { bouton(carte(arbre, 'dep-var'), 'Activer').props.onPress(); });
    expect(alerte.titre).toBe('Activer le Département du Var ?');
    expect(alerte.message).toBe(
      // eslint-disable-next-line max-len
      'Aucun club n’est rattaché pour l’instant : chaque club que tu rattacheras recevra l’offre Club offerte.',
    );
    const annuler = alerte.boutons.find((/** @type {any} */ b) => b.style === 'cancel');
    expect(annuler.text).toBe('Annuler');
    await act(async () => { annuler.onPress?.(); });
    await attendre(() => false);
    expect(mockPut).not.toHaveBeenCalled();
  });

  it('un refus du serveur s affiche sous le bouton ; l état ne bouge pas', async () => {
    const arbre = await monter();
    await act(async () => { bouton(carte(arbre, 'ville-montrivage'), 'Activer').props.onPress(); });
    mockPut.mockRejectedValue({
      response: {
        // eslint-disable-next-line max-len
        data: { error: { details: { code: 'COLLECTIVITE_NOT_FOUND' }, message: 'Collectivite introuvable.', status: 404 } },
        status: 404,
      },
    });
    await act(async () => { alerte.boutons[1].onPress(); });
    await attendre(() => textes(carte(arbre, 'ville-montrivage')).length === 6);
    expect(textes(carte(arbre, 'ville-montrivage'))).toEqual([
      'Ville de Montrivage', 'Commune', 'Inactive', 'Clubs rattachés : 3', 'Activer',
      'Cette collectivité est introuvable : elle a peut-être été supprimée.',
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

  it('la liste n est enregistrée QUE dans AdminStack, et la tuile de la console y mène', () => {
    /** @type {string[]} */
    const hotes = [];
    const parcourir = (/** @type {string} */ dossier) => readdirSync(dossier).forEach((nom) => {
      const chemin = join(dossier, nom);
      if (statSync(chemin).isDirectory()) {
        if (nom !== '__tests__') parcourir(chemin);
      } else if (/\.js$/.test(nom) && /name=\{RouteNames\.AdminCollectiviteList\}/.test(readFileSync(chemin, 'utf8'))) {
        hotes.push(chemin.slice(SRC.length + 1).replace(/\\/g, '/'));
      }
    });
    parcourir(SRC);
    expect(hotes).toEqual(['navigation/private/stacks/AdminStack.js']);
    expect(lire('views/admin/AdminDashboard.js'))
      .toContain('navigation.navigate(RouteNames.AdminCollectiviteList)');
    expect(getWebRoutePattern(RouteNames.AdminCollectiviteList)).toBe('/admin/collectivites');
  });
});
