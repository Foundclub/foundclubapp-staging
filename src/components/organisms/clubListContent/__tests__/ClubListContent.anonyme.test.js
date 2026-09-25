import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import renderer, { act } from 'react-test-renderer';

import { resetAuthRuntimeForTests, syncAuthRuntimeState } from '@/store/authRuntime';

// 🔎 RECHERCHE-UNIQUE, PHASE 1 (25/09) — LE VISITEUR SANS COMPTE QUI TAPE UN NOM
// DE CLUB. Aucune ligne de production n'est touchee par ce fichier.
//
// 🪢 CE QUE CE FICHIER AJOUTE A `ClubListContent.caracterisation.test.js` : le
// filet voisin DOUBLE les crochets de recherche (`useSearchClubs` rend ce qu on
// lui dit de rendre). Il ne peut donc rien voir de la GARDE DE SESSION, qui vit
// justement dans ces crochets (`searchQueries.js:70` et `:95-97`). Ici, les
// crochets sont les VRAIS, le client react-query est un VRAI, et seul le client
// HTTP est double : on regarde donc ce qui part VRAIMENT sur le reseau.
//
// 🔑 LA SESSION N'EST PAS DOUBLEE NON PLUS : on ecrit dans le VRAI magasin
// d'execution (`@/store/authRuntime`), celui que lit `getAuthTokens()` — donc
// celui que lit `hasSession()`. `syncAuthRuntimeState({ auth: null })` est ce
// que fait l'app deconnectee ; `{ auth: { token } }` ce que fait l'app connectee.
//
// 🧭 POURQUOI CE DEFAUT COMPTE AUJOURD'HUI, sans attendre le lot :
//   · ce meme `ClubListContent` est ce que l'app NATIVE montre au visiteur sans
//     compte (`Home.js:133`) ;
//   · le serveur repond deja a `GET /api/search/clubs` sans compte depuis le
//     23/09 (route `auth: false`, ANNUAIRE2 ; mesure du 25/09 : 200) ;
//   · mais `ClubListContent.js:196-221` appelle les crochets SANS
//     `allowAnonymous` : sans jeton, la requete ne part jamais, et l'ecran reste
//     sur « Chargement des clubs » indefiniment.

const mockEtat = {
  recherche: '',
};

const mockChamp = { props: null };

// 🌐 LE SEUL RESEAU DU FICHIER. Chaque chemin rend ce que le serveur rendrait ;
// un chemin inattendu fait echouer la requete (et donc se voit).
const mockGet = jest.fn();

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: {
    get: (/** @type {any[]} */ ...args) => mockGet(...args),
  },
}));

jest.mock('react-i18next', () => ({
  ...jest.requireActual('react-i18next'),
  useTranslation: () => ({
    t: (/** @type {string} */ key, /** @type {any} */ repli) => (
      typeof repli === 'string' ? repli : key
    ),
  }),
}));

jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const genererStyleApp = jest.requireActual('@/theme/applicationStyle').default;
  const Alignments = jest.requireActual('@/theme/alignements').default;
  const Spaces = jest.requireActual('@/theme/spaces').default;
  const Colors = genererCouleurs();
  return {
    __esModule: true,
    default: () => ({
      Alignments,
      ApplicationStyle: genererStyleApp(Colors),
      Colors,
      Fonts: genererPolices(Colors),
      Images: {},
      scheme: 'dark',
      Spaces,
    }),
  };
});

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    addListener: () => () => {},
    getParent: () => undefined,
    navigate: jest.fn(),
    setOptions: jest.fn(),
  }),
}));

// 🎛️ LA LISTE DOUBLEE, comme dans le filet voisin : elle rend son entete, une
// carte par element, et son composant « liste vide » quand il n'y a rien.
jest.mock('@shopify/flash-list', () => {
  const React = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  return {
    FlashList: React.forwardRef((/** @type {any} */ props, /** @type {any} */ ref) => {
      React.useImperativeHandle(ref, () => ({ scrollToOffset: jest.fn() }));
      const elements = props.data || [];
      return (
        <View>
          {props.ListHeaderComponent || null}
          {elements.length === 0 && props.ListEmptyComponent
            ? props.ListEmptyComponent()
            : null}
          {elements.map((/** @type {any} */ item, /** @type {number} */ index) => (
            <View key={item?.documentId || index}>{props.renderItem({ index, item })}</View>
          ))}
        </View>
      );
    }),
  };
});

jest.mock('@/components/molecules/clubCard/ClubCard', () => {
  const { Text } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { item }) => <Text>{`carte:${item?.name || ''}`}</Text>,
  };
});

jest.mock('@/components/organisms/searchComponent/searchComponent', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ props) => {
      mockChamp.props = props;
      return <View testID="champ-recherche" />;
    },
  };
});

jest.mock('@/components/molecules/withDataWrapper/WithDataWrapper', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { children }) => <View>{children}</View>,
  };
});

jest.mock('@/components/atoms/emptyState/EmptyState', () => 'EmptyState');
jest.mock('@/components/atoms/loader/Loader', () => 'Loader');
jest.mock('@/components/atoms/searchMapFab/SearchMapFab', () => 'SearchMapFab');
jest.mock('@/components/organisms/filtersSheet/ClubFiltersSheet', () => 'ClubFiltersSheet');
jest.mock(
  '@/components/molecules/searchResultsLoadingState/SearchResultsLoadingState',
  () => 'SearchResultsLoadingState',
);

jest.mock('@/store/appContext', () => ({
  useAppContext: () => ([
    { clubFilters: { name: mockEtat.recherche }, searchMapSessions: {} },
    jest.fn(),
  ]),
}));

jest.mock('@/domains/club/useClub', () => ({
  __esModule: true,
  default: () => ({ getClubFiltersNumber: () => 0 }),
}));

jest.mock('@/navigation/useBottomDockLayout', () => ({
  __esModule: true,
  default: () => ({ floatingActionBottomOffset: 0, sceneBottomInset: 0 }),
}));

jest.mock('@/navigation/navigationAvailability', () => ({
  navigateToStackScreenOrScreen: jest.fn(),
}));

jest.mock('@/utils/performance/searchPerformance', () => ({ markSearchPerf: jest.fn() }));

const ClubListContent = require('../ClubListContent').default;

const PAGINATION_UNE_PAGE = {
  pagination: {
    page: 1, pageCount: 1, pageSize: 30, total: 1,
  },
};

// Ce que `GET /api/search/clubs?q=stade` rend : une enveloppe de recherche, le
// club dans `payload` (c est `mapSearchPayload` qui l en sort).
const REPONSE_RECHERCHE = {
  data: [{
    matchReasons: [],
    payload: { documentId: 'club-stade', id: 1, name: 'Stade Rennais' },
    score: 1,
  }],
  meta: PAGINATION_UNE_PAGE,
};

// Ce que `GET /api/clubs` (le catalogue par defaut, ouvert sans compte) rend.
const REPONSE_CATALOGUE = {
  data: [{
    address: null, documentId: 'club-catalogue', id: 2, name: 'Olympique Catalogue',
  }],
  meta: PAGINATION_UNE_PAGE,
};

/** @type {any} */
let monte = null;

const demonter = () => {
  if (!monte) return;
  act(() => { monte.unmount(); });
  monte = null;
};

/**
 * Laisse le temps aux vraies requetes react-query de partir, de revenir et
 * d'etre rendues. react-query livre ses notifications par `setTimeout(cb, 0)` :
 * chaque tour laisse passer une horloge reelle a l'interieur d'un `act`.
 * @param {number} [tours] - le nombre de tours d'horloge a laisser passer
 * @returns {Promise<void>} rien
 */
const laisserRepondre = async (tours = 6) => {
  if (tours <= 0) return;
  await act(async () => {
    await new Promise((resoudre) => { setTimeout(resoudre, 0); });
  });
  await laisserRepondre(tours - 1);
};

/**
 * Monte le VRAI composant sous un VRAI client react-query, puis attend les
 * reponses du reseau double.
 * @returns {Promise<void>} rien
 */
const monter = async () => {
  demonter();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    monte = renderer.create(
      <QueryClientProvider client={client}>
        <ClubListContent />
      </QueryClientProvider>,
    );
  });
  await laisserRepondre();
};

const texteRendu = () => JSON.stringify(monte.toJSON());

/**
 * Les chemins appeles sur le client HTTP, dans l'ordre.
 * @returns {string[]} les chemins
 */
const cheminsAppeles = () => mockGet.mock.calls.map((/** @type {any[]} */ appel) => appel[0]);

/**
 * Le constat d'une recherche « stade », en UN objet : quand il est faux, la
 * sortie de jest montre les trois faits d'un coup (requete partie ? carte
 * affichee ? chargement encore la ?) au lieu de s'arreter au premier.
 * @returns {{
 *   carteStadeAffichee: boolean,
 *   chargementAffiche: boolean,
 *   rechercheStadeEnvoyee: boolean,
 * }} les trois faits observes
 */
const constatRechercheStade = () => ({
  carteStadeAffichee: texteRendu().includes('carte:Stade Rennais'),
  chargementAffiche: texteRendu().includes('SearchResultsLoadingState'),
  rechercheStadeEnvoyee: mockGet.mock.calls.some((/** @type {any[]} */ [chemin, config]) => (
    chemin === '/search/clubs' && config?.params?.q === 'stade'
  )),
});

const RECHERCHE_STADE_REUSSIE = {
  carteStadeAffichee: true,
  chargementAffiche: false,
  rechercheStadeEnvoyee: true,
};

const connecte = () => syncAuthRuntimeState({ auth: { token: 'jeton-temoin' } });
const deconnecte = () => syncAuthRuntimeState({ auth: null });

beforeEach(() => {
  resetAuthRuntimeForTests();
  mockEtat.recherche = '';
  mockChamp.props = null;
  mockGet.mockReset();
  mockGet.mockImplementation(async (/** @type {string} */ chemin) => {
    if (chemin === '/search/clubs') return { data: REPONSE_RECHERCHE };
    if (chemin === '/clubs') return { data: REPONSE_CATALOGUE };
    throw new Error(`chemin inattendu dans ce temoin : ${chemin}`);
  });
});

afterEach(() => {
  demonter();
  resetAuthRuntimeForTests();
});

describe('ClubListContent — le visiteur sans compte qui cherche un club (RECHERCHE-UNIQUE)', () => {
  test('✅ temoin A (CONTROLE) — AVEC session, « stade » part et la carte s affiche', async () => {
    // 🔬 Ce temoin prouve que le harnais ATTEINT le chemin de la recherche par
    // pertinence : memes crochets, meme client, meme reseau double que le
    // temoin B. Seule difference : un jeton dans le magasin de session.
    connecte();
    mockEtat.recherche = 'stade';

    await monter();

    expect(constatRechercheStade()).toEqual(RECHERCHE_STADE_REUSSIE);
  });

  // ✅ ROUGE le 25/09 (phase 1), VERT en phase 2 : sans jeton, `useSearchClubs`
  // etait eteint par `enabledWithSession` (searchQueries.js:95-97) parce que
  // `ClubListContent.js` ne lui passait pas `allowAnonymous: true`. Aucune
  // requete ne partait et l'ecran restait sur « Chargement des clubs » sans fin,
  // alors que le serveur repond sans compte depuis le 23/09. Sortie rouge de
  // phase 1 : `rechercheStadeEnvoyee: false`, `carteStadeAffichee: false`,
  // `chargementAffiche: true` (temoin A, meme harnais AVEC jeton, vert).
  test('✅ temoin B — SANS session, « stade » part et la carte s affiche', async () => {
    deconnecte();
    mockEtat.recherche = 'stade';

    await monter();

    expect(constatRechercheStade()).toEqual(RECHERCHE_STADE_REUSSIE);
  });

  test('📌 temoin C — SANS session ni nom tape, le catalogue passe par GET /clubs', async () => {
    // 🔒 Ce qui marche deja pour le visiteur, et que la phase 2 ne doit pas
    // casser : `useGetClubs` n'a pas de garde de session, et `/clubs` est ouvert
    // sans compte. La recherche par pertinence, elle, ne part pas (moins de
    // 2 caracteres).
    deconnecte();
    mockEtat.recherche = '';

    await monter();

    expect(mockGet).toHaveBeenCalledWith(
      '/clubs',
      expect.objectContaining({ params: expect.any(Object) }),
    );
    expect(cheminsAppeles()).not.toContain('/search/clubs');
    expect(texteRendu()).toContain('carte:Olympique Catalogue');
    expect(texteRendu()).not.toContain('SearchResultsLoadingState');
  });
});
