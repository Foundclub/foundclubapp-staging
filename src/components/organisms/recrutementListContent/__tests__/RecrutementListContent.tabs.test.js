import renderer, { act } from 'react-test-renderer';

import RecrutementListContent from '../RecrutementListContent';

// L35 (E6) : RecrutementListContent.js fait 1 301 lignes, recruitmentFlow.js
// porte toute la logique d'onglets par role, et NI L'UN NI L'AUTRE n'avait de
// test. Ce fichier fige le comportement des sous-onglets « Profils /
// Opportunites / Mes annonces / Candidatures » AVANT d'y toucher.
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
jest.mock('@/store/appContext', () => {
  const etatFige = [{ recruitmentAdFilters: {} }, () => {}];
  return { useAppContext: () => etatFige };
});

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

// La barre de recherche partagee n'est pas l'objet de ce test.
jest.mock('@/components/organisms/searchComponent/searchComponent', () => {
  // eslint-disable-next-line global-require
  const { View } = require('react-native');
  return { __esModule: true, default: () => <View testID="search-bar" /> };
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

  it('un Dirigeant atteint ses 4 onglets, dans n importe quel ordre', async () => {
    const tree = await rendrePour(DIRIGEANT, { initialTab: 'profils' });

    await appuyerSur(tree, 'Mes annonces');
    expect(ongletAffiche(tree)).toBe('annonces');

    await appuyerSur(tree, 'Candidatures');
    expect(ongletAffiche(tree)).toBe('candidatures');

    await appuyerSur(tree, 'Opportunités');
    expect(ongletAffiche(tree)).toBe('opportunites');

    await appuyerSur(tree, 'Profils');
    expect(ongletAffiche(tree)).toBe('profils');
  });

  it('un Joueur bascule entre ses 2 onglets, dans les deux sens', async () => {
    const tree = await rendrePour(JOUEUR, { initialTab: 'annonces' });
    expect(ongletAffiche(tree)).toBe('opportunites');

    await appuyerSur(tree, 'Mes candidatures');
    expect(ongletAffiche(tree)).toBe('candidatures');

    await appuyerSur(tree, 'Annonces');
    expect(ongletAffiche(tree)).toBe('opportunites');
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

  it('Opportunités : les annonces publiques, triées « compatibles » d abord', async () => {
    const tree = await rendrePour(DIRIGEANT, { initialTab: 'profils' });
    await appuyerSur(tree, 'Opportunités');
    const rendu = texteVisible(tree);

    expect(rendu).toContain('Compatibles avec mon profil');
    expect(rendu).toContain('Olympique Public');
    expect(rendu).toContain('Postuler');
    expect(mockGetRecruitmentAds).toHaveBeenCalled();
  });

  it('Mes annonces : les annonces de MES équipes, et le bouton pour en créer une', async () => {
    const tree = await rendrePour(DIRIGEANT, { initialTab: 'annonces' });
    const rendu = texteVisible(tree);

    expect(rendu).toContain('Consulte et gère les annonces publiées pour tes équipes.');
    expect(rendu).toContain('+ Créer une annonce');
    expect(rendu).toContain('Club des Dirigeants');
    expect(mockGetMyRecruitmentAds).toHaveBeenCalled();
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

    await appuyerSur(tree, 'Mes annonces');
    expect(texteVisible(tree)).toContain('Aucune annonce publiée pour tes équipes sur ce filtre');

    await appuyerSur(tree, 'Candidatures');
    expect(texteVisible(tree)).toContain('Tu n’as pas encore postulé à une annonce.');
  });

  it('COMPORTEMENT ACTUEL, PAS UN SOUHAIT : serveur en panne = le même écran que « rien à afficher »', async () => {
    // L'erreur reseau part en `console.error` et rien d'autre : l'utilisateur
    // lit « Aucune annonce disponible », pas « le serveur ne repond pas ».
    // Fige ici pour qu'un futur ecran d'erreur se voie tout de suite.
    const journalErreur = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockGetRecruitmentAds.mockRejectedValue(new Error('Network Error 500'));
    mockGetMyRecruitmentAds.mockRejectedValue(new Error('Network Error 500'));

    const tree = await rendrePour(DIRIGEANT, { initialTab: 'annonces' });
    expect(texteVisible(tree)).toContain('Aucune annonce publiée pour tes équipes sur ce filtre');

    await appuyerSur(tree, 'Opportunités');
    expect(texteVisible(tree)).toContain('Aucune annonce disponible pour le moment.');

    journalErreur.mockRestore();
  });
});

describe('RecrutementListContent — la demande externe d onglet (assistant de création)', () => {
  it('TEMOIN DE NON-REGRESSION : arriver avec initialTab ouvre CET onglet', async () => {
    const tree = await rendrePour(DIRIGEANT, { initialTab: 'annonces' });

    expect(ongletAffiche(tree)).toBe('annonces');
  });

  it('TEMOIN DE NON-REGRESSION : une demande NEUVE est honorée, même après un geste manuel', async () => {
    const tree = await rendrePour(DIRIGEANT, { initialTab: 'profils' });
    await appuyerSur(tree, 'Candidatures');
    expect(ongletAffiche(tree)).toBe('candidatures');

    // L'assistant de creation d'annonce revient sur l'ecran en demandant
    // « Mes annonces » : cette demande est NEUVE, elle doit passer devant le
    // geste de l'utilisateur.
    await act(async () => {
      tree.update(<RecrutementListContent initialTab="annonces" />);
    });

    expect(ongletAffiche(tree)).toBe('annonces');
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

  it('un Joueur n a que 2 boutons d onglet, le Dirigeant en a 4', async () => {
    const treeJoueur = await rendrePour(JOUEUR, { initialTab: 'annonces' });
    const renduJoueur = texteVisible(treeJoueur);
    expect(renduJoueur).toContain('Mes candidatures');
    expect(renduJoueur).not.toContain('Opportunités');

    const treeDirigeant = await rendrePour(DIRIGEANT, { initialTab: 'profils' });
    const renduDirigeant = texteVisible(treeDirigeant);
    expect(renduDirigeant).toContain('Profils');
    expect(renduDirigeant).toContain('Opportunités');
    expect(renduDirigeant).toContain('Mes annonces');
    expect(renduDirigeant).toContain('Candidatures');
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
