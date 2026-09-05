/**
 * INVIT — « INVITER DANS UNE EQUIPE » CREE UNE VRAIE INVITATION.
 *
 * 🎯 CE QUE CE FILET PROUVE. Mesure du 2026-09-05 en production : Adel,
 * dirigeant, cree l'equipe « Seniors A », invite quelqu'un — et
 * `team_membership_requests` reste VIDE. Zero ligne, zero notification. La
 * cause n'etait pas le serveur (route, garde-fou, notification et banniere
 * d'acceptation existent tous depuis le lot P10) : les TROIS boutons
 * « Inviter » de la fiche d'equipe appelaient `inviteTeamPlayers`, qui ouvre la
 * feuille de partage SMS du telephone. Aucun appel reseau.
 *
 * ⇒ Ce filet exige qu'un appui sur « Inviter » atteigne `inviteToTeam`, donc la
 * route `POST /team-membership-requests/invite`. AVANT le lot il est ROUGE sur
 * ses 9 temoins, tous avec la meme phrase : « Aucun element ne porte le libelle
 * "Inviter un membre du club" ».
 *
 * 🔒 IL PROTEGE AUSSI LE CHEMIN D'AVANT (decision E4 n°1) : le partage de lien
 * ne disparait pas, il change de nom et gagne une deuxieme porte. Les deux
 * chemins ne servent pas le meme monde — le lien s'adresse a quelqu'un QUI N'A
 * PAS L'APP, l'invitation a quelqu'un QUI A DEJA UN COMPTE.
 *
 * 🧱 AUCUNE REQUETE NEUVE : les personnes proposees viennent de `clubData`,
 * deja charge par l'ecran (il alimente deja le choix des entraineurs). C'est
 * aussi ce qui evite d'importer un service reseau de plus dans cet ecran, ce
 * qui ferait tomber TOUTES ses suites de temoins (pieges AD01 / BLOQUER).
 *
 * ⚠️ CE QU'IL NE PROUVE PAS : Jest ne mesure aucun pixel et ne parle a aucun
 * serveur. Que la ligne s'ecrive vraiment en base se constate en recette.
 */

import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import TeamDetails from '../TeamDetails';

const mockInviterDansEquipe = jest.fn();
const mockPartagerLeLien = jest.fn();
const mockAlerte = jest.fn();

/** L'erreur que le serveur renvoie, quand un temoin en simule une. */
let mockRefusDuServeur = /** @type {any} */ (null);

const CLUB = { documentId: 'club-1', name: 'A.S. Luzy' };

const DIRIGEANT = { documentId: 'moi', firstname: 'Adel', lastname: 'F' };

const EQUIPE = {
  activities: [{ documentId: 'sport-1', name: 'Football' }],
  category: { documentId: 'categorie-1', name: 'Seniors' },
  club: CLUB,
  documentId: 'equipe-1',
  name: 'Seniors A',
  players: [{ documentId: 'joueuse-1', firstname: 'Bo', lastname: 'M' }],
  trainers: [DIRIGEANT],
};

// ⚠️ Chaque doublure de requete rend TOUJOURS LE MEME OBJET pendant un temoin.
// Une doublure qui reconstruit son enveloppe a chaque appel change l'identite
// de `team`/`club`, relance les effets qui en dependent, et Jest tourne en
// boucle sans jamais rendre la main (piege paye au lot R03).
const enveloppe = (/** @type {any} */ donnees) => ({
  data: donnees,
  error: null,
  isFetching: false,
  isLoading: false,
  refetch: jest.fn(),
});

const mockReponseEquipe = enveloppe(EQUIPE);
const mockReponseVide = enveloppe(null);

/**
 * Le club, avec les membres que le temoin veut lui donner.
 * @param {any[]} membres Les membres du club.
 * @param {boolean} [masques] Le club masque-t-il ses membres ?
 * @returns {any} L'enveloppe de requete.
 */
const clubAvec = (membres, masques = false) => enveloppe({
  ...CLUB,
  members: membres,
  membersAreHidden: masques,
});

let mockReponseClub = clubAvec([]);

const AUTH_DIRIGEANT = Object.freeze({
  canEditClub: () => true,
  canJoinTeam: () => false,
  canManageTeam: true,
  entitlementsSummary: [],
  getNextOnboardingRoute: () => null,
  getPostOnboardingHomeRoute: () => null,
  inviteTeamPlayers: (/** @type {any} */ params) => mockPartagerLeLien(params),
  refetchUserData: jest.fn(),
  subscriptionAccessLevel: 'none',
  USER_ROLES: { admin: 'Dirigeant', coach: 'Entraineur', player: 'Joueur' },
  userData: {
    club: CLUB,
    documentId: 'moi',
    myTeams: [{ documentId: 'equipe-1' }],
    role: { name: 'Dirigeant' },
    teamMembershipRequests: [],
    trainedTeams: [{ documentId: 'equipe-1' }],
  },
});

let mockAuthCourant = AUTH_DIRIGEANT;

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: () => {},
}));

// La doublure de mutation joue le cycle complet — succes ET echec — parce que
// ce filet mesure ce que l'utilisateur VOIT apres son geste, pas seulement
// l'appel reseau.
jest.mock('@tanstack/react-query', () => ({
  useMutation: (/** @type {any} */ options) => ({
    isPending: false,
    mutate: (/** @type {any} */ variables) => {
      const resultat = options?.mutationFn?.(variables);
      if (resultat && typeof resultat.then === 'function') {
        return resultat
          .then((/** @type {any} */ data) => options?.onSuccess?.(data, variables))
          .catch((/** @type {any} */ erreur) => options?.onError?.(erreur, variables));
      }
      options?.onSuccess?.(resultat, variables);
      return undefined;
    },
  }),
  useQueryClient: () => ({ invalidateQueries: jest.fn(), setQueryData: jest.fn() }),
}));

// La doublure de `t` rend le repli quand il existe, et remplace les variables :
// sans elle, les libelles resteraient des CLEFS et aucune recherche par texte
// ne les trouverait.
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ clef, /** @type {any} */ repli, /** @type {any} */ valeurs) => {
      if (typeof repli !== 'string') return clef;
      if (!valeurs) return repli;
      return Object.keys(valeurs).reduce(
        (texte, nom) => texte.split(`{{${nom}}}`).join(String(valeurs[nom])),
        repli,
      );
    },
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
      Images: new Proxy({}, { get: () => 1 }),
      Spaces: espaces,
    }),
  };
});

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => mockAuthCourant,
}));

jest.mock('@/domains/auth/authUseCases', () => ({
  markOnboardingComplete: jest.fn(),
  resolveAffiliationOriginRoute: () => null,
  USER_ROLES: { admin: 'Dirigeant', coach: 'Entraineur', player: 'Joueur' },
}));

jest.mock('@/domains/club/useClub', () => ({
  __esModule: true,
  default: () => ({ getClubInitials: () => 'AL' }),
}));

jest.mock('@/domains/messaging/useMessaging', () => ({
  __esModule: true,
  default: () => ({ startTeamChat: jest.fn(), startWhisperChat: jest.fn() }),
}));

jest.mock('@/domains/subscription/subscriptionDecision', () => ({
  extractSubscriptionDecisionFromError: () => null,
  hasActiveClubOffer: () => false,
}));

jest.mock('@/domains/team/teamMembership', () => ({
  isMyTeam: () => true,
}));

jest.mock('@/services/team/teamQueries', () => ({
  useGetTeam: () => mockReponseEquipe,
}));
jest.mock('@/services/club/clubQueries', () => ({
  useGetClub: () => mockReponseClub,
}));
jest.mock('@/services/stats/statsQueries', () => ({
  useGetTeamStats: () => mockReponseVide,
}));
jest.mock('@/services/matchStats/matchStatsQueries', () => ({
  useGetTeamPerformanceStats: () => mockReponseVide,
}));

jest.mock('@/services/team/teamService', () => ({
  connectExternalCompetition: jest.fn(),
  createFFBBErrorReport: jest.fn(),
  leaveTeam: jest.fn(),
  previewExternalCompetition: jest.fn(),
  refreshExternalCompetition: jest.fn(),
  removePlayerFromTeam: jest.fn(),
  updateTeam: jest.fn(),
}));
jest.mock('@/services/auth/authService', () => ({ removeTrainerFromClub: jest.fn() }));
jest.mock('@/services/stats/statsService', () => ({ resetTeamStats: jest.fn() }));

// ⚠️ La doublure est ecrite EN ENTIER, sans `requireActual` : le vrai module
// importe `@/services/client`, qui exige un `.env` absent de tout worktree.
jest.mock('@/services/teamMembershipRequest/teamMembershipRequestService', () => ({
  acceptTeamInvitation: jest.fn(),
  createTeamMembershipRequest: jest.fn(),
  inviteToTeam: (/** @type {any} */ payload) => {
    mockInviterDansEquipe(payload);
    if (mockRefusDuServeur) return Promise.reject(mockRefusDuServeur);
    return Promise.resolve({ data: { documentId: 'tmr-neuve' } });
  },
  refuseTeamInvitation: jest.fn(),
}));

jest.mock('@/navigation/public/publicAuthNavigation', () => ({ openPublicAuthFlow: jest.fn() }));
jest.mock('@/views/league/match/utils/leagueNavigation', () => ({
  navigateToLeagueMatchDetails: jest.fn(),
}));
jest.mock('@/views/team/composition/teamCompoTemplateUtils', () => ({
  buildCompoTemplateDestination: () => ({ params: {}, screen: 'x' }),
}));

jest.mock('@/utils/clubCertification', () => ({ isVerifiedClub: () => false }));
jest.mock('@/utils/errors/displayError', () => ({ getErrorMessage: () => 'erreur' }));
jest.mock('@/utils/imageUrl', () => ({ getImageUrl: () => null }));

jest.mock('@/components/templates/ScreenContainer', () => {
  const { View: VueRN } = jest.requireActual('react-native');
  const reactActuel = jest.requireActual('react');

  return function ScreenContainerMock(/** @type {any} */ props) {
    return reactActuel.createElement(VueRN, null, props.children);
  };
});

jest.mock('@/components/molecules/withDataWrapper/WithDataWrapper', () => {
  const { View: VueRN } = jest.requireActual('react-native');
  const reactActuel = jest.requireActual('react');

  return function WithDataWrapperMock(/** @type {any} */ props) {
    return reactActuel.createElement(VueRN, null, props.children);
  };
});

// La feuille maison ne rend RIEN tant qu'elle n'est pas visible : sa doublure
// fait pareil. C'est ce qui distingue « affiche a l'ecran » de « range dans une
// feuille fermee ».
jest.mock('@/components/molecules/bottomModal/BottomModal', () => {
  const { View: VueRN } = jest.requireActual('react-native');
  const reactActuel = jest.requireActual('react');

  return function BottomModalMock(/** @type {any} */ props) {
    if (!props.isVisible) return null;

    return reactActuel.createElement(
      VueRN,
      null,
      props.headerComponent,
      props.children,
    );
  };
});

jest.mock('@/components/atoms/button/Button', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  const reactActuel = jest.requireActual('react');

  return function ButtonMock(/** @type {any} */ props) {
    return reactActuel.createElement(TexteRN, null, props.title);
  };
});

// L'Input maison est double par un vrai `TextInput` qui GARDE `onChangeText` et
// `placeholder` : le temoin tape dedans comme un doigt le ferait.
jest.mock('@/components/molecules/input/Input', () => {
  const { TextInput: SaisieRN } = jest.requireActual('react-native');
  const reactActuel = jest.requireActual('react');

  return function InputMock(/** @type {any} */ props) {
    return reactActuel.createElement(SaisieRN, props);
  };
});

jest.mock('@/components/atoms/checkable/Checkable', () => function CheckableMock() {
  return null;
});
jest.mock('@/components/atoms/loader/Loader', () => function LoaderMock() {
  return null;
});
jest.mock(
  '@/components/atoms/sponsorLogoTile/SponsorLogoTile',
  () => function SponsorLogoTileMock() {
    return null;
  },
);
jest.mock('@/components/atoms/SvgIcon/SvgIcon', () => function SvgIconMock() {
  return null;
});
jest.mock('@/components/atoms/teamShield/TeamShield', () => function TeamShieldMock() {
  return null;
});
jest.mock('@/components/molecules/clubLogoMark/ClubLogoMark', () => function ClubLogoMarkMock() {
  return null;
});
jest.mock('@/components/molecules/memberAvatar/MemberAvatar', () => function MemberAvatarMock() {
  return null;
});
jest.mock('@/components/molecules/profileAvatar/ProfileAvatar', () => function ProfileAvatarMock() {
  return null;
});
jest.mock(
  '@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet',
  () => function SubscriptionPaywallSheetMock() {
    return null;
  },
);
jest.mock('@/components/molecules/teamSlotList/TeamSlotList', () => function TeamSlotListMock() {
  return null;
});
jest.mock(
  '@/components/organisms/createTrainerModal/CreateTrainerModal',
  () => function CreateTrainerModalMock() {
    return null;
  },
);
jest.mock(
  '@/components/organisms/eventListContent/EventListContent',
  () => function EventListContentMock() {
    return null;
  },
);

jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(
  (/** @type {any} */ titre, /** @type {any} */ corps) => mockAlerte(titre, corps),
);

/** @type {any} */
let arbre;

const navigation = {
  addListener: () => () => {},
  getParent: () => null,
  getState: () => ({ routeNames: [] }),
  goBack: jest.fn(),
  navigate: jest.fn(),
  setOptions: jest.fn(),
};

const LIBELLE_INVITER = 'Inviter un membre du club';
const LIBELLE_PARTAGER = 'Partager un lien d\'invitation';
const TITRE_FEUILLE = 'Inviter dans l\'équipe';
const EXPLICATION_AUTRE_CLUB = 'Tu peux inviter directement'
  + ' les personnes déjà rattachées à ton club.'
  + ' Pour quelqu\'un d\'un autre club, envoie-lui plutôt un lien d\'invitation :'
  + ' il·elle pourra demander à rejoindre l\'équipe.';

/**
 * Monte la fiche d'equipe.
 * @returns {any} La racine de l'arbre monte.
 */
const monterLaFiche = () => {
  act(() => {
    arbre = renderer.create(
      <TeamDetails
        navigation={/** @type {any} */ (navigation)}
        route={/** @type {any} */ ({ params: { teamId: 'equipe-1' } })}
      />,
    );
  });

  return arbre.root;
};

/**
 * Rend tous les noeuds `Text` qui portent exactement ce libelle.
 * @param {any} racine La racine de l'arbre.
 * @param {string} libelle Le texte cherche.
 * @returns {any[]} Les noeuds trouves.
 */
const textesPortant = (racine, libelle) => racine.findAll(
  (/** @type {any} */ noeud) => noeud.type === Text && noeud.props?.children === libelle,
  { deep: true },
);

/**
 * Remonte les ancetres d'un noeud jusqu'au premier qui repond au doigt.
 * @param {any} noeud Le noeud de depart.
 * @returns {any} L'ancetre appuyable, ou `null`.
 */
const ancetreAppuyable = (noeud) => {
  let courant = noeud?.parent;
  while (courant) {
    if (typeof courant.props?.onPress === 'function') return courant;
    courant = courant.parent;
  }
  return null;
};

/**
 * Appuie sur le premier element qui porte ce libelle.
 * @param {any} racine La racine de l'arbre.
 * @param {string} libelle Le texte du bouton.
 * @returns {void}
 */
const appuyerSur = (racine, libelle) => {
  const noeuds = textesPortant(racine, libelle);
  if (!noeuds.length) {
    throw new Error(`Aucun element ne porte le libelle « ${libelle} »`);
  }
  const appuyable = ancetreAppuyable(noeuds[0]);
  if (!appuyable) {
    throw new Error(`« ${libelle} » n'est relie a aucune action`);
  }
  act(() => {
    appuyable.props.onPress();
  });
};

/**
 * Appuie sur un bouton dont le geste part sur le reseau, et laisse la reponse
 * revenir. Sans cette attente, React previent que l'etat a change hors `act`.
 * @param {any} racine La racine de l'arbre.
 * @param {string} libelle Le texte du bouton.
 * @returns {Promise<void>} rien.
 */
const appuyerEtAttendre = async (racine, libelle) => {
  await act(async () => {
    const noeuds = textesPortant(racine, libelle);
    if (!noeuds.length) {
      throw new Error(`Aucun element ne porte le libelle « ${libelle} »`);
    }
    ancetreAppuyable(noeuds[0]).props.onPress();
    await Promise.resolve();
    await Promise.resolve();
  });
};

/**
 * Laisse passer le report de 180 ms qui separe la fermeture d'une feuille de
 * l'ouverture de la suivante (motif `handleOpenCreateTrainerModal`).
 * @returns {Promise<void>} rien.
 */
const laisserLaFeuilleSOuvrir = async () => {
  await act(async () => {
    await new Promise((resoudre) => { setTimeout(resoudre, 260); });
  });
};

/**
 * Ouvre la feuille des trois points.
 * @param {any} racine La racine de l'arbre.
 * @returns {void}
 */
const ouvrirLeMenu = (racine) => {
  const bouton = racine.findAll(
    (/** @type {any} */ noeud) => noeud.props?.testID === 'team-actions-menu-button',
    { deep: true },
  )[0];

  act(() => {
    bouton.props.onPress();
  });
};

/**
 * Ouvre la feuille d'invitation depuis le menu des trois points.
 * @param {any} racine La racine de l'arbre.
 * @returns {Promise<void>} rien.
 */
const ouvrirLaFeuilleDInvitation = async (racine) => {
  ouvrirLeMenu(racine);
  appuyerSur(racine, LIBELLE_INVITER);
  await laisserLaFeuilleSOuvrir();
};

/**
 * Tape un nom dans le champ de recherche de la feuille.
 * @param {any} racine La racine de l'arbre.
 * @param {string} texte Ce qu'on tape.
 * @returns {void}
 */
const taperDansLaRecherche = (racine, texte) => {
  const champ = racine.findAll(
    (/** @type {any} */ noeud) => typeof noeud.props?.onChangeText === 'function'
      && String(noeud.props?.placeholder || '').includes('membre du club'),
    { deep: true },
  )[0];

  if (!champ) throw new Error('Aucun champ de recherche « membre du club »');

  act(() => {
    champ.props.onChangeText(texte);
  });
};

beforeEach(() => {
  mockInviterDansEquipe.mockClear();
  mockPartagerLeLien.mockClear();
  mockAlerte.mockClear();
  mockRefusDuServeur = null;
  mockAuthCourant = AUTH_DIRIGEANT;
  mockReponseClub = clubAvec([]);
});

afterEach(() => {
  // Un arbre laisse monte fait tomber le processus Jest ENTIER apres le test :
  // les minuteries armees par React Native tirent apres le demontage de
  // l'environnement (piege paye au lot D34).
  if (arbre) {
    act(() => arbre.unmount());
  }
  arbre = null;
});

describe('INVIT — la fiche d equipe sait ENVOYER une invitation', () => {
  test('🔴 T1 — inviter quelqu un appelle `inviteToTeam`, pas le partage SMS', async () => {
    mockReponseClub = clubAvec([
      { documentId: 'joueuse-2', firstname: 'Chloé', lastname: 'D' },
    ]);

    const racine = monterLaFiche();
    await ouvrirLaFeuilleDInvitation(racine);
    await appuyerEtAttendre(racine, 'Inviter');

    // 🔑 LE COEUR DU LOT : la route neuve est appelee, avec l equipe et la
    // personne — et le partage SMS n a PAS ete declenche a la place.
    expect(mockInviterDansEquipe).toHaveBeenCalledWith({
      team: 'equipe-1',
      user: 'joueuse-2',
    });
    expect(mockPartagerLeLien).not.toHaveBeenCalled();
  });

  test('T1b — la recherche filtre les membres du club, sans requete neuve', async () => {
    mockReponseClub = clubAvec([
      { documentId: 'joueuse-2', firstname: 'Chloé', lastname: 'D' },
      { documentId: 'joueur-3', firstname: 'Malik', lastname: 'T' },
    ]);

    const racine = monterLaFiche();
    await ouvrirLaFeuilleDInvitation(racine);

    expect(textesPortant(racine, 'Chloé D')).toHaveLength(1);
    expect(textesPortant(racine, 'Malik T')).toHaveLength(1);

    taperDansLaRecherche(racine, 'mal');

    expect(textesPortant(racine, 'Chloé D')).toHaveLength(0);
    expect(textesPortant(racine, 'Malik T')).toHaveLength(1);
  });

  test('T1c — apres l envoi, la personne porte « Invitation envoyée »', async () => {
    mockReponseClub = clubAvec([
      { documentId: 'joueuse-2', firstname: 'Chloé', lastname: 'D' },
    ]);

    const racine = monterLaFiche();
    await ouvrirLaFeuilleDInvitation(racine);
    await appuyerEtAttendre(racine, 'Inviter');

    expect(textesPortant(racine, 'Invitation envoyée')).toHaveLength(1);
    expect(textesPortant(racine, 'Inviter')).toHaveLength(0);
    expect(mockAlerte).toHaveBeenCalledWith(
      'Invitation envoyée',
      'Chloé D va recevoir une notification. Elle rejoindra l\'équipe si elle accepte.',
    );
  });

  test('🔒 T1d — une personne DEJA dans l equipe n est pas proposee, moi non plus', async () => {
    // Le serveur la refuserait (controleur :759). On ne propose pas un geste
    // dont on sait qu il echouera.
    mockReponseClub = clubAvec([
      { documentId: 'joueuse-1', firstname: 'Bo', lastname: 'M' },
      { documentId: 'moi', firstname: 'Adel', lastname: 'F' },
    ]);

    const racine = monterLaFiche();
    await ouvrirLaFeuilleDInvitation(racine);

    expect(textesPortant(racine, 'Inviter')).toHaveLength(0);
    expect(textesPortant(racine, 'Personne d\'autre dans ton club pour l\'instant.'))
      .toHaveLength(1);
  });

  test('🔒 T1e — un club qui MASQUE ses membres le dit, il ne fait pas semblant', async () => {
    mockReponseClub = clubAvec([], true);

    const racine = monterLaFiche();
    await ouvrirLaFeuilleDInvitation(racine);

    expect(
      textesPortant(racine, 'Ce club masque ses membres : impossible de les proposer ici.'),
    ).toHaveLength(1);
  });
});

describe('INVIT — T2 : le partage de lien EXISTE toujours', () => {
  test('T2 — « Partager un lien d invitation » est dans le menu et ouvre le partage', () => {
    const racine = monterLaFiche();
    ouvrirLeMenu(racine);

    expect(textesPortant(racine, LIBELLE_PARTAGER).length).toBeGreaterThan(0);

    appuyerSur(racine, LIBELLE_PARTAGER);

    expect(mockPartagerLeLien).toHaveBeenCalledWith({
      clubName: 'A.S. Luzy',
      teamId: 'equipe-1',
      teamName: 'Seniors A',
    });
    expect(mockInviterDansEquipe).not.toHaveBeenCalled();
  });

  test('T2b — le partage est AUSSI atteignable depuis la feuille d invitation', async () => {
    const racine = monterLaFiche();
    await ouvrirLaFeuilleDInvitation(racine);

    expect(textesPortant(racine, TITRE_FEUILLE)).toHaveLength(1);

    appuyerSur(racine, LIBELLE_PARTAGER);

    expect(mockPartagerLeLien).toHaveBeenCalledTimes(1);
  });
});

describe('INVIT — T3 : le cas d Adel, quelqu un d un AUTRE club', () => {
  test('T3 — une liste vide EXPLIQUE la regle, elle ne se tait pas', async () => {
    mockReponseClub = clubAvec([
      { documentId: 'joueuse-2', firstname: 'Chloé', lastname: 'D' },
    ]);

    const racine = monterLaFiche();
    await ouvrirLaFeuilleDInvitation(racine);
    taperDansLaRecherche(racine, 'Zoé');

    expect(textesPortant(racine, 'Personne de ce nom dans ton club.')).toHaveLength(1);
    expect(textesPortant(racine, EXPLICATION_AUTRE_CLUB)).toHaveLength(1);
    // ⇒ Et la sortie de secours est LA, dans la meme feuille.
    expect(textesPortant(racine, LIBELLE_PARTAGER).length).toBeGreaterThan(0);
  });

  test('T3b — un refus du serveur s affiche en FRANCAIS, jamais en anglais', async () => {
    mockReponseClub = clubAvec([
      { documentId: 'joueuse-2', firstname: 'Chloé', lastname: 'D' },
    ]);
    mockRefusDuServeur = Object.assign(
      new Error('User already has a pending invitation for this team'),
      { status: 400 },
    );

    const racine = monterLaFiche();
    await ouvrirLaFeuilleDInvitation(racine);
    await appuyerEtAttendre(racine, 'Inviter');

    expect(mockAlerte).toHaveBeenCalledWith(
      'Invitation impossible',
      'Cette personne a déjà une invitation en attente pour cette équipe.',
    );
    // 🔒 Rien n a bouge a l ecran : la personne reste invitable.
    expect(textesPortant(racine, 'Invitation envoyée')).toHaveLength(0);
  });
});
