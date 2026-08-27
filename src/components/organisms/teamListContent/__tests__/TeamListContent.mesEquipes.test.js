/**
 * U03 — l'onglet « Equipe » d'un JOUEUR telechargeait la table des equipes de
 * toute la France, dix par dix.
 *
 * 🔴 LE DEFAUT, tel que le code le produisait :
 *  · `MyTeamList.js:88-91` monte `TeamListContent` SANS `clubId` ;
 *  · `teamService.buildClubFilter` ne pose aucun filtre quand `clubId` manque ;
 *  · la pagination vaut 10 lignes par page et il n'y a AUCUN tri.
 *  ⇒ tant que l'equipe du joueur n'etait pas dans les dix premieres lignes de la
 *    table, l'onglet affichait « aucune equipe » alors qu'il en avait une.
 *
 * 🎯 CE QUE CE FICHIER PROUVE, avec un SERVEUR FICTIF qui applique reellement
 * les parametres recus (filtre + pagination) — sans lui, le test verifierait
 * seulement qu'on sait afficher ce qu'on lui donne, et resterait vert sur le
 * code casse :
 *  1. un joueur voit SES equipes ;
 *  2. la requete envoyee porte toujours un filtre ;
 *  3. 🔒 le dirigeant avec club ne change pas de comportement ;
 *  4. une liste vide ne se redemande pas en boucle.
 *
 * 🧵 SUR LE TEMOIN 4 — le double de `FlashList` reproduit le contrat MESURE de
 * `@shopify/flash-list@2.2.0`, lu dans le paquet installe :
 *  · `recyclerview/RecyclerView.tsx:609` appelle `checkBounds()` a CHAQUE commit ;
 *  · `recyclerview/hooks/useBoundDetection.ts:92-94` : quand le contenu est plus
 *    court que la fenetre, `isNearEnd` est TOUJOURS vrai ;
 *  · `recyclerview/hooks/useBoundDetection.ts:149-154` : le verrou « deja
 *    demande » est REMIS A ZERO des que l'identite de la prop `data` change.
 *  Or `otherTeams` est reconstruit par `sortTeamsForDisplay` (`[...list].sort`),
 *  donc son identite change a chaque page recue — meme quand il reste VIDE.
 *  ⇒ page vide ⇒ `onEndReached` ⇒ page suivante ⇒ toujours vide ⇒ `onEndReached`…
 *  jusqu'a la derniere page de la table. C'est ce que ce temoin interdit.
 */

import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import TeamListContent from '../TeamListContent';

jest.setTimeout(30000);

const mockUseAuth = jest.fn();
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => mockUseAuth(),
}));

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: () => {},
  useIsFocused: () => true,
  useNavigation: () => ({ getState: () => ({ routeNames: [] }), navigate: mockNavigate }),
}));

// Le double de FlashList : voir l'en-tete de fichier. Il ne dessine pas une
// liste, il rejoue la DETECTION DE BORD de flash-list v2 — c'est elle, et elle
// seule, qui transforme une page vide en rappel de la page suivante.
jest.mock('@shopify/flash-list', () => {
  // eslint-disable-next-line global-require
  const React = require('react');
  // eslint-disable-next-line global-require
  const { View } = require('react-native');
  /**
   * Rend une zone de liste, qu'elle arrive comme element ou comme fabrique.
   * @param {any} component - Element ou fabrique d'element.
   * @returns {any} - Element rendu.
   */
  const resolve = (component) => (typeof component === 'function' ? component() : component);

  /**
   * Liste simulee : elle ne dessine pas, elle rejoue la detection de bord.
   * @param {any} props - Les props passees par l'ecran.
   * @returns {any} - La liste simulee.
   */
  function FlashList({
    data,
    keyExtractor,
    ListEmptyComponent,
    ListFooterComponent,
    ListHeaderComponent,
    onEndReached,
    renderItem,
  }) {
    const derniereData = React.useRef(null);

    React.useEffect(() => {
      // useBoundDetection.ts:149-154 — l'identite de `data` change ⇒ le verrou
      // saute. useBoundDetection.ts:92-94 — liste vide ⇒ on est deja au bout.
      if (derniereData.current === data) return;
      derniereData.current = data;
      if ((data || []).length === 0) onEndReached?.();
    });

    return (
      <View>
        {resolve(ListHeaderComponent)}
        {(data || []).length === 0
          ? resolve(ListEmptyComponent)
          : (data || []).map((item, index) => (
            <View key={keyExtractor ? keyExtractor(item, index) : index}>
              {renderItem({ index, item })}
            </View>
          ))}
        {resolve(ListFooterComponent)}
      </View>
    );
  }

  return { FlashList };
});

jest.mock('@react-native-masked-view/masked-view', () => {
  // eslint-disable-next-line global-require
  const { View } = require('react-native');
  return { __esModule: true, default: View };
});

jest.mock('react-native-linear-gradient', () => {
  // eslint-disable-next-line global-require
  const { View } = require('react-native');
  return { __esModule: true, default: View };
});

jest.mock('@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/components/organisms/searchComponent/searchComponent', () => {
  // eslint-disable-next-line global-require
  const { View } = require('react-native');
  return { __esModule: true, default: () => <View testID="search-bar" /> };
});

jest.mock('@/components/molecules/withDataWrapper/WithDataWrapper', () => ({
  __esModule: true,
  default: (/** @type {any} */ props) => props.children,
}));

jest.mock('@/domains/club/useClub', () => ({
  __esModule: true,
  default: () => ({ getClubInitials: () => 'FC' }),
}));

jest.mock('@/store/appContext', () => ({
  useAppContext: () => [{ teamFilters: {} }],
}));

jest.mock('@/navigation/useBottomDockLayout', () => ({
  __esModule: true,
  default: () => ({ floatingActionBottomOffset: 0, sceneBottomInset: 0 }),
}));

jest.mock('@/navigation/commonOptions', () => ({
  getFloatingActionContainerStyle: () => ({}),
}));

jest.mock('@/views/search/searchRouteHelpers', () => ({ navigateToSearchHub: jest.fn() }));

jest.mock('@/utils/imageUrl', () => ({ getImageUrl: (/** @type {any} */ url) => url }));

jest.mock('@/theme/colors', () => ({ withAlpha: (/** @type {any} */ color) => color }));

jest.mock('@/theme/themeContext', () => {
  /**
   * Echelle de style tolerante : n'importe quelle cle rend un objet vide.
   * @returns {any} - L'echelle.
   */
  const anyScale = () => new Proxy({}, {
    get: (/** @type {any} */ _target, /** @type {any} */ key) => (
      typeof key === 'symbol' ? undefined : anyScale()
    ),
  });

  return {
    __esModule: true,
    default: () => ({
      Alignments: anyScale(),
      ApplicationStyle: anyScale(),
      Colors: {
        gold500: 'couleur-or',
        neutral00: 'encre-claire',
        neutral100: 'neutre-100',
        neutral200: 'neutre-200',
        neutral300: 'neutre-300',
        neutral400: 'neutre-400',
        neutral500: 'neutre-500',
        primary100: 'primaire-100',
        primary200: 'primaire-200',
        primary500: 'couleur-primaire',
        primary700: 'couleur-surface',
        primary900: 'couleur-fond',
        success500: 'couleur-succes',
        transparent: 'transparent',
        violet500: 'couleur-club',
        warning500: 'couleur-alerte',
      },
      Fonts: anyScale(),
      Images: anyScale(),
      Spaces: anyScale(),
    }),
  };
});

jest.mock('@/services/leagueTeam/leagueTeamQueries', () => {
  const contexteFige = {
    data: null, error: null, isLoading: false, refetch: () => {},
  };
  return { useGetLeagueTeamContext: () => contexteFige };
});

// ————————————————————————————————————————————————————————————————————
// LE SERVEUR FICTIF
// ————————————————————————————————————————————————————————————————————

const CLUB_DU_JOUEUR = { documentId: 'club-du-joueur', name: 'FC Test', sponsor: [] };
const CLUB_ETRANGER = { documentId: 'club-etranger', name: 'AS Ailleurs', sponsor: [] };

const MON_EQUIPE = {
  activities: [{ name: 'Football' }],
  category: { name: 'U15' },
  club: CLUB_DU_JOUEUR,
  documentId: 'equipe-a-moi',
  name: 'MON EQUIPE A MOI',
  players: [{ documentId: 'moi' }],
  section: { name: 'Masculine' },
  trainers: [],
};

// 21 equipes d'un autre club, PUIS la mienne, PUIS 3 equipes de mon club.
// La mienne est au rang 22 : hors des dix premieres lignes, donc invisible
// pour une requete sans filtre.
const mockTableDesEquipes = [
  ...Array.from({ length: 21 }, (_, index) => ({
    activities: [{ name: 'Football' }],
    club: CLUB_ETRANGER,
    documentId: `equipe-etrangere-${index + 1}`,
    name: `Equipe etrangere ${index + 1}`,
    players: [],
    trainers: [],
  })),
  MON_EQUIPE,
  ...Array.from({ length: 3 }, (_, index) => ({
    activities: [{ name: 'Football' }],
    club: CLUB_DU_JOUEUR,
    documentId: `equipe-du-club-${index + 1}`,
    name: `Autre equipe du club ${index + 1}`,
    players: [],
    trainers: [],
  })),
];

const mockParamsRecus = [];
const mockPagesDemandees = jest.fn();
const mockLignesServies = [];

/**
 * Rejoue ce que `teamService.getTeams` demande au serveur : un filtre eventuel,
 * puis une tranche de pagination. Aucun tri, comme aujourd'hui.
 * @param {any} params - Les parametres de la requete.
 * @returns {any} - La page renvoyee.
 */
const mockServeur = (params) => {
  const {
    clubId, page = 1, pageSize = 10, teamIds,
  } = params || {};

  let lignes = mockTableDesEquipes;
  if (Array.isArray(teamIds)) {
    lignes = lignes.filter((equipe) => teamIds.includes(equipe.documentId));
  } else if (clubId) {
    lignes = lignes.filter((equipe) => equipe.club?.documentId === clubId);
  }

  const debut = (page - 1) * pageSize;
  const tranche = lignes.slice(debut, debut + pageSize);
  mockLignesServies.push(tranche.map((equipe) => equipe.name));
  return {
    data: tranche,
    meta: {
      pagination: {
        page,
        pageCount: Math.max(1, Math.ceil(lignes.length / pageSize)),
        pageSize,
        total: lignes.length,
      },
    },
  };
};

const mockRefetch = jest.fn();

jest.mock('@/services/team/teamQueries', () => {
  // eslint-disable-next-line global-require
  const React = require('react');

  return {
    /**
     * Requete paginee simulee : elle NOTE ce qu'on lui demande, puis sert le
     * serveur fictif. Les enveloppes sont figees par `useMemo`, sinon l'ecran
     * boucle a l'infini (piege deja paye sur `TeamEdit`).
     * @param {any} params - Les parametres de la requete.
     * @param {any} [options] - Les options react-query.
     * @returns {any} - L'etat de la requete.
     */
    useGetTeams: (params, options) => {
      const actif = options?.enabled !== false;
      const clef = JSON.stringify(params || {});
      const clefServie = React.useRef(null);
      const [pages, setPages] = React.useState([]);

      mockParamsRecus.push(params);

      React.useEffect(() => {
        if (!actif) return;
        if (clefServie.current === clef) return;
        clefServie.current = clef;
        mockPagesDemandees(1);
        setPages([mockServeur({ ...JSON.parse(clef), page: 1 })]);
      }, [actif, clef]);

      const fetchNextPage = React.useCallback(() => {
        setPages((precedentes) => {
          const derniere = precedentes[precedentes.length - 1];
          if (!derniere) return precedentes;
          const suivante = derniere.meta.pagination.page + 1;
          if (suivante > derniere.meta.pagination.pageCount) return precedentes;
          mockPagesDemandees(suivante);
          return [...precedentes, mockServeur({ ...JSON.parse(clef), page: suivante })];
        });
      }, [clef]);

      const derniere = pages[pages.length - 1];
      return React.useMemo(() => ({
        data: pages.length ? { pages } : undefined,
        error: null,
        fetchNextPage,
        hasNextPage: Boolean(
          derniere && derniere.meta.pagination.page < derniere.meta.pagination.pageCount,
        ),
        isFetchingNextPage: false,
        isLoading: actif && pages.length === 0,
        refetch: mockRefetch,
      }), [actif, derniere, fetchNextPage, pages]);
    },
  };
});

// ————————————————————————————————————————————————————————————————————

const LE_JOUEUR = {
  clubMembershipRequests: [],
  documentId: 'moi',
  myTeams: [{ documentId: 'equipe-a-moi' }],
  role: { name: 'Joueur', type: 'joueur' },
  teamMembershipRequests: [],
  trainedTeams: [],
};

const LE_DIRIGEANT = {
  club: CLUB_DU_JOUEUR,
  clubMembershipRequests: [],
  documentId: 'le-dirigeant',
  myTeams: [],
  role: { name: 'Dirigeant', type: 'dirigeant' },
  teamMembershipRequests: [],
  trainedTeams: [],
};

/** @type {any} */
let arbreMonte = null;

/**
 * Monte la liste.
 * @param {object} [options] - Les options du montage.
 * @param {any} [options.userData] - Le compte connecte.
 * @param {boolean} [options.canManageTeam] - Peut-il creer une equipe ?
 * @param {string} [options.clubId] - Le club dont on liste les equipes.
 * @param {boolean} [options.showOnlyMyTeams] - Mode « mes equipes » seules.
 * @returns {Promise<any>} - L'arbre rendu.
 */
const monter = async ({
  canManageTeam = false,
  clubId = undefined,
  showOnlyMyTeams = false,
  userData = LE_JOUEUR,
} = {}) => {
  mockUseAuth.mockReturnValue({
    canManageTeam,
    freeUsageSummary: [],
    subscriptionAccessLevel: 'FREE',
    userData,
  });

  await act(async () => {
    arbreMonte = renderer.create(
      <TeamListContent clubId={clubId} showOnlyMyTeams={showOnlyMyTeams} />,
    );
  });
  return arbreMonte;
};

/**
 * Tous les textes d'un arbre rendu, aplatis.
 * @param {any} node - Noeud JSON du rendu.
 * @returns {string[]} - Textes rencontres.
 */
const collectText = (node) => {
  if (node === null || node === undefined) return [];
  if (typeof node === 'string') return [node];
  if (Array.isArray(node)) return node.flatMap(collectText);
  return collectText(node.children);
};

/**
 * Le texte visible du rendu, en une seule chaine cherchable.
 * @param {any} tree - Arbre rendu.
 * @returns {string} - Textes joints.
 */
const texteVisible = (tree) => collectText(tree.toJSON()).join(' | ');

/**
 * Les derniers parametres passes a la requete paginee.
 * @returns {any} - Les parametres.
 */
const derniersParams = () => mockParamsRecus[mockParamsRecus.length - 1] || {};

/**
 * Les noms d'equipe que le serveur fictif a fini par rendre a l'ecran.
 * @param {any} tree - Arbre rendu.
 * @returns {string[]} - Les noms trouves.
 */
const equipesAffichees = (tree) => [...new Set(tree.root.findAllByType(Text)
  .map((/** @type {any} */ noeud) => noeud.props.children)
  .filter((/** @type {any} */ valeur) => typeof valeur === 'string')
  .filter((/** @type {string} */ valeur) => (
    valeur === 'MON EQUIPE A MOI'
    || valeur.startsWith('Equipe etrangere ')
    || valeur.startsWith('Autre equipe du club ')
  )))];
// ⚠️ Les doublons sont ECARTES depuis que le nom d'equipe DEFILE (MARQUEE,
// 27/08). `MarqueeText` rend le texte DEUX fois : une sonde de mesure hors flux
// (`opacity: 0`, c'est elle qui dit si le nom depasse) et la ligne visible.
// A l'ecran il n'y a toujours qu'UNE equipe — ce que ce temoin verifie. Compter
// les noeuds Text compterait la sonde, pas une equipe de plus.

describe('TeamListContent — l onglet « Equipe » d un joueur (lot U03)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParamsRecus.length = 0;
    mockLignesServies.length = 0;
  });

  afterEach(async () => {
    // Le debounce de recherche est arme a 300 ms : sans demontage il tire apres
    // la fin du test et salit la suite.
    if (arbreMonte) {
      await act(async () => {
        arbreMonte.unmount();
      });
      arbreMonte = null;
    }
  });

  describe('① le temoin principal — un joueur voit SES equipes', () => {
    // 🪤 CE QUE LA MESURE A CORRIGE DANS L ENONCE DU LOT : « l onglet affiche
    // aucune equipe » ne se prouve PAS par le texte a l ecran. Sur cette table
    // de 25 lignes, la boucle de pagination avale les 3 pages en quelques
    // millisecondes et l equipe finit par apparaitre — le temoin serait VERT sur
    // le code casse. Sur un telephone, la meme boucle doit avaler la table
    // ENTIERE avant d y arriver : c est ca, « aucune equipe ».
    // ⇒ le temoin qui tranche est donc : l equipe est-elle DANS LA PREMIERE
    //   PAGE SERVIE ? C est la seule formulation que le code casse fait rougir.
    it('sert l equipe du joueur DES la premiere page', async () => {
      await monter({ showOnlyMyTeams: true });

      expect(mockLignesServies[0]).toContain('MON EQUIPE A MOI');
    });

    it('l affiche a l ecran', async () => {
      const arbre = await monter({ showOnlyMyTeams: true });

      expect(texteVisible(arbre)).toContain('MON EQUIPE A MOI');
    });

    it('n affiche AUCUNE equipe etrangere', async () => {
      const arbre = await monter({ showOnlyMyTeams: true });

      expect(equipesAffichees(arbre)).toEqual(['MON EQUIPE A MOI']);
    });
  });

  describe('② la requete envoyee porte un filtre — plus jamais la table entiere', () => {
    it('demande nommement les equipes du profil', async () => {
      await monter({ showOnlyMyTeams: true });

      expect(derniersParams().teamIds).toEqual(['equipe-a-moi']);
    });

    it('ne demande pas plus de lignes qu il n y a d equipes a rendre', async () => {
      await monter({ showOnlyMyTeams: true });

      expect(derniersParams().pageSize).toBe(1);
    });

    it('ne part pas du tout quand le profil ne declare aucune equipe', async () => {
      await monter({
        showOnlyMyTeams: true,
        userData: { ...LE_JOUEUR, myTeams: [], trainedTeams: [] },
      });

      expect(mockPagesDemandees).not.toHaveBeenCalled();
    });

    it('compte l equipe entrainee comme mienne, au meme titre', async () => {
      await monter({
        showOnlyMyTeams: true,
        userData: {
          ...LE_JOUEUR,
          myTeams: [],
          trainedTeams: [{ documentId: 'equipe-a-moi' }],
        },
      });

      expect(derniersParams().teamIds).toEqual(['equipe-a-moi']);
    });
  });

  describe('③ 🔒 non-regression — le dirigeant avec club ne change pas', () => {
    it('filtre toujours par club, et ne demande PAS une selection d equipes', async () => {
      await monter({ canManageTeam: true, clubId: 'club-du-joueur', userData: LE_DIRIGEANT });

      expect(derniersParams().clubId).toBe('club-du-joueur');
      expect(derniersParams().teamIds).toBeUndefined();
      expect(derniersParams().pageSize).toBeUndefined();
    });

    it('montre toujours les autres equipes du club', async () => {
      const arbre = await monter({
        canManageTeam: true,
        clubId: 'club-du-joueur',
        userData: LE_DIRIGEANT,
      });

      expect(texteVisible(arbre)).toContain('Autres équipes du club');
      expect(equipesAffichees(arbre)).toContain('Autre equipe du club 1');
    });
  });

  describe('④ une liste vide ne se redemande pas en boucle', () => {
    it('ne reclame aucune page supplementaire dans l onglet « mes equipes »', async () => {
      await monter({ showOnlyMyTeams: true });

      // 1 seule page demandee : celle qui porte la selection.
      expect(mockPagesDemandees).toHaveBeenCalledTimes(1);
      expect(mockPagesDemandees).toHaveBeenCalledWith(1);
    });

    it('ne reclame rien non plus quand le compte n a aucune equipe', async () => {
      await monter({
        showOnlyMyTeams: true,
        userData: { ...LE_JOUEUR, myTeams: [], trainedTeams: [] },
      });

      expect(mockPagesDemandees).toHaveBeenCalledTimes(0);
    });
  });
});
