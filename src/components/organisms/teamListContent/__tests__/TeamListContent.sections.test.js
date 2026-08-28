import fs from 'fs';
import path from 'path';

import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ClubCardSurface from '@/components/molecules/clubCard/ClubCardSurface';
import SponsorMarquee from '@/components/molecules/sponsorMarquee/SponsorMarquee';

import TeamListContent from '../TeamListContent';

// FILET E6 — la liste d'equipes rend QUATRE sections (invitations, demandes en
// attente, mes equipes, autres equipes) et n'avait aucun test hors de la carte
// « Nouvelle equipe ». Ce fichier fige d'abord le comportement ACTUEL, puis
// verifie la refonte visuelle D3 (tours 7e / 7f).
//
// A savoir avant de lire les tests, constate dans le code (pas suppose) :
// `invitedTeams` vaut TOUJOURS [] hors mode LEAGUE — la section « Invitations
// recues » n'existe donc aujourd'hui que pour les squads. C'est pour ca que la
// section 1 se teste en mode LEAGUE et les 3 autres en mode classique.

jest.setTimeout(30000);

const mockUseAuth = jest.fn();
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => mockUseAuth(),
}));

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: () => {},
  // SponsorMarquee suspend sa boucle hors ecran : sans ce mock, la ligne de
  // sponsors ne demarre jamais.
  useIsFocused: () => true,
  useNavigation: () => ({ getState: () => ({ routeNames: [] }), navigate: mockNavigate }),
}));

// FlashList mesure sa fenetre avant de rendre : sans layout reel, ni l'en-tete
// ni les elements n'apparaissent. Ce double rend les 4 zones — dont `renderItem`,
// qui porte la section « Autres equipes ».
jest.mock('@shopify/flash-list', () => {
  // eslint-disable-next-line global-require
  const { View } = require('react-native');
  /**
   * Rend une zone de liste, qu'elle soit passee comme element ou comme fabrique.
   * @param {any} component - Element ou fabrique d'element.
   * @returns {any} - Element rendu.
   */
  const resolve = (component) => (typeof component === 'function' ? component() : component);
  return {
    FlashList: ({
      data,
      keyExtractor,
      ListEmptyComponent,
      ListFooterComponent,
      ListHeaderComponent,
      renderItem,
    }) => (
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

const mockTeams = jest.fn();
const mockValider = jest.fn();
const mockEnAttenteDeValidation = jest.fn(() => ({ data: [], error: null, isLoading: false }));
jest.mock('@/services/team/teamQueries', () => ({
  // LOT EQUIPES (Q7) — la file de validation du dirigeant.
  useApproveTeamCreation: () => ({ isPending: false, mutate: mockValider, variables: undefined }),
  useGetTeams: () => mockTeams(),
  useTeamsAwaitingClubApproval: (/** @type {any} */ ...args) => mockEnAttenteDeValidation(...args),
}));

const mockLeagueContext = jest.fn();
jest.mock('@/services/leagueTeam/leagueTeamQueries', () => ({
  useGetLeagueTeamContext: () => mockLeagueContext(),
}));

jest.mock('@/views/search/searchRouteHelpers', () => ({ navigateToSearchHub: jest.fn() }));

jest.mock('@/utils/imageUrl', () => ({ getImageUrl: (/** @type {any} */ url) => url }));

jest.mock('@/theme/colors', () => ({ withAlpha: (/** @type {any} */ color) => color }));
jest.mock('@/theme/themeContext', () => {
  /**
   * Echelle de style tolerante : n'importe quelle cle rend un objet vide.
   * @returns {any}
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

const SPONSORS = [
  { documentId: 'sp-1', logo: { url: 'logo-1' }, title: 'Boulangerie Paul' },
  { documentId: 'sp-2', logo: { url: 'logo-2' }, title: 'Garage Central' },
];

const CLUB_AVEC_SPONSORS = { documentId: 'c-1', name: 'FC Test', sponsor: SPONSORS };
const CLUB_SANS_SPONSOR = { documentId: 'c-2', name: 'AS Sans Sponsor', sponsor: [] };

// Je suis JOUEUR de cette equipe. 3 joueurs + 1 entraineur = 4 membres.
const TEAM_JOUEUR = {
  activities: [{ name: 'Football' }],
  category: { name: 'U15' },
  club: CLUB_AVEC_SPONSORS,
  documentId: 't-joueur',
  level: { name: 'Departemental' },
  name: 'U15 Masculins',
  players: [{ documentId: 'u-1' }, { documentId: 'u-2' }, { documentId: 'u-3' }],
  section: { name: 'Masculine' },
  trainers: [{ documentId: 'u-9' }],
};

// Je suis ENTRAINEUR de cette equipe, et son club n'a aucun sponsor.
const TEAM_COACH = {
  activities: [{ name: 'Handball' }],
  club: CLUB_SANS_SPONSOR,
  documentId: 't-coach',
  name: 'Seniors Filles',
  players: [{ documentId: 'u-5' }],
  section: { name: 'Feminine' },
  trainers: [{ documentId: 'u-1' }],
};

// Equipe la plus pauvre possible : un sport, rien d'autre. Elle est A MOI (donc
// rendue en carte riche) : c'est la qu'on prouve qu'aucune etiquette vide n'est
// rendue pour les champs absents.
const TEAM_NUE = {
  activities: [{ name: 'Basket' }],
  club: CLUB_SANS_SPONSOR,
  documentId: 't-nue',
  name: 'Loisirs',
  players: [],
  trainers: [],
};

const TEAM_AUTRE = {
  activities: [{ name: 'Rugby' }],
  category: { name: 'U13' },
  club: CLUB_SANS_SPONSOR,
  documentId: 't-autre',
  name: 'U13 Rugby',
  players: [{ documentId: 'u-7' }, { documentId: 'u-8' }],
  section: { name: 'Mixte' },
};

const TEAM_ATTENTE = {
  activities: [{ name: 'Football' }],
  club: CLUB_AVEC_SPONSORS,
  documentId: 't-attente',
  name: 'U11 Mixte',
  section: { name: 'Mixte' },
};

const CLUB_DEMANDE = { activities: [], documentId: 'c-9', name: 'US Demande' };

const UTILISATEUR = {
  clubMembershipRequests: [{ club: CLUB_DEMANDE, documentId: 'creq-1', state: 'pending' }],
  documentId: 'u-1',
  myTeams: [{ documentId: 't-joueur' }, { documentId: 't-nue' }],
  role: { name: 'Dirigeant' },
  teamMembershipRequests: [{ documentId: 'req-1', state: 'pending', team: TEAM_ATTENTE }],
  trainedTeams: [{ documentId: 't-coach' }],
};

const CONTEXTE_LEAGUE = {
  invitedSquads: [{ division: 2, documentId: 'sq-invite', name: 'Squad Invitee' }],
  pendingSquads: [{ division: 4, documentId: 'sq-attente', name: 'Squad En Attente' }],
  squads: [{ division: 1, documentId: 'sq-mienne', name: 'Ma Squad' }],
};

/** @type {any} */
let mountedTree = null;

/**
 * Monte la liste avec un jeu d'equipes donne.
 * @param {object} [options]
 * @param {any} [options.auth] - Surcharges de useAuth.
 * @param {boolean} [options.isLeagueMode] - Rend les squads au lieu des equipes.
 * @param {any} [options.leagueContext] - Contexte LEAGUE renvoye par le service.
 * @param {any[]} [options.teams] - Equipes renvoyees par la requete paginee.
 * @param options.clubId
 * @returns {Promise<any>} - Arbre rendu.
 */
const renderList = async ({
  auth = {},
  clubId = undefined,
  isLeagueMode = false,
  leagueContext = null,
  teams = [TEAM_JOUEUR, TEAM_COACH, TEAM_AUTRE, TEAM_NUE],
} = {}) => {
  mockUseAuth.mockReturnValue({
    canManageTeam: true,
    freeUsageSummary: [],
    subscriptionAccessLevel: 'FREE',
    userData: UTILISATEUR,
    ...auth,
  });
  mockTeams.mockReturnValue({
    data: { pages: [{ data: teams }] },
    error: null,
    fetchNextPage: jest.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    isLoading: false,
    refetch: jest.fn(),
  });
  mockLeagueContext.mockReturnValue({
    data: leagueContext,
    error: null,
    isLoading: false,
    refetch: jest.fn(),
  });

  await act(async () => {
    mountedTree = renderer.create(
      <TeamListContent clubId={clubId} isLeagueMode={isLeagueMode} />,
    );
  });
  return mountedTree;
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
const allText = (tree) => collectText(tree.toJSON()).join(' | ');

/**
 * La carte (ou la rangee) qui porte ce libelle exact.
 * Reperee par son texte et non par un testID : le filet doit tenir avant comme
 * apres la refonte, sans dependre d'un attribut que la refonte ajoute elle-meme.
 * @param {any} tree - Arbre rendu.
 * @param {string} label - Texte exact porte par la carte.
 * @returns {any} - Le TouchableOpacity le plus externe qui contient ce texte.
 */
const findCard = (tree, label) => tree.root.findAllByType(TouchableOpacity).find(
  (/** @type {any} */ node) => node.findAllByType(Text)
    .some((/** @type {any} */ text) => text.props.children === label),
);

/**
 * Les textes contenus dans une carte donnee.
 * Les nombres comptent : les compteurs de la grille (membres, entraineurs) sont
 * rendus comme des nombres, pas comme des chaines.
 * @param {any} card - Noeud de la carte.
 * @returns {string[]} - Textes de la carte.
 */
const cardTexts = (card) => card.findAllByType(Text)
  .map((/** @type {any} */ text) => text.props.children)
  .filter((/** @type {any} */ value) => typeof value === 'string' || typeof value === 'number')
  .map((/** @type {any} */ value) => String(value));

/**
 * Aplatit un style RN (tableau imbrique, entrees `null`) en un seul objet.
 * @param {any} style - Style brut.
 * @returns {any} - Style aplati.
 */
const flattenStyle = (style) => (Array.isArray(style)
  ? style.reduce((merged, entry) => Object.assign(merged, flattenStyle(entry)), {})
  : (style || {}));

/**
 * Le style pose par la carte sur son enveloppe partagee.
 * @param {any} card - Noeud de la carte.
 * @returns {any} - Style aplati de ClubCardSurface.
 */
const surfaceStyle = (card) => flattenStyle(card.findByType(ClubCardSurface).props.style);

/**
 * Les libelles des etiquettes verre d'une carte.
 * On garde les seuls noeuds hotes : `findAllByProps` remonte aussi le composant
 * qui porte la prop, ce qui compterait chaque etiquette deux fois.
 * @param {any} card - Noeud de la carte.
 * @returns {string[]} - Libelles des etiquettes, dans l'ordre du rendu.
 */
const chipsOf = (card) => card
  .findAllByProps({ testID: 'team-card-chip' })
  .filter((/** @type {any} */ node) => typeof node.type === 'string')
  .flatMap((/** @type {any} */ node) => cardTexts(node));

describe('TeamListContent — les 4 sections (filet E6)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Le debounce de recherche est arme a 300 ms : sans demontage il se declenche
  // apres la fin de la suite et Jest tombe sur un import post-teardown.
  afterEach(async () => {
    if (!mountedTree) return;
    await act(async () => { mountedTree.unmount(); });
    mountedTree = null;
  });

  describe('invariants — ce que la refonte ne doit pas casser', () => {
    it('rend les 3 sections du mode classique avec toutes leurs equipes', async () => {
      const tree = await renderList();
      const rendu = allText(tree);

      expect(rendu).toContain('Demandes en attente');
      expect(rendu).toContain('U11 Mixte');
      expect(rendu).toContain('US Demande');

      expect(rendu).toContain('Mes équipes');
      expect(rendu).toContain('U15 Masculins');
      expect(rendu).toContain('Seniors Filles');
      expect(rendu).toContain('Loisirs');

      expect(rendu).toContain('Autres équipes');
      expect(rendu).toContain('U13 Rugby');
    });

    it('rend la section « Invitations reçues » (mode LEAGUE, seul cas reel)', async () => {
      const tree = await renderList({ isLeagueMode: true, leagueContext: CONTEXTE_LEAGUE });
      const rendu = allText(tree);

      expect(rendu).toContain('Invitations reçues');
      expect(rendu).toContain('Squad Invitee');
      expect(rendu).toContain('INVITATION');

      expect(rendu).toContain('Demandes en attente');
      expect(rendu).toContain('Squad En Attente');
      expect(rendu).toContain('EN ATTENTE');

      expect(rendu).toContain('Ma Squad');
    });

    it('annonce mon role sur chacune de mes equipes', async () => {
      const tree = await renderList();

      expect(cardTexts(findCard(tree, 'U15 Masculins')).join(' ')).toMatch(/joueur/i);
      expect(cardTexts(findCard(tree, 'Seniors Filles')).join(' ')).toMatch(/coach/i);
    });

    it('porte le club, les 4 informations de l\'equipe et son nombre de membres', async () => {
      const tree = await renderList();
      const carte = cardTexts(findCard(tree, 'U15 Masculins')).join(' | ');

      expect(carte).toContain('FC Test');
      expect(carte).toContain('Football');
      expect(carte).toContain('Masculine');
      expect(carte).toContain('U15');
      expect(carte).toContain('Departemental');
      // 3 joueurs + 1 entraineur distincts.
      expect(carte).toMatch(/\b4\b/);
      expect(carte).toMatch(/membre/i);
    });

    it('n\'affiche aucune information absente sur une equipe nue', async () => {
      const tree = await renderList();
      const carte = cardTexts(findCard(tree, 'Loisirs')).join(' | ');

      expect(carte).toContain('Basket');
      expect(carte).not.toContain('undefined');
      expect(carte).not.toContain('null');
      // Aucun separateur orphelin : ni « · » isole, ni double separateur.
      expect(carte).not.toMatch(/·\s*·/);
    });

    it('montre les sponsors du club, et rien quand il n\'y en a pas', async () => {
      const tree = await renderList();

      const avecSponsors = cardTexts(findCard(tree, 'U15 Masculins')).join(' ');
      const sansSponsor = cardTexts(findCard(tree, 'Seniors Filles')).join(' ');

      expect(avecSponsors).toContain('Boulangerie Paul');
      expect(sansSponsor).not.toContain('Boulangerie Paul');
    });

    it('ouvre le detail de l\'equipe depuis n\'importe quelle section', async () => {
      const tree = await renderList();

      await act(async () => { findCard(tree, 'U13 Rugby').props.onPress(); });

      expect(mockNavigate).toHaveBeenCalledWith('TeamStack', expect.objectContaining({
        params: expect.objectContaining({ teamId: 't-autre' }),
        screen: 'TeamDetails',
      }));
    });

    it('ouvre la fiche du club pour une demande d\'adhesion club', async () => {
      const tree = await renderList();

      await act(async () => { findCard(tree, 'US Demande').props.onPress(); });

      expect(mockNavigate).toHaveBeenCalledWith('ClubStack', expect.objectContaining({
        params: { clubId: 'c-9' },
        screen: 'Club',
      }));
    });

    it('rend la liste vide sans planter quand il n\'y a aucune equipe', async () => {
      const sansRien = { ...UTILISATEUR, clubMembershipRequests: [], teamMembershipRequests: [] };
      const tree = await renderList({ auth: { userData: sansRien }, teams: [] });

      expect(allText(tree)).not.toContain('Mes équipes');
      expect(tree.toJSON()).not.toBeNull();
    });
  });

  describe('refonte D3 — carte riche (7e)', () => {
    it('donne a chaque section le badge qui lui revient', async () => {
      const tree = await renderList();

      expect(cardTexts(findCard(tree, 'U15 Masculins'))).toContain('JOUEUR·SE');
      expect(cardTexts(findCard(tree, 'Seniors Filles'))).toContain('COACH');
      // L'etat REMPLACE le role : une demande en attente ne montre pas « COACH ».
      expect(cardTexts(findCard(tree, 'U11 Mixte'))).toContain('EN ATTENTE');
      expect(cardTexts(findCard(tree, 'U11 Mixte'))).not.toContain('COACH');
    });

    it('donne le badge INVITATION aux invitations (mode LEAGUE)', async () => {
      const tree = await renderList({ isLeagueMode: true, leagueContext: CONTEXTE_LEAGUE });

      expect(cardTexts(findCard(tree, 'Squad Invitee'))).toContain('INVITATION');
      expect(cardTexts(findCard(tree, 'Squad En Attente'))).toContain('EN ATTENTE');
    });

    it('teinte la bordure de la carte selon l\'etat, et elle seule', async () => {
      const tree = await renderList();

      expect(surfaceStyle(findCard(tree, 'U11 Mixte')).borderColor).toBe('couleur-alerte');
      // Sans etat, la bordure reste celle de ClubCardSurface (cyan 25 %), donc
      // la carte ne la surcharge pas.
      expect(surfaceStyle(findCard(tree, 'U15 Masculins')).borderColor).toBeUndefined();
    });

    it('masque les informations absentes au lieu de rendre des etiquettes vides', async () => {
      const tree = await renderList();

      // Sport + genre + categorie + niveau : les 4 sont renseignes.
      expect(chipsOf(findCard(tree, 'U15 Masculins'))).toEqual([
        'Football', 'Masculine', 'U15', 'Departemental',
      ]);
      // Une equipe qui n'a qu'un sport n'a QU'UNE etiquette, pas quatre dont
      // trois vides.
      expect(chipsOf(findCard(tree, 'Loisirs'))).toEqual(['Basket']);
    });

    it('remplace « N membres » par la grille membres / entraineurs', async () => {
      const tree = await renderList();
      const carte = findCard(tree, 'U15 Masculins');

      expect(carte.findAllByProps({ testID: 'team-card-stats' }).length).toBeGreaterThan(0);
      const textes = cardTexts(carte);
      expect(textes).toContain('Membres');
      expect(textes).toContain('Entraîneur·e·s');
      // 3 joueurs + 1 entraineur distincts, dont 1 entraineur.
      expect(textes).toContain('4');
      expect(textes).toContain('1');
    });
  });

  describe('refonte D3 — un seul defilement de sponsors, celui du depot', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '..', 'TeamListContent.js'),
      'utf8',
    );

    it('importe SponsorMarquee au lieu d\'animer une seconde marquee', () => {
      expect(source).toContain("from '@/components/molecules/sponsorMarquee/SponsorMarquee'");
      // La preuve qu'aucun second defilement n'a ete ecrit ici : ce fichier
      // n'anime rien lui-meme (le brief de design proposait un `Animated`).
      expect(source).not.toContain('Animated');
      expect(source).not.toContain('Easing');
    });

    it('rend les sponsors du club par le composant partage', async () => {
      const tree = await renderList();
      const marquee = findCard(tree, 'U15 Masculins').findAllByType(SponsorMarquee);

      expect(marquee.length).toBe(1);
      expect(cardTexts(marquee[0])).toContain('Boulangerie Paul');
      expect(cardTexts(marquee[0])).toContain('Garage Central');
    });

    it('se masque entierement quand le club n\'a aucun sponsor', async () => {
      const tree = await renderList();
      const marquee = findCard(tree, 'Seniors Filles').findAllByType(SponsorMarquee);

      expect(marquee.length).toBe(1);
      expect(marquee[0].findAllByType(Text)).toHaveLength(0);
    });
  });

  describe('refonte D3 — rangees compactes (7f)', () => {
    it('resume les autres equipes sur une seule ligne', async () => {
      const tree = await renderList();
      const rangee = findCard(tree, 'U13 Rugby');

      expect(cardTexts(rangee)).toContain('Rugby · U13 · Mixte · 2 membres');
    });

    it('n\'emprunte ni la grille de compteurs ni les etiquettes de la carte riche', async () => {
      const tree = await renderList();
      const rangee = findCard(tree, 'U13 Rugby');

      expect(rangee.findAllByProps({ testID: 'team-card-stats' })).toHaveLength(0);
      expect(chipsOf(rangee)).toHaveLength(0);
      expect(rangee.findAllByType(SponsorMarquee)).toHaveLength(0);
    });
  });

  // FILET L49 — defaut rapporte a la recette du 2026-08-06 : « je suis entraineur
  // de plusieurs equipes, l'onglet n'en reconnait qu'UNE ; les autres tombent sous
  // AUTRES EQUIPES ». Ces deux tests epinglent le tri de l'ECRAN, seul endroit ou
  // la separation se decide. Ils sont VERTS : `myTeamIds` lit l'UNION de `myTeams`
  // et `trainedTeams`, sans plafond, sans deduplication par club.
  // ⇒ Une equipe qui tombe dans « Autres » n'est donc PAS dans `trainedTeams` :
  //   la cause est en amont (donnee ou charge serveur), jamais ici.
  describe('L49 — un entraineur de plusieurs equipes les voit TOUTES comme siennes', () => {
    const EQUIPES_ENTRAINEES = ['t-a', 't-b', 't-c', 't-d'].map((documentId, index) => ({
      activities: [{ name: 'Football' }],
      club: CLUB_SANS_SPONSOR,
      documentId,
      name: `Equipe entrainee ${index + 1}`,
      section: { name: 'Mixte' },
    }));

    // Le cas d'Adel : aucune equipe en tant que JOUEUR (`myTeams` vide, mesure du
    // 2026-08-06 : 0 ligne dans `teams_players_lnk`), plusieurs en tant que COACH.
    const COACH_MULTI = {
      ...UTILISATEUR,
      clubMembershipRequests: [],
      myTeams: [],
      teamMembershipRequests: [],
      trainedTeams: EQUIPES_ENTRAINEES.map(({ documentId }) => ({ documentId })),
    };

    it('classe les 4 equipes entrainees sous « Mes equipes », et aucune sous « Autres »', async () => {
      const tree = await renderList({
        auth: { userData: COACH_MULTI },
        teams: EQUIPES_ENTRAINEES,
      });
      const rendu = allText(tree);

      expect(rendu).toContain('Mes équipes');
      EQUIPES_ENTRAINEES.forEach(({ name }) => expect(rendu).toContain(name));
      expect(rendu).not.toContain('Autres équipes');
    });

    it('ne laisse dans « Autres » que l\'equipe qu\'il n\'entraine pas', async () => {
      const tree = await renderList({
        auth: { userData: COACH_MULTI },
        teams: [...EQUIPES_ENTRAINEES, TEAM_AUTRE],
      });
      const rendu = allText(tree);

      expect(rendu).toContain('Autres équipes');
      expect(findCard(tree, 'U13 Rugby')).toBeDefined();
      EQUIPES_ENTRAINEES.forEach(({ name }) => expect(rendu).toContain(name));
    });
  });

  describe('D25 ① — l equipe qu on vient de creer est MIENNE tout de suite', () => {
    // Le profil est celui d'AVANT la creation : le serveur le sert depuis un
    // cache memoire qu'aucune ecriture d'equipe ne purge (30 s a 4 min). C'est
    // ce que l'app recevait, et croyait sur parole.
    const PROFIL_PERIME = {
      ...UTILISATEUR,
      clubMembershipRequests: [],
      myTeams: [],
      teamMembershipRequests: [],
      trainedTeams: [],
    };

    // L'equipe, elle, arrive fraiche avec `GET /teams` : le serveur y rend
    // `trainers`, et j'y suis.
    const EQUIPE_TOUTE_NEUVE = {
      activities: [{ name: 'Football' }],
      club: CLUB_SANS_SPONSOR,
      documentId: 't-neuve',
      name: 'U15 Filles',
      players: [],
      section: { name: 'Feminine' },
      trainers: [{ documentId: 'u-1' }],
    };

    it('la classe sous « Mes equipes », pas sous « Autres equipes »', async () => {
      const tree = await renderList({
        auth: { userData: PROFIL_PERIME },
        teams: [EQUIPE_TOUTE_NEUVE],
      });
      const rendu = allText(tree);

      expect(rendu).toContain('Mes équipes');
      expect(rendu).toContain('U15 Filles');
      expect(rendu).not.toContain('Autres équipes');
    });

    it('laisse bien sous « Autres equipes » celle d un autre entraineur', async () => {
      const tree = await renderList({
        auth: { userData: PROFIL_PERIME },
        teams: [EQUIPE_TOUTE_NEUVE, TEAM_AUTRE],
      });
      const rendu = allText(tree);

      expect(rendu).toContain('Autres équipes');
      expect(findCard(tree, 'U13 Rugby')).toBeDefined();
      expect(rendu).toContain('U15 Filles');
    });
  });

  // D83 — « EN ATTENTE » ne disait de QUOI ni pour DEBLOQUER quoi. Les trois
  // demandes possibles n'ont ni le meme valideur ni le meme effet, verifie dans
  // le serveur avant d'ecrire un mot :
  //  · revendication de club  -> `admin/src/api/club/controllers/club.ts:619`
  //    cree la demande SANS toucher l'utilisateur, et
  //    `club-membership-request.ts:745` refuse la validation a tout autre qu'un
  //    superadmin. L'acceptation seule donne club + role Dirigeant
  //    (`services/club-membership-request.ts:276`).
  //  · adhesion a un club     -> route `accept` sous police `is-club-manager`.
  //  · adhesion a une equipe  -> route `accept` sous police `is-team-manager`.
  // Le serveur rend deja `type` dans le profil
  // (`admin/src/api/firebase-auth/constants.ts:135`) : rien a ajouter cote API.
  describe('D83 — la carte en attente dit QUOI, QUI et CE QUE ça debloque', () => {
    const CLUB_REVENDIQUE = { activities: [], documentId: 'c-83', name: '& DANSE ENCORPS' };

    /**
     * Un profil dont la seule demande en attente est celle fournie.
     * @param {any} demandeClub - Demande d'adhesion/revendication de club.
     * @param {any[]} [demandesEquipe] - Demandes d'adhesion a une equipe.
     * @returns {any} - Profil utilisateur.
     */
    const profilAvec = (demandeClub, demandesEquipe = []) => ({
      ...UTILISATEUR,
      clubMembershipRequests: demandeClub ? [demandeClub] : [],
      teamMembershipRequests: demandesEquipe,
    });

    it('dit qu une revendication attend FoundClub, et ce qu elle debloque', async () => {
      const tree = await renderList({
        auth: {
          userData: profilAvec({
            club: CLUB_REVENDIQUE,
            documentId: 'creq-83',
            state: 'pending',
            type: 'claim',
          }),
        },
      });
      const carte = cardTexts(findCard(tree, '& DANSE ENCORPS')).join(' | ');

      expect(carte).toContain('Ta demande pour diriger ce club');
      expect(carte).toContain('FoundClub vérifie que tu diriges bien ce club');
      expect(carte).toContain('Tu n\'as rien à faire de ton côté');
      expect(carte).toContain('tu deviens dirigeant·e du club');
      expect(carte).toContain('créer tes équipes');
    });

    it('ne montre plus « 0 Membres » sur un club qu on attend de diriger', async () => {
      const tree = await renderList({
        auth: {
          userData: profilAvec({
            club: CLUB_REVENDIQUE,
            documentId: 'creq-83',
            state: 'pending',
            type: 'claim',
          }),
        },
      });
      const carte = findCard(tree, '& DANSE ENCORPS');

      expect(carte.findAllByProps({ testID: 'team-card-stats' })).toHaveLength(0);
      expect(cardTexts(carte)).not.toContain('Entraîneur·e·s');
    });

    it('dit qu une adhesion a un club attend un dirigeant du club', async () => {
      const tree = await renderList({
        auth: {
          userData: profilAvec({
            club: CLUB_DEMANDE,
            documentId: 'creq-84',
            state: 'pending',
            type: 'join',
          }),
        },
      });
      const carte = cardTexts(findCard(tree, 'US Demande')).join(' | ');

      expect(carte).toContain('Ta demande pour rejoindre ce club');
      expect(carte).toContain('Un·e dirigeant·e du club doit l\'accepter');
      expect(carte).toContain('tu fais partie du club');
    });

    it('dit qu une adhesion a une equipe attend son staff', async () => {
      const tree = await renderList({
        auth: {
          userData: profilAvec(null, [
            { documentId: 'req-83', state: 'pending', team: TEAM_ATTENTE },
          ]),
        },
      });
      const carte = cardTexts(findCard(tree, 'U11 Mixte')).join(' | ');

      expect(carte).toContain('Ta demande pour rejoindre cette équipe');
      expect(carte).toContain('Le staff de l\'équipe doit l\'accepter');
      expect(carte).toContain('tu rejoins l\'effectif');
    });

    it('garde le badge orange EN ATTENTE et n ecrit rien sur les autres cartes', async () => {
      const tree = await renderList({
        auth: {
          userData: profilAvec({
            club: CLUB_REVENDIQUE,
            documentId: 'creq-83',
            state: 'pending',
            type: 'claim',
          }),
        },
      });

      expect(cardTexts(findCard(tree, '& DANSE ENCORPS'))).toContain('EN ATTENTE');
      expect(surfaceStyle(findCard(tree, '& DANSE ENCORPS')).borderColor).toBe('couleur-alerte');
      expect(cardTexts(findCard(tree, 'U15 Masculins')).join(' | ')).not.toContain('Ta demande');
    });
  });
});

// ---------------------------------------------------------------------------
// LOT EQUIPES (E6) — Q7 : LE DIRIGEANT VOIT CE QU IL A A VALIDER, ET IL PEUT.
//
// ⛔ La regle du depot, payee trois fois : « ne livre JAMAIS une file d attente
// que personne ne regarde ». Ces temoins verifient les DEUX moities : elle
// s affiche la ou il regarde deja, et un bouton la vide.
// ---------------------------------------------------------------------------
describe('EQUIPES — Q7 : la file de validation du dirigeant', () => {
  const EQUIPE_A_VALIDER = {
    activities: [{ name: 'Football' }],
    club: CLUB_AVEC_SPONSORS,
    documentId: 't-a-valider',
    name: 'U11 du coach',
    players: [],
    trainers: [{ documentId: 'u-77' }],
  };

  afterEach(() => {
    mockEnAttenteDeValidation.mockReturnValue({ data: [], error: null, isLoading: false });
    mockValider.mockClear();
  });

  it('le dirigeant voit l equipe en attente, avec ce qui se passe et le geste a faire', async () => {
    mockEnAttenteDeValidation.mockReturnValue({
      data: [EQUIPE_A_VALIDER], error: null, isLoading: false,
    });

    const tree = await renderList({ clubId: 'c-1' });
    const textes = collectText(tree.toJSON());

    expect(textes).toContain('Demandes en attente');
    expect(textes.join(' | ')).toContain('U11 du coach');
    // Ce qui se passe, dit en mots :
    expect(textes.join(' ')).toMatch(/créée par un·e entraîneur·e/i);
    // Et le geste, atteignable :
    expect(textes).toContain('Valider cette équipe');
  });

  it('le bouton valide BIEN cette equipe-la', async () => {
    mockEnAttenteDeValidation.mockReturnValue({
      data: [EQUIPE_A_VALIDER], error: null, isLoading: false,
    });

    const tree = await renderList({ clubId: 'c-1' });
    // Le bouton se reconnait a son LIBELLE, pas a sa place dans l arbre.
    const bouton = tree.root.findAll((/** @type {any} */ n) => (
      typeof n.props?.onPress === 'function' && n.props?.title === 'Valider cette équipe'
    ));

    expect(bouton.length).toBeGreaterThan(0);
    await act(async () => { bouton[0].props.onPress(); });

    expect(mockValider).toHaveBeenCalledWith('t-a-valider');
  });

  it('la file n est meme pas demandee quand on ne dirige pas ce club', async () => {
    // ⚠️ Le serveur rend deja une liste vide a qui ne dirige pas le club vise ;
    // ici on verifie qu on ne lui pose meme pas la question.
    await renderList({ auth: { userData: { ...UTILISATEUR, role: { name: 'Entraineur' } } }, clubId: 'c-1' });

    const appels = mockEnAttenteDeValidation.mock.calls;
    expect(appels.every((/** @type {any[]} */ appel) => appel[1]?.enabled === false)).toBe(true);
  });

  it('sans equipe en attente, la section ne change pas d un pouce', async () => {
    const tree = await renderList({ clubId: 'c-1' });
    const textes = collectText(tree.toJSON());

    expect(textes).not.toContain('Valider cette équipe');
  });
});
