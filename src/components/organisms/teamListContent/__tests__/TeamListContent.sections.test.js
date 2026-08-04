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
jest.mock('@/services/team/teamQueries', () => ({
  useGetTeams: () => mockTeams(),
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
 * @returns {Promise<any>} - Arbre rendu.
 */
const renderList = async ({
  auth = {},
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
    mountedTree = renderer.create(<TeamListContent isLeagueMode={isLeagueMode} />);
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
});
