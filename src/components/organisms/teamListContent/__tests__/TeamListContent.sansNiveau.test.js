import renderer, { act } from 'react-test-renderer';

import TeamListContent from '../TeamListContent';

// Filet AA03 (E6), volet « ET APRES ? » — LA CARTE D'UNE EQUIPE SANS NIVEAU.
//
// Depuis AA03, l'etape 6/8 du tunnel equipe peut etre passee sans rien choisir :
// des equipes sans niveau vont exister. La carte de liste porte quatre
// etiquettes — sport, section, categorie, niveau — et la regle des affiches du
// lot X01 s'applique telle quelle : une case sans valeur ne se rend PAS DU TOUT,
// libelle compris. Jamais un blanc, jamais un separateur qui pend, jamais
// « undefined ».
//
// Point d'observation : les textes rendus par la carte. On compare deux equipes
// cote a cote dans la MEME liste — l'une avec son niveau, l'autre sans — pour
// que le temoin mesure la difference et pas la mise en page.

jest.setTimeout(30000);

/** Les equipes servies par le serveur double. */
let mockEquipes = /** @type {any[]} */ ([]);

const mockUseAuth = jest.fn();
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => mockUseAuth(),
}));

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: () => {},
  // Le bandeau des partenaires de la carte riche s'anime seulement quand l'ecran
  // est au premier plan : sans cette fonction, il jette avant tout rendu.
  useIsFocused: () => true,
  useNavigation: () => ({ getState: () => ({ routeNames: [] }), navigate: jest.fn() }),
}));

// La vraie FlashList mesure sa fenetre avant de rendre : sans layout reel, elle
// ne rend AUCUNE ligne. Ce double rend l'EN-TETE puis les lignes.
// ⚠️ L'en-tete n'est pas un detail de mise en page : c'est LUI qui porte la
// carte riche de « Mes equipes », la seule des deux mises en page qui affiche
// une etiquette de niveau. `renderItem` rend la rangee COMPACTE des « autres
// equipes du club », qui n'a jamais montre le niveau, ni avant ni apres AA03.
jest.mock('@shopify/flash-list', () => {
  // eslint-disable-next-line global-require
  const { View } = require('react-native');
  return {
    FlashList: ({ data, ListHeaderComponent, renderItem }) => (
      <View>
        {typeof ListHeaderComponent === 'function' ? ListHeaderComponent() : ListHeaderComponent}
        {(data || []).map((/** @type {any} */ item, /** @type {number} */ index) => (
          <View key={item?.documentId || String(index)}>
            {renderItem ? renderItem({ index, item }) : null}
          </View>
        ))}
      </View>
    ),
  };
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

jest.mock('@/components/organisms/searchComponent/searchComponent', () => ({
  __esModule: true,
  default: () => null,
}));

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

jest.mock('@/services/team/teamQueries', () => ({
  // LOT EQUIPES (Q7) — la file de validation du dirigeant. Ce temoin ne la
  // regarde pas ; il doit juste fournir les deux crochets, sinon l ecran appelle
  // `undefined` et la SUITE tombe.
  useApproveTeamCreation: () => ({ isPending: false, mutate: jest.fn(), variables: undefined }),
  useGetTeams: () => ({
    data: { pages: [{ data: mockEquipes }] },
    error: null,
    fetchNextPage: jest.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    isLoading: false,
    refetch: jest.fn(),
  }),
  useTeamsAwaitingClubApproval: () => ({ data: [], error: null, isLoading: false }),
}));

jest.mock('@/services/leagueTeam/leagueTeamQueries', () => ({
  useGetLeagueTeamContext: () => ({
    data: null, error: null, isLoading: false, refetch: jest.fn(),
  }),
}));

jest.mock('@/views/search/searchRouteHelpers', () => ({ navigateToSearchHub: jest.fn() }));

jest.mock('@/theme/colors', () => ({ withAlpha: (/** @type {any} */ couleur) => couleur }));
jest.mock('@/theme/themeContext', () => {
  /**
   * Echelle de style tolerante : n'importe quelle cle rend un objet vide.
   * @returns {any} Un proxy sans fond.
   */
  const echelle = () => new Proxy({}, {
    get: (/** @type {any} */ _cible, /** @type {any} */ cle) => (
      typeof cle === 'symbol' ? undefined : echelle()
    ),
  });

  return {
    __esModule: true,
    default: () => ({
      Alignments: echelle(),
      ApplicationStyle: echelle(),
      Colors: new Proxy({}, { get: (_cible, cle) => `couleur-${String(cle)}` }),
      Fonts: echelle(),
      Images: echelle(),
      Spaces: echelle(),
    }),
  };
});

const DIRIGEANT = { documentId: 'u-1', role: { name: 'Dirigeant' } };

/** L'equipe temoin, celle qui a TOUT. */
const AVEC_NIVEAU = {
  activities: [{ documentId: 'act-1', name: 'Football' }],
  category: { documentId: 'cat-1', name: 'U15' },
  club: { documentId: 'club-1', name: 'FC Test' },
  documentId: 'equipe-avec',
  level: { documentId: 'niv-1', name: 'Departemental' },
  name: 'Equipe Avec',
  players: [],
  section: { documentId: 'sec-1', name: 'Masculin' },
  trainers: [],
};

/** La meme, sans niveau : c'est la seule difference. */
const SANS_NIVEAU = {
  ...AVEC_NIVEAU, documentId: 'equipe-sans', level: null, name: 'Equipe Sans',
};

/** @type {any} */
let arbre = null;

/**
 * Monte la liste avec les equipes donnees.
 * @param {any[]} equipes Ce que le serveur double renvoie.
 * @returns {Promise<any>} L'arbre monte.
 */
const afficherLaListe = async (equipes) => {
  mockEquipes = equipes;
  mockUseAuth.mockReturnValue({
    canManageTeam: true,
    freeUsageSummary: [],
    subscriptionAccessLevel: 'FREE',
    // Les equipes servies sont les MIENNES : c'est ce qui les fait passer par la
    // carte riche, celle qui porte l'etiquette de niveau.
    userData: {
      ...DIRIGEANT,
      trainedTeams: equipes.map((/** @type {any} */ equipe) => ({
        documentId: equipe.documentId,
      })),
    },
  });
  await act(async () => {
    arbre = renderer.create(<TeamListContent clubId="club-1" />);
  });
  return arbre;
};

/**
 * Tous les textes d'un arbre rendu.
 * @param {any} noeud L'arbre, ou un morceau.
 * @returns {string[]} Les textes, dans l'ordre du rendu.
 */
const textesDe = (noeud) => {
  if (noeud === null || noeud === undefined) return [];
  if (typeof noeud === 'string' || typeof noeud === 'number') return [String(noeud)];
  if (Array.isArray(noeud)) return noeud.flatMap(textesDe);
  return textesDe(noeud.children);
};

describe('AA03 - temoin 5 : la carte d une equipe SANS niveau', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // La liste arme un debounce de 300 ms sur la recherche : sans demontage, il se
  // declenche apres la fin de la suite et Jest tombe sur un import post-teardown.
  afterEach(async () => {
    if (!arbre) return;
    await act(async () => { arbre.unmount(); });
    arbre = null;
  });

  test('la carte existe, et elle porte le nom de l equipe', async () => {
    const tree = await afficherLaListe([SANS_NIVEAU]);

    expect(textesDe(tree.toJSON()).join(' | ')).toContain('Equipe Sans');
  });

  test('l etiquette du niveau DISPARAIT — pas de blanc, pas de tiret orphelin', async () => {
    const tree = await afficherLaListe([SANS_NIVEAU]);
    const textes = textesDe(tree.toJSON());

    const trous = textes.filter((texte) => ['', ' ', '-', '–', '—', '·', '•'].includes(texte));
    expect(trous).toEqual([]);
    expect(textes.join(' | ')).not.toContain('undefined');
    expect(textes.join(' | ')).not.toContain('null');
  });

  test('les trois autres etiquettes restent la', async () => {
    const tree = await afficherLaListe([SANS_NIVEAU]);
    const textes = textesDe(tree.toJSON()).join(' | ');

    expect(textes).toContain('Football');
    expect(textes).toContain('Masculin');
    expect(textes).toContain('U15');
  });

  test('non-regression : dans la MEME liste, l equipe qui a un niveau l affiche', async () => {
    const tree = await afficherLaListe([AVEC_NIVEAU, SANS_NIVEAU]);
    const textes = textesDe(tree.toJSON()).join(' | ');

    expect(textes).toContain('Equipe Avec');
    expect(textes).toContain('Equipe Sans');
    // Le niveau apparait UNE fois : celui de l'equipe qui en a un.
    expect(textes.split('Departemental')).toHaveLength(2);
  });

  test('et `level: undefined` se comporte comme `level: null`', async () => {
    const tree = await afficherLaListe([{ ...SANS_NIVEAU, level: undefined }]);
    const textes = textesDe(tree.toJSON()).join(' | ');

    expect(textes).toContain('Equipe Sans');
    expect(textes).not.toContain('undefined');
  });
});
