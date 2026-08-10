import renderer, { act } from 'react-test-renderer';

import RecrutementListContent from '../RecrutementListContent';

// L35 (E6) : RecrutementListContent.js fait 1 301 lignes, recruitmentFlow.js
// porte toute la logique d'onglets par role, et NI L'UN NI L'AUTRE n'avait de
// test. Ce fichier fige le comportement des sous-onglets AVANT d'y toucher.
//
// D57 : deux onglets de GESTION sont partis vers « Mes activites » — l'ecran
// Rechercher explore, il ne gere plus. Cote staff il reste « Profils /
// Opportunites / Candidatures », cote joueur plus aucun segmente. Les temoins
// du retrait vivent ici, a cote de ceux qui figent ce qui reste.
//
// Il ne decrit AUCUN pixel : les onglets sont pilotes par le TEXTE VISIBLE
// (« Opportunites », « Candidatures »...) et l'onglet actif se lit a une phrase
// que lui seul affiche. Une refonte de mise en page peut donc tout deplacer
// sans qu'une ligne d'ici ne bouge.
//
// Les 3 marqueurs d'onglet actif, choisis parce qu'ils n'apparaissent NULLE
// PART ailleurs (le libelle de l'onglet, lui, est toujours rendu — c'est le
// bouton) : voir MARQUEURS ci-dessous.

// Le premier rendu monte une VRAIE FlatList et de VRAIES cartes d'annonce :
// c'est voulu, c'est ce que l'utilisateur voit. Meme raison que le filet
// FriendlyMatchListContent : la valeur par defaut de 5 s tombe quand toute la
// base tourne en parallele, et un filet qui tombe une fois sur deux ne protege
// rien.
jest.setTimeout(30000);

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  // useFocusEffect rejoue son rappel quand l'ecran prend le focus : au montage,
  // un useEffect en est l'equivalent fidele, et c'est lui qui declenche le
  // rechargement d'onglet qu'on veut observer.
  useFocusEffect: (/** @type {any} */ callback) => {
    // eslint-disable-next-line global-require
    const { useEffect } = require('react');
    useEffect(callback, [callback]);
  },
  useNavigation: () => ({ navigate: mockNavigate }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => (
      typeof repli === 'string' ? repli : cle
    ),
  }),
}));

// react-native-reanimated est publie en ESM pur et n'est pas dans
// transformIgnorePatterns (jest.config.js) : sans ce mock, importer la carte
// d'annonce suffit a faire tomber la suite.
jest.mock('react-native-reanimated', () => {
  // eslint-disable-next-line global-require
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: { View },
    useAnimatedStyle: () => ({}),
    useSharedValue: (/** @type {any} */ value) => ({ value }),
    withTiming: (/** @type {any} */ value) => value,
  };
});

jest.mock('react-native-linear-gradient', () => 'LinearGradient');

// D57 : l'ecran porte desormais la feuille de filtres, donc BottomModal, donc
// @gorhom/bottom-sheet — publie en ESM et hors transformIgnorePatterns. On garde
// la seule chose qui compte ici : le contenu n'existe que si `isVisible`, ce qui
// permet de voir depuis ce test si le bouton de filtres l'ouvre vraiment.
jest.mock('@/components/molecules/bottomModal/BottomModal', () => {
  // eslint-disable-next-line global-require
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { children, isVisible }) => (
      isVisible ? <View testID="sheet">{children}</View> : null
    ),
  };
});

jest.mock('@/services/activity/activityQueries', () => ({
  useGetActivities: () => ({ data: [] }),
}));
jest.mock('@/services/category/categoryQueries', () => ({
  useGetCategories: () => ({ data: [] }),
}));
jest.mock('@/services/level/levelQueries', () => ({
  useGetLevels: () => ({ data: [] }),
}));

/** @type {any} */
let mockUserData;
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: mockUserData }),
}));

// Le VRAI theme, sans le contexte React qui le porte : un mock en Proxy rend
// les echecs Jest illisibles (constat du lot paywall, 2026-08-02), et un objet
// invente masquerait un jeton absent. `Images` est le seul element stub, pour
// ne pas faire dependre ce test de la resolution des fichiers d'assets.
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
      Images: { pin: 1 },
      Spaces: espaces,
    }),
  };
});

// La valeur du contexte doit etre STABLE d'un rendu a l'autre : la rendre
// neuve a chaque appel relance `fetchAdsForPlayer` (qui en depend) a chaque
// rendu, et la suite tourne en boucle sans jamais rendre la main.
let mockEtatApplicatif = [{ recruitmentAdFilters: {} }, () => {}];
jest.mock('@/store/appContext', () => ({ useAppContext: () => mockEtatApplicatif }));

/**
 * Repose un etat applicatif FIGE portant ces filtres. La valeur doit rester la
 * meme d'un rendu a l'autre : la rendre neuve a chaque appel relance
 * `fetchAdsForPlayer` (qui en depend) sans fin.
 * @param {any} recruitmentAdFilters Les filtres deja poses.
 * @returns {void} Rien.
 */
const poserFiltres = (recruitmentAdFilters) => {
  mockEtatApplicatif = [{ recruitmentAdFilters }, jest.fn()];
};

const mockGetRecruitmentAds = jest.fn();
const mockGetMyRecruitmentAds = jest.fn();
const mockGetMyApplications = jest.fn();
// Le service est double ENTIEREMENT, y compris ses fonctions pures : le charger
// pour de vrai importe le client HTTP, qui refuse de se charger sans API_URL
// (`[CONFIG][runtime-endpoints]`). Les doublures des fonctions pures sont
// volontairement neutres — ce test parle d'ONGLETS, pas de visibilite d'annonce.
jest.mock('@/services/recruitment/recruitmentService', () => ({
  applyToRecruitmentAd: jest.fn(),
  buildDetectionApplicationStatusMap: () => ({}),
  filterVisibleRecruitmentAds: (/** @type {any[]} */ ads) => ads,
  getMyApplications: (/** @type {any} */ user) => mockGetMyApplications(user),
  getMyRecruitmentAds: (/** @type {any} */ filters) => mockGetMyRecruitmentAds(filters),
  getRecruitmentAds: (/** @type {any} */ filters) => mockGetRecruitmentAds(filters),
  resolveRecruitmentAdApplicationState: () => ({
    hasApplied: false,
    linkedRecruitmentAdDocumentId: '',
    status: '',
  }),
}));

const mockSearchRecruitment = jest.fn();
jest.mock('@/services/search/searchService', () => ({
  getMatchReasonLabel: () => '',
  mapSearchPayload: (/** @type {any} */ reponse) => (reponse?.data || []).map(
    (/** @type {any} */ entree) => ({ ...entree.payload }),
  ),
  searchRecruitment: (/** @type {any} */ params) => mockSearchRecruitment(params),
}));

const mockUseSearchProfiles = jest.fn();
jest.mock('@/services/search/searchQueries', () => ({
  useSearchProfiles: (/** @type {any} */ params, /** @type {any} */ options) => (
    mockUseSearchProfiles(params, options)
  ),
}));

// La barre de recherche partagee n'est pas l'objet de ce test — mais son bouton
// de filtres l'est depuis D57 : la doublure expose donc `openFilters` et le
// compte de la pastille, et rien d'autre.
jest.mock('@/components/organisms/searchComponent/searchComponent', () => {
  // eslint-disable-next-line global-require
  const { Text, TouchableOpacity, View } = require('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { filterNumber, openFilters }) => (
      <View testID="search-bar">
        <TouchableOpacity onPress={openFilters}>
          <Text>{`Filtres ${filterNumber || 0}`}</Text>
        </TouchableOpacity>
      </View>
    ),
  };
});

jest.mock('@/utils/performance/searchPerformance', () => ({ markSearchPerf: jest.fn() }));
jest.mock('@/navigation/public/publicAuthNavigation', () => ({ openPublicAuthFlow: jest.fn() }));

// MARQUEURS : une phrase que SEUL l'onglet concerne affiche. Le libelle du
// bouton ne peut pas servir — il est rendu en permanence.
const MARQUEUR = {
  annonces: 'Consulte et gère les annonces publiées pour tes équipes.',
  candidatures: 'Suivi de tes candidatures',
  opportunites: 'Compatibles avec mon profil',
  profils: 'Profils ouverts au recrutement',
};

// Un Dirigeant AVEC une equipe : c'est le cas reel (compte de recette), et le
// message de liste vide en depend — sans equipe geree, l'ecran dit « Aucune
// annonce creee » au lieu de « Aucune annonce publiee pour tes equipes ».
const DIRIGEANT = {
  documentId: 'u-dirigeant',
  myTeams: [{ documentId: 'team-1', name: 'CD Senior' }],
  role: { name: 'Dirigeant' },
};
const JOUEUR = { documentId: 'u-joueur', role: { name: 'Joueur' } };

// `sport` est un champ SCALAIRE cote serveur (il est filtre en `$eqi`, il n'est
// pas dans le `populate`) : la carte le rend tel quel. Lui donner un objet
// `{ name }` fait tomber le rendu — piege paye pendant l'ecriture de ce filet.
const ANNONCE_PUBLIQUE = {
  category: { name: 'U17' },
  city: 'Lyon',
  documentId: 'ad-publique',
  isActive: true,
  level: { name: 'Regional' },
  positions: ['Gardien'],
  sport: 'Football',
  team: { club: { name: 'Olympique Public' }, name: 'OP U17' },
  title: 'Recherche gardien U17',
};

const PROFIL_OUVERT = {
  category: 'U17',
  city: 'Lyon',
  documentId: 'p-1',
  firstname: 'Lucas',
  lastname: 'Martin',
  position: 'Gardien',
  username: 'Lucas Martin',
};

const MON_ANNONCE = {
  city: 'Lille',
  documentId: 'ad-a-moi',
  isActive: true,
  team: { club: { name: 'Club des Dirigeants' }, name: 'CD Senior' },
  title: 'Recherche attaquant senior',
};

const MA_CANDIDATURE = {
  city: 'Nantes',
  documentId: 'ad-candidature',
  isActive: true,
  team: { club: { name: 'Club Postule' }, name: 'CP U19' },
  title: 'Recherche milieu U19',
};

/**
 * Tous les textes rendus, aplatis. On parcourt les enfants plutot que de
 * serialiser l'arbre : les props d'une FlatList sont circulaires.
 * @param {any} node
 * @returns {string[]}
 */
const collectText = (node) => {
  if (node === null || node === undefined) return [];
  if (typeof node === 'string') return [node];
  if (Array.isArray(node)) return node.flatMap(collectText);
  return collectText(node.children);
};

/**
 * Le texte visible du rendu, en une seule chaine cherchable.
 * @param {any} tree
 * @returns {string}
 */
const texteVisible = (tree) => collectText(tree.toJSON()).join(' | ');

/**
 * Le texte porte par un noeud de l'arbre de test (instances ou chaines).
 * @param {any} node
 * @returns {string}
 */
const texteDuNoeud = (node) => {
  if (typeof node === 'string') return node;
  if (!node || !Array.isArray(node.children)) return '';
  return node.children.map(texteDuNoeud).join('');
};

/**
 * Rend le contenu recrutement pour un utilisateur donne.
 * @param {any} userData
 * @param {any} props
 * @returns {Promise<any>}
 */
const rendrePour = async (userData, props = {}) => {
  mockUserData = userData;
  /** @type {any} */
  let tree;
  await act(async () => {
    tree = renderer.create(<RecrutementListContent {...props} />);
  });
  return tree;
};

/**
 * Appuie sur l'element pressable qui porte EXACTEMENT ce libelle.
 * @param {any} tree
 * @param {string} libelle
 * @returns {Promise<void>}
 */
const appuyerSur = async (tree, libelle) => {
  const cibles = tree.root.findAll(
    (/** @type {any} */ node) => (
      typeof node.props?.onPress === 'function' && texteDuNoeud(node).trim() === libelle
    ),
    { deep: true },
  );
  if (cibles.length === 0) {
    throw new Error(`Aucun element pressable ne porte le libelle « ${libelle} »`);
  }
  await act(async () => {
    cibles[0].props.onPress();
  });
};

/**
 * Le nom de l'onglet actuellement affiche, lu au marqueur.
 * @param {any} tree
 * @returns {string}
 */
const ongletAffiche = (tree) => {
  const rendu = texteVisible(tree);
  const trouves = Object.entries(MARQUEUR)
    .filter(([, marqueur]) => rendu.includes(marqueur))
    .map(([nom]) => nom);
  if (trouves.length !== 1) {
    return `INDETERMINE (${trouves.length} marqueurs : ${trouves.join(', ') || 'aucun'})`;
  }
  return trouves[0];
};

/**
 * Le retour de la requete de profils, avec ou sans resultat.
 * @param {any[]} profils
 * @returns {any}
 */
const requeteProfils = (profils) => ({
  data: { pages: [{ data: profils.map((profil) => ({ payload: profil, score: 1 })), meta: {} }] },
  fetchNextPage: jest.fn(),
  hasNextPage: false,
  isError: false,
  isFetching: false,
  isFetchingNextPage: false,
  isLoading: false,
  refetch: jest.fn(),
});

beforeEach(() => {
  jest.clearAllMocks();
  poserFiltres({});
  mockGetRecruitmentAds.mockResolvedValue({ data: [ANNONCE_PUBLIQUE], meta: {} });
  mockGetMyRecruitmentAds.mockResolvedValue([MON_ANNONCE]);
  mockGetMyApplications.mockResolvedValue([MA_CANDIDATURE]);
  mockSearchRecruitment.mockResolvedValue({ data: [], meta: {} });
  mockUseSearchProfiles.mockReturnValue(requeteProfils([PROFIL_OUVERT]));
});

describe('RecrutementListContent — on peut changer d onglet (L35)', () => {
  it('LE TEMOIN : un Dirigeant qui appuie sur « Opportunités » change vraiment d onglet', async () => {
    const tree = await rendrePour(DIRIGEANT, { initialTab: 'profils' });
    expect(ongletAffiche(tree)).toBe('profils');

    await appuyerSur(tree, 'Opportunités');

    expect(ongletAffiche(tree)).toBe('opportunites');
  });

  it('un Dirigeant atteint ses 3 onglets, dans n importe quel ordre', async () => {
    const tree = await rendrePour(DIRIGEANT, { initialTab: 'profils' });

    await appuyerSur(tree, 'Candidatures');
    expect(ongletAffiche(tree)).toBe('candidatures');

    await appuyerSur(tree, 'Opportunités');
    expect(ongletAffiche(tree)).toBe('opportunites');

    await appuyerSur(tree, 'Profils');
    expect(ongletAffiche(tree)).toBe('profils');
  });

  // D57 : le joueur n'a plus qu'un marche a explorer ici. Ses candidatures ont
  // demenage dans « Mes activites › Mes reponses », atteint depuis l'Accueil
  // (HomeHub, case « Mes reponses »). Un segmente a un seul bouton ne choisit
  // rien : il a disparu avec l'onglet.
  it('un Joueur n a plus de segmente : il explore, il ne gere plus ici', async () => {
    const tree = await rendrePour(JOUEUR, { initialTab: 'annonces' });

    expect(ongletAffiche(tree)).toBe('opportunites');
    expect(texteVisible(tree)).not.toContain('Mes candidatures');
  });
});

// Les 3 onglets autres que « Profils » n'ont JAMAIS ete atteignables avant ce
// lot : rien ne disait ce qu'ils affichent. Ce bloc le fige, pour qu'une
// prochaine refonte ne puisse pas les casser en silence.
describe('RecrutementListContent — ce que chaque onglet affiche (relevé L35)', () => {
  it('Profils : le titre, la recherche, et une carte par profil ouvert', async () => {
    const tree = await rendrePour(DIRIGEANT, { initialTab: 'profils' });
    const rendu = texteVisible(tree);

    expect(rendu).toContain('Profils ouverts au recrutement');
    expect(rendu).toContain('Lucas');
    expect(rendu).toContain('Voir le profil');
    // L'onglet Profils ne declenche AUCUN appel d'annonces.
    expect(mockGetRecruitmentAds).not.toHaveBeenCalled();
    expect(mockGetMyRecruitmentAds).not.toHaveBeenCalled();
  });

  // D35 : « on publie depuis Rechercher ». Avant ce lot, le seul bouton de
  // publication vivait dans « Mes annonces » — un onglet de GESTION. Un
  // dirigeant qui parcourait les profils n'avait aucun moyen de publier.
  it('Profils : le dirigeant peut publier une offre sans changer d onglet', async () => {
    const tree = await rendrePour(DIRIGEANT, { initialTab: 'profils' });

    expect(texteVisible(tree)).toContain('+ Publier une offre');
  });

  it('Profils : un joueur n a PAS de bouton de publication', async () => {
    const tree = await rendrePour(JOUEUR, { initialTab: 'annonces' });

    expect(texteVisible(tree)).not.toContain('+ Publier une offre');
  });

  it('Opportunités : les annonces publiques, triées « compatibles » d abord', async () => {
    const tree = await rendrePour(DIRIGEANT, { initialTab: 'profils' });
    await appuyerSur(tree, 'Opportunités');
    const rendu = texteVisible(tree);

    expect(rendu).toContain('Compatibles avec mon profil');
    expect(rendu).toContain('Olympique Public');
    expect(rendu).toContain('Postuler');
    expect(mockGetRecruitmentAds).toHaveBeenCalled();
  });

  // D57 — LE TEMOIN DU RETRAIT. « Mes annonces » etait un onglet de GESTION
  // pose dans un ecran d'EXPLORATION. Il est repris par « Mes activites ›
  // Publications », qui lit exactement la meme source (getMyRecruitmentAds).
  // Ce qui compte ici : l'ecran ne le charge PLUS, donc plus personne ne paie
  // une requete pour une liste que rien n'affiche.
  it('« Mes annonces » a quitté cet écran, et sa liste n est plus chargée', async () => {
    const tree = await rendrePour(DIRIGEANT, { initialTab: 'profils' });
    const rendu = texteVisible(tree);

    expect(rendu).not.toContain('Mes annonces');
    expect(rendu).not.toContain('Consulte et gère les annonces publiées pour tes équipes.');
    expect(mockGetMyRecruitmentAds).not.toHaveBeenCalled();
  });

  // Ce que le retrait ne devait PAS emporter : D35 avait deplace le bouton de
  // publication sur l'onglet d'exploration justement pour qu'il survive a ce
  // demenagement.
  it('le dirigeant garde son bouton de publication, hors de tout onglet de gestion', async () => {
    const tree = await rendrePour(DIRIGEANT, { initialTab: 'profils' });

    expect(texteVisible(tree)).toContain('+ Publier une offre');
  });

  it('Candidatures : les annonces auxquelles j ai postulé', async () => {
    const tree = await rendrePour(DIRIGEANT, { initialTab: 'candidatures' });
    const rendu = texteVisible(tree);

    expect(rendu).toContain('Suivi de tes candidatures');
    expect(rendu).toContain('Club Postule');
    expect(mockGetMyApplications).toHaveBeenCalled();
  });

  it('à vide, chaque onglet dit quoi faire au lieu de laisser une page blanche', async () => {
    mockGetRecruitmentAds.mockResolvedValue({ data: [], meta: {} });
    mockGetMyRecruitmentAds.mockResolvedValue([]);
    mockGetMyApplications.mockResolvedValue([]);
    mockUseSearchProfiles.mockReturnValue(requeteProfils([]));

    const tree = await rendrePour(DIRIGEANT, { initialTab: 'profils' });
    expect(texteVisible(tree)).toContain('Aucun profil visible pour cette recherche.');

    await appuyerSur(tree, 'Opportunités');
    expect(texteVisible(tree)).toContain('Aucune annonce disponible pour le moment.');

    await appuyerSur(tree, 'Candidatures');
    expect(texteVisible(tree)).toContain('Tu n’as pas encore postulé à une annonce.');
  });

  // Ce temoin figeait le defaut : jusqu'a L42, une panne serveur affichait mot
  // pour mot le meme ecran que « rien a afficher ». Il annoncait sa propre
  // chute (« pour qu'un futur ecran d'erreur se voie tout de suite ») ; L42 l'a
  // fait tomber, il dit maintenant la verite. Le detail est dans le bloc
  // « serveur injoignable (L42) » plus bas.
  it('serveur en panne : le message de liste vide n est PLUS celui de la panne', async () => {
    const journalErreur = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockGetRecruitmentAds.mockRejectedValue(new Error('Network Error 500'));
    mockGetMyRecruitmentAds.mockRejectedValue(new Error('Network Error 500'));

    const tree = await rendrePour(DIRIGEANT, { initialTab: 'profils' });

    await appuyerSur(tree, 'Opportunités');
    expect(texteVisible(tree)).not.toContain('Aucune annonce disponible pour le moment.');

    journalErreur.mockRestore();
  });
});

// L42 : une panne serveur se deguisait en placard vide. L'utilisateur lisait
// « aucune annonce », il ajustait donc une recherche parfaitement bonne, puis
// il partait — et rien ne remontait. Ces temoins decrivent ce qu'il DOIT lire
// quand le chargement echoue, et surtout ce qu'il ne doit PLUS lire.
describe('RecrutementListContent — serveur injoignable (L42)', () => {
  const PANNE = 'On n’arrive pas à joindre le serveur.';

  /**
   * Demande la page suivante, comme le fait le defilement en bas de liste.
   * @param {any} tree
   * @returns {Promise<void>}
   */
  const chargerPageSuivante = async (tree) => {
    const listes = tree.root.findAll(
      (/** @type {any} */ node) => typeof node.props?.onEndReached === 'function',
      { deep: true },
    );
    if (listes.length === 0) {
      throw new Error('Aucune liste ne sait charger la page suivante');
    }
    await act(async () => {
      listes[0].props.onEndReached();
    });
  };

  it('LE TEMOIN : chaque onglet propose de réessayer au lieu d annoncer un vide', async () => {
    const journalErreur = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockGetRecruitmentAds.mockRejectedValue(new Error('Network Error'));
    mockGetMyRecruitmentAds.mockRejectedValue(new Error('Network Error'));
    mockGetMyApplications.mockRejectedValue(new Error('Network Error'));

    const tree = await rendrePour(DIRIGEANT, { initialTab: 'profils' });

    await appuyerSur(tree, 'Opportunités');
    expect(texteVisible(tree)).toContain(PANNE);
    expect(texteVisible(tree)).toContain('Réessayer');
    expect(texteVisible(tree)).not.toContain('Aucune annonce disponible pour le moment.');

    await appuyerSur(tree, 'Candidatures');
    expect(texteVisible(tree)).toContain(PANNE);
    expect(texteVisible(tree)).not.toContain('Tu n’as pas encore postulé à une annonce.');

    journalErreur.mockRestore();
  });

  it('le bouton « Réessayer » rappelle bien le chargement, et la liste revient', async () => {
    const journalErreur = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockGetMyApplications.mockRejectedValue(new Error('Network Error'));

    const tree = await rendrePour(DIRIGEANT, { initialTab: 'candidatures' });
    expect(texteVisible(tree)).toContain(PANNE);

    // Le serveur repond de nouveau : l'utilisateur ne doit pas avoir a quitter
    // l'ecran pour s'en apercevoir.
    mockGetMyApplications.mockResolvedValue([MA_CANDIDATURE]);
    await appuyerSur(tree, 'Réessayer');

    expect(texteVisible(tree)).toContain('Club Postule');
    expect(texteVisible(tree)).not.toContain(PANNE);

    journalErreur.mockRestore();
  });

  // Les deux boutons partagent le meme repli mais PAS le meme rappel : c'est
  // exactement l'endroit ou une recopie se trompe de liste, sans que rien ne le
  // dise. Les deux onglets sont donc verifies chacun leur tour.
  it('le bouton de chaque onglet rappelle SA liste, pas celle du voisin', async () => {
    const journalErreur = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockGetRecruitmentAds.mockRejectedValue(new Error('Network Error'));
    mockGetMyApplications.mockRejectedValue(new Error('Network Error'));

    const tree = await rendrePour(DIRIGEANT, { initialTab: 'opportunites' });
    expect(texteVisible(tree)).toContain(PANNE);

    mockGetRecruitmentAds.mockResolvedValue({ data: [ANNONCE_PUBLIQUE], meta: {} });
    await appuyerSur(tree, 'Réessayer');
    expect(texteVisible(tree)).toContain('Olympique Public');
    expect(texteVisible(tree)).not.toContain(PANNE);

    await appuyerSur(tree, 'Candidatures');
    expect(texteVisible(tree)).toContain(PANNE);

    mockGetMyApplications.mockResolvedValue([MA_CANDIDATURE]);
    await appuyerSur(tree, 'Réessayer');
    expect(texteVisible(tree)).toContain('Club Postule');
    expect(texteVisible(tree)).not.toContain(PANNE);

    journalErreur.mockRestore();
  });

  it('page 2 en erreur : la page 1 reste, et un filtre vide n est pas une panne', async () => {
    const journalErreur = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockGetRecruitmentAds.mockImplementation((/** @type {any} */ params) => (
      params?.page === 1
        ? Promise.resolve({
          data: [ANNONCE_PUBLIQUE],
          meta: { pagination: { page: 1, pageCount: 3 } },
        })
        : Promise.reject(new Error('Network Error'))
    ));

    const tree = await rendrePour(JOUEUR, { initialTab: 'annonces' });
    expect(texteVisible(tree)).toContain('Olympique Public');

    await chargerPageSuivante(tree);

    // Ce qui est deja affiche reste affiche : une page suivante ratee ne
    // condamne pas les precedentes.
    expect(texteVisible(tree)).toContain('Olympique Public');
    expect(texteVisible(tree)).not.toContain(PANNE);

    // Et le drapeau de panne n'a pas ete leve en douce. On vide la liste par un
    // FILTRE (le serveur n'est pour rien la-dedans) : l'ecran doit dire « aucune
    // annonce », jamais « serveur injoignable ».
    await appuyerSur(tree, 'Entraineurs');
    expect(texteVisible(tree)).toContain('Aucune annonce disponible pour le moment.');
    expect(texteVisible(tree)).not.toContain(PANNE);

    journalErreur.mockRestore();
  });
});

// D57 — le bouton de filtres et sa pastille MARCHAIENT DEJA ; ce qui manquait,
// c'est ce qu'ils ouvraient. Ces temoins verifient la jonction, pas le dessin de
// la feuille (celui-la vit dans RecruitmentFiltersSheet.test.js).
describe('RecrutementListContent — le bouton de filtres ouvre la feuille', () => {
  it('LE TEMOIN : la feuille n est pas la, le bouton l ouvre', async () => {
    const tree = await rendrePour(JOUEUR, { initialTab: 'annonces' });
    expect(texteVisible(tree)).not.toContain('Voir les résultats');

    await appuyerSur(tree, 'Filtres 0');

    const rendu = texteVisible(tree);
    expect(rendu).toContain('Filtrer');
    expect(rendu).toContain('Voir les résultats');
    expect(rendu).toContain('Réinitialiser');
  });

  it('la pastille compte les filtres posés, sans compter la recherche texte', async () => {
    poserFiltres({ category: ['c-1'], city: 'Lyon', q: 'gardien' });

    const tree = await rendrePour(JOUEUR, { initialTab: 'annonces' });

    // 2 et non 3 : `q` est la recherche texte, elle a deja sa propre barre.
    expect(texteVisible(tree)).toContain('Filtres 2');
  });

  // Le profil se filtre cote CLIENT : il compte pour l'utilisateur, mais il ne
  // doit pas declencher d'appel a la recherche serveur.
  it('le profil choisi dans la feuille s ajoute à la pastille', async () => {
    const tree = await rendrePour(DIRIGEANT, { initialTab: 'opportunites' });
    expect(texteVisible(tree)).toContain('Filtres 0');

    await appuyerSur(tree, 'Entraineurs');

    expect(texteVisible(tree)).toContain('Filtres 1');
  });
});

describe('RecrutementListContent — la demande externe d onglet (assistant de création)', () => {
  it('TEMOIN DE NON-REGRESSION : arriver avec initialTab ouvre CET onglet', async () => {
    const tree = await rendrePour(DIRIGEANT, { initialTab: 'candidatures' });

    expect(ongletAffiche(tree)).toBe('candidatures');
  });

  it('TEMOIN DE NON-REGRESSION : une demande NEUVE est honorée, même après un geste manuel', async () => {
    const tree = await rendrePour(DIRIGEANT, { initialTab: 'profils' });
    await appuyerSur(tree, 'Candidatures');
    expect(ongletAffiche(tree)).toBe('candidatures');

    // Un ecran voisin renvoie ici en demandant « Opportunités » : cette demande
    // est NEUVE, elle doit passer devant le geste de l'utilisateur.
    await act(async () => {
      tree.update(<RecrutementListContent initialTab="opportunites" />);
    });

    expect(ongletAffiche(tree)).toBe('opportunites');
  });

  it('une demande DEJA honorée ne réécrase pas le choix de l utilisateur', async () => {
    const tree = await rendrePour(DIRIGEANT, { initialTab: 'profils' });
    await appuyerSur(tree, 'Candidatures');

    // Meme demande, re-rendue (un parent qui se rafraichit) : elle a deja ete
    // honoree au montage, elle ne doit pas ramener l'utilisateur en arriere.
    await act(async () => {
      tree.update(<RecrutementListContent initialTab="profils" />);
    });

    expect(ongletAffiche(tree)).toBe('candidatures');
  });

  it('un écran inactif ne rejoue rien tant qu il n a pas repris la main', async () => {
    const tree = await rendrePour(DIRIGEANT, { initialTab: 'profils', screenActive: false });

    await appuyerSur(tree, 'Opportunités');

    expect(ongletAffiche(tree)).toBe('opportunites');
  });
});

describe('RecrutementListContent — personne n atteint un onglet interdit à son rôle', () => {
  it('un Joueur qui demande « Profils » retombe sur les annonces', async () => {
    const tree = await rendrePour(JOUEUR, { initialTab: 'profils' });

    expect(ongletAffiche(tree)).toBe('opportunites');
    expect(texteVisible(tree)).not.toContain(MARQUEUR.profils);
  });

  it('un Joueur n a AUCUN bouton d onglet, le Dirigeant en a 3', async () => {
    const treeJoueur = await rendrePour(JOUEUR, { initialTab: 'annonces' });
    const renduJoueur = texteVisible(treeJoueur);
    expect(renduJoueur).not.toContain('Mes candidatures');
    expect(renduJoueur).not.toContain('Opportunités');
    expect(renduJoueur).not.toContain('Profils');

    const treeDirigeant = await rendrePour(DIRIGEANT, { initialTab: 'profils' });
    const renduDirigeant = texteVisible(treeDirigeant);
    expect(renduDirigeant).toContain('Profils');
    expect(renduDirigeant).toContain('Opportunités');
    expect(renduDirigeant).toContain('Candidatures');
    // D57 — celui qui a demenage dans « Mes activites ».
    expect(renduDirigeant).not.toContain('Mes annonces');
  });

  it('un onglet devenu interdit est abandonné quand le rôle change', async () => {
    const tree = await rendrePour(DIRIGEANT, { initialTab: 'profils' });
    expect(ongletAffiche(tree)).toBe('profils');

    // Le meme ecran, l'utilisateur n'est plus staff : « Profils » ne lui est
    // plus permis, il ne doit pas y rester coince.
    mockUserData = JOUEUR;
    await act(async () => {
      tree.update(<RecrutementListContent initialTab="profils" />);
    });

    expect(texteVisible(tree)).not.toContain(MARQUEUR.profils);
  });

  it('un visiteur non connecté reste sur les annonces, sans boutons d onglet', async () => {
    const tree = await rendrePour(undefined, { initialTab: 'candidatures' });
    const rendu = texteVisible(tree);

    expect(ongletAffiche(tree)).toBe('opportunites');
    expect(rendu).not.toContain(MARQUEUR.candidatures);
    expect(rendu).not.toContain('Mes candidatures');
  });
});
