import renderer, { act } from 'react-test-renderer';

import TeamDetails from '../TeamDetails';

// Filet AA03 (E6), volet « ET APRES ? » — UNE EQUIPE SANS NIVEAU VA EXISTER.
//
// Le tunnel n'est pas le seul concerne : des qu'on laisse creer une equipe sans
// niveau, tous les ecrans qui l'AFFICHENT doivent tenir. La regle est celle des
// affiches du lot X01, et elle ne se negocie pas :
//   soit la ligne disparait ENTIEREMENT, libelle compris,
//   soit elle dit quelque chose d'utile.
// Jamais un blanc, jamais un tiret orphelin, jamais un mot anglais, jamais
// « undefined ».
//
// Ce fichier tient la FICHE DE L'EQUIPE. Les deux autres surfaces citees par le
// constat ont leur propre filet :
//   · la carte dans une liste  -> `teamListContent/__tests__/TeamListContent.sansNiveau.test.js`
//   · la recherche / la liste  -> `services/team/__tests__/teamService.sansNiveau.test.js`
//
// Point d'observation : TOUS les textes rendus. On ne cherche pas un pixel, on
// cherche un TROU — un mot vide, un separateur qui pend, un identifiant brut.

/** @type {any} */
let mockEquipe;

const mockNavigation = {
  addListener: () => () => {},
  goBack: jest.fn(),
  navigate: jest.fn(),
  setOptions: jest.fn(),
};

jest.mock('@react-navigation/native', () => ({ useFocusEffect: () => {} }));

jest.mock('@tanstack/react-query', () => ({
  useMutation: () => ({ isPending: false, mutate: jest.fn() }),
  useQuery: () => ({ data: undefined, isLoading: false, refetch: jest.fn() }),
  useQueryClient: () => ({ invalidateQueries: jest.fn(), setQueryData: jest.fn() }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => {
      if (typeof repli === 'string') return repli;
      if (repli && typeof repli.defaultValue === 'string') return repli.defaultValue;
      return cle;
    },
  }),
}));

jest.mock('@/theme/themeContext', () => {
  const feuilleDeStyle = {};
  const rampe = () => new Proxy({}, { get: () => feuilleDeStyle });
  return {
    __esModule: true,
    default: () => ({
      Alignments: rampe(),
      ApplicationStyle: new Proxy({}, { get: () => feuilleDeStyle }),
      Colors: new Proxy({}, { get: (_cible, cle) => `couleur-${String(cle)}` }),
      Fonts: rampe(),
      Images: new Proxy({}, { get: () => 1 }),
      Spaces: new Proxy({}, { get: () => rampe() }),
    }),
  };
});

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({
    canEditClub: () => false,
    canJoinTeam: () => false,
    canManageTeam: () => false,
    entitlementsSummary: null,
    getNextOnboardingRoute: () => null,
    getPostOnboardingHomeRoute: () => null,
    inviteTeamPlayers: jest.fn(),
    refetchUserData: jest.fn(),
    subscriptionAccessLevel: 'FREE',
    USER_ROLES: {},
    userData: { documentId: 'moi', myTeams: [], trainedTeams: [] },
  }),
}));

jest.mock('@/domains/club/useClub', () => ({
  __esModule: true,
  default: () => ({ getClubInitials: () => 'FC' }),
}));

jest.mock('@/domains/messaging/useMessaging', () => ({
  __esModule: true,
  default: () => ({ startTeamChat: jest.fn(), startWhisperChat: jest.fn() }),
}));

// ⚠️ `authUseCases`, `subscriptionDecision` et `teamMembership` ne sont PAS
// doubles : ce sont des modules de decision purs, sans reseau. Les doubler
// obligerait a recopier leur surface entiere — et un oubli fait planter le
// rendu au lieu de mesurer l'ecran.

jest.mock('@/services/team/teamQueries', () => ({
  useGetTeam: () => ({
    data: mockEquipe, error: null, isLoading: false, refetch: jest.fn(),
  }),
}));
jest.mock('@/services/club/clubQueries', () => ({
  useGetClub: () => ({ data: undefined, error: null, refetch: jest.fn() }),
}));
jest.mock('@/services/stats/statsQueries', () => ({
  useGetTeamStats: () => ({ data: undefined, isLoading: false, refetch: jest.fn() }),
}));
jest.mock('@/services/stats/statsService', () => ({ resetTeamStats: jest.fn() }));
jest.mock('@/services/matchStats/matchStatsQueries', () => ({
  useGetTeamPerformanceStats: () => ({ data: undefined, isLoading: false, refetch: jest.fn() }),
}));
jest.mock('@/services/team/teamService', () => ({
  deleteTeam: jest.fn(),
  getTeamExternalCalendar: jest.fn(),
  previewTeamScraping: jest.fn(),
  quitTeam: jest.fn(),
  refreshTeamExternalData: jest.fn(),
  removePlayerFromTeam: jest.fn(),
  updateTeam: jest.fn(),
  updateTeamExternalConfig: jest.fn(),
}));
jest.mock('@/services/teamMembershipRequest/teamMembershipRequestService', () => ({
  createTeamMembershipRequest: jest.fn(),
}));
jest.mock('@/services/auth/authService', () => ({ removeTrainerFromClub: jest.fn() }));

// Le gabarit de chargement rend directement son contenu : ce filet regarde
// l'ecran servi, pas l'attente.
jest.mock(
  '@/components/molecules/withDataWrapper/WithDataWrapper',
  () => function EnveloppeMock({ children }) { return children; },
);
jest.mock(
  '@/components/templates/ScreenContainer',
  () => function EcranMock({ children }) { return children; },
);
jest.mock(
  '@/components/organisms/eventListContent/EventListContent',
  () => function AgendaMock() { return null; },
);

// Les feuilles de dessin ne portent aucun texte d'equipe : elles ne peuvent pas
// creer le trou qu'on cherche, et elles coutent cher a monter.
// ⚠️ Une par une, jamais dans une boucle : Babel ne HISSE que les `jest.mock`
// ecrits au premier niveau. Dans un `forEach`, ils s'executent APRES l'import du
// composant teste — la doublure arrive trop tard et le vrai module casse Jest.
jest.mock(
  '@/components/atoms/checkable/Checkable',
  () => function FeuilleMock() { return null; },
);
jest.mock(
  '@/components/atoms/loader/Loader',
  () => function FeuilleMock() { return null; },
);
jest.mock(
  '@/components/atoms/sponsorLogoTile/SponsorLogoTile',
  () => function FeuilleMock() { return null; },
);
jest.mock(
  '@/components/atoms/SvgIcon/SvgIcon',
  () => function FeuilleMock() { return null; },
);
jest.mock(
  '@/components/atoms/teamShield/TeamShield',
  () => function FeuilleMock() { return null; },
);
jest.mock(
  '@/components/molecules/bottomModal/BottomModal',
  () => function FeuilleMock() { return null; },
);
jest.mock(
  '@/components/molecules/clubLogoMark/ClubLogoMark',
  () => function FeuilleMock() { return null; },
);
jest.mock(
  '@/components/molecules/input/Input',
  () => function FeuilleMock() { return null; },
);
jest.mock(
  '@/components/molecules/memberAvatar/MemberAvatar',
  () => function FeuilleMock() { return null; },
);
jest.mock(
  '@/components/molecules/profileAvatar/ProfileAvatar',
  () => function FeuilleMock() { return null; },
);
jest.mock(
  '@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet',
  () => function FeuilleMock() { return null; },
);
jest.mock(
  '@/components/molecules/teamSlotList/TeamSlotList',
  () => function FeuilleMock() { return null; },
);
jest.mock(
  '@/components/organisms/createTrainerModal/CreateTrainerModal',
  () => function FeuilleMock() { return null; },
);

jest.mock('@/components/atoms/button/Button', () => function BoutonMock(/** @type {any} */ props) {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN } = jest.requireActual('react-native');
  return reactActuel.createElement(TexteRN, null, props.title);
});

/**
 * Tous les textes d'un arbre rendu.
 *
 * ⚠️ On part de la RACINE, pas de `racine.children` : quand le composant du
 * haut rend plusieurs enfants, `toJSON()` renvoie un TABLEAU, qui n'a pas de
 * `.children`. En partant du dessous, le parcours ne trouvait rien et TOUS les
 * temoins passaient a vide.
 * @param {any} noeud L'arbre rendu, ou un morceau.
 * @returns {string[]} Les textes, dans l'ordre du rendu.
 */
const textesDe = (noeud) => {
  /** @type {string[]} */
  const sortie = [];
  const parcourir = (/** @type {any} */ enfant) => {
    if (typeof enfant === 'string' || typeof enfant === 'number') {
      sortie.push(String(enfant));
      return;
    }
    if (Array.isArray(enfant)) {
      enfant.forEach(parcourir);
      return;
    }
    if (enfant?.children) enfant.children.forEach(parcourir);
  };
  parcourir(noeud);
  return sortie;
};

/** Une equipe complete : la reference contre laquelle on compare le manque. */
const EQUIPE_COMPLETE = {
  activities: [{ documentId: 'act-1', name: 'Football' }],
  category: { documentId: 'cat-1', name: 'U15' },
  club: { documentId: 'club-1', name: 'FC Test' },
  documentId: 'equipe-1',
  level: { documentId: 'niv-1', name: 'Departemental' },
  name: 'U15 Filles',
  players: [],
  section: { documentId: 'sec-1', name: 'Masculin' },
  trainers: [],
};

/** @type {any} */
let arbre;

/**
 * Monte la fiche de l'equipe et rend tous ses textes.
 * @param {any} equipe L'equipe servie par le serveur double.
 * @returns {string[]} Les textes rendus.
 */
const afficherLaFiche = (equipe) => {
  mockEquipe = equipe;
  act(() => {
    arbre = renderer.create(
      <TeamDetails
        navigation={/** @type {any} */ (mockNavigation)}
        route={/** @type {any} */ ({ params: { teamId: 'equipe-1' } })}
      />,
    );
  });
  return textesDe(arbre.toJSON());
};

afterEach(() => {
  if (arbre) act(() => arbre.unmount());
  arbre = null;
});

describe('AA03 - temoin 4 : la fiche d une equipe SANS niveau', () => {
  test('elle s affiche, et elle porte bien le nom de l equipe', () => {
    const textes = afficherLaFiche({ ...EQUIPE_COMPLETE, level: undefined });

    expect(textes.join(' | ')).toContain('U15 Filles');
  });

  test('ni blanc, ni tiret orphelin, ni « undefined » : la ligne DISPARAIT', () => {
    const textes = afficherLaFiche({ ...EQUIPE_COMPLETE, level: undefined });

    // Aucun texte rendu n'est vide ou reduit a un separateur qui pend.
    const trous = textes.filter((texte) => ['', ' ', '-', '–', '—', '·', '•'].includes(texte));
    expect(trous).toEqual([]);
    // Et aucun mot de programmeur n'a fuit jusqu'a l'ecran.
    expect(textes.join(' | ')).not.toContain('undefined');
    expect(textes.join(' | ')).not.toContain('null');
    expect(textes.join(' | ')).not.toContain('[object Object]');
  });

  test('les etiquettes des champs RENSEIGNES sont toujours la', () => {
    const textes = afficherLaFiche({ ...EQUIPE_COMPLETE, level: undefined }).join(' | ');

    expect(textes).toContain('Masculin');
    expect(textes).toContain('U15');
    // Et le niveau, lui, n'apparait nulle part : il n'existe pas.
    expect(textes).not.toContain('Departemental');
  });

  test('non-regression : avec son niveau, la fiche l affiche', () => {
    const textes = afficherLaFiche(EQUIPE_COMPLETE).join(' | ');

    expect(textes).toContain('Departemental');
  });

  test('une equipe dont le serveur envoie level: null tient aussi', () => {
    // Strapi renvoie `null`, pas `undefined`, pour une relation absente : les
    // deux formes doivent se comporter pareil.
    const textes = afficherLaFiche({ ...EQUIPE_COMPLETE, level: null });

    expect(textes.join(' | ')).toContain('U15 Filles');
    expect(textes.join(' | ')).not.toContain('undefined');
  });
});
